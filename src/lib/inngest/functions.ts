import { inngest } from './client';
import { prisma } from '@/lib/prisma';
import { executeAppKitSwap, executeAppKitBridge, executeAppKitSend } from '@/lib/circle/app-kit';
import { sendArcTransfer } from '@/lib/circle/wallets';
import { getWalletBalances } from '@/lib/arc/rpc';
import { validateWebhookUrl } from '@/lib/security/validateWebhookUrl';
import { isValidEvmAddress, isValidSolanaAddress } from '@/lib/validation/address';

/**
 * Inngest Durable Workflow Execution Function
 */
export const executeWorkflowFunction = inngest.createFunction(
  {
    id: 'execute-workflow',
    name: 'Execute Visual Workflow Automation',
    concurrency: {
      limit: 5,
    },
    retries: 2,
  },
  { event: 'workflow.trigger' },
  async ({ event, step }) => {
    const { workflowId, triggerTxHash, triggerAmount, walletAddress, walletId } = event.data;

    // 1. Fetch workflow and user details
    const workflow = await step.run('fetch-workflow', async () => {
      return await prisma.workflow.findUnique({
        where: { id: workflowId },
      });
    });

    if (!workflow || !workflow.isActive) {
      return { status: 'SKIPPED', reason: 'Workflow not found or inactive' };
    }

    const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');

    // 2. Initialize execution record
    const execution = await step.run('create-execution-record', async () => {
      if (event.data.executionId) {
        const existing = await prisma.execution.findUnique({ where: { id: event.data.executionId } });
        if (existing) return existing;
      }
      return await prisma.execution.create({
        data: {
          workflowId,
          triggerTxHash,
          triggerAmount,
          status: 'RUNNING',
          stepLogs: [
            {
              stepId: triggerNode?.id || 'trigger-1',
              nodeType: 'trigger',
              nodeName: triggerNode?.data?.label || 'USDC Received',
              status: 'COMPLETE',
              txHash: triggerTxHash,
              details: `Triggered by transfer of ${triggerAmount} USDC`,
              timestamp: new Date().toISOString(),
            },
          ],
          startedAt: new Date(),
        },
      });
    });

    const actionNodes = nodes.filter((n: any) => n.type !== 'trigger');
    const totalAmount = parseFloat(triggerAmount);

    // 3. Process action nodes sequentially
    for (const node of actionNodes) {
      await step.run(`execute-node-${node.id}`, async () => {
        const percentage = parseFloat(node.data?.percentage || '40');
        const actionAmount = ((totalAmount * percentage) / 100).toFixed(6);

        const currentExecution = await prisma.execution.findUnique({
          where: { id: execution.id },
        });

        const logs = typeof currentExecution?.stepLogs === 'string'
          ? JSON.parse(currentExecution.stepLogs)
          : (currentExecution?.stepLogs || []);

        const updateLog = async (rawLogEntry: any) => {
          const logEntry = JSON.parse(
            JSON.stringify(
              {
                ...rawLogEntry,
                ...(event.data?.isSimulated ? { simulated: true } : {}),
              },
              (key, value) => (typeof value === 'bigint' ? value.toString() : value)
            )
          );
          const freshExec = await prisma.execution.findUnique({
            where: { id: execution.id },
          });

          let logs = typeof freshExec?.stepLogs === 'string'
            ? JSON.parse(freshExec.stepLogs)
            : (freshExec?.stepLogs || []);

          const existingIndex = logs.findIndex(
            (l: any) => l.stepId === logEntry.stepId && (l.status === 'RUNNING' || l.status === 'PARTIAL')
          );

          if (existingIndex >= 0) {
            logs[existingIndex] = {
              ...logs[existingIndex],
              ...logEntry,
              timestamp: new Date().toISOString(),
            };
          } else {
            logs.push({
              ...logEntry,
              timestamp: new Date().toISOString(),
            });
          }

          await prisma.execution.update({
            where: { id: execution.id },
            data: { stepLogs: logs as any },
          });
        };

        if (parseFloat(actionAmount) <= 0) {
          await updateLog({
            stepId: node.id,
            nodeType: node.type,
            nodeName: node.data?.label || node.type.toUpperCase(),
            status: 'SKIPPED',
            details: `Skipped action: percentage is 0 or allocation amount is ${actionAmount} USDC`,
          });
          return;
        }

        const nodeType = node.type;
        const nodeData = node.data || {};

        // SIMULATION MODE EXECUTION BRANCH (No Circle / Arc RPC calls)
        if (event.data?.isSimulated) {
          const { randomUUID } = await import('crypto');

          await updateLog({
            stepId: node.id,
            nodeType,
            nodeName: nodeData.label || nodeType.toUpperCase(),
            status: 'RUNNING',
            simulated: true,
            details: `[SIMULATED] Executing ${nodeType.toUpperCase()} action...`,
          });

          // Simulate processing latency (300ms - 800ms)
          await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 500) + 300));

          const fakeTxHash = `0xsim-${randomUUID().slice(0, 16)}`;
          const actionAmountNum = parseFloat(actionAmount);

          // Deduct allocated amount from DB simulated balance
          const simWallet = await prisma.wallet.findFirst({
            where: {
              OR: [
                ...(walletAddress ? [{ address: { equals: walletAddress, mode: 'insensitive' as const } }] : []),
                ...(walletId ? [{ circleWalletId: { equals: walletId } }] : []),
              ],
            },
          });

          if (simWallet) {
            const currentBal = parseFloat(simWallet.simulatedUsdcBalance || '0');
            const updatedBal = Math.max(0, currentBal - actionAmountNum).toFixed(6);
            await prisma.wallet.update({
              where: { id: simWallet.id },
              data: { simulatedUsdcBalance: updatedBal },
            });
          }

          let detailMsg = `[SIMULATED] Successfully completed ${nodeType.toUpperCase()} of ${actionAmount} USDC`;
          if (nodeType === 'swap') {
            detailMsg = `[SIMULATED] Swapped ${actionAmount} USDC to ${nodeData.tokenOut || 'EURC'} (Tx: ${fakeTxHash})`;
          } else if (nodeType === 'bridge') {
            detailMsg = `[SIMULATED] Bridged ${actionAmount} USDC to ${nodeData.destinationChain || 'Solana_Devnet'} recipient ${nodeData.destinationAddress || '0x...'} (Tx: ${fakeTxHash})`;
          } else if (nodeType === 'send') {
            detailMsg = `[SIMULATED] Sent ${actionAmount} USDC to recipient ${nodeData.destinationAddress || '0x...'} (Tx: ${fakeTxHash})`;
          } else if (nodeType === 'notify') {
            detailMsg = `[SIMULATED] Sent webhook alert for ${actionAmount} USDC`;
          }

          await updateLog({
            stepId: node.id,
            nodeType,
            nodeName: nodeData.label || nodeType.toUpperCase(),
            status: 'COMPLETE',
            txHash: fakeTxHash,
            simulated: true,
            details: detailMsg,
          });
          return;
        }

        try {
          // Check if this step already executed an on-chain transaction on a prior Inngest attempt
          const freshExecForCheck = await prisma.execution.findUnique({ where: { id: execution.id } });
          const currentLogsForCheck = typeof freshExecForCheck?.stepLogs === 'string'
            ? JSON.parse(freshExecForCheck.stepLogs)
            : (freshExecForCheck?.stepLogs || []);
          const recordedLog = currentLogsForCheck.find((l: any) => l.stepId === node.id && l.txHash);

          if (recordedLog?.txHash) {
            console.log(`[INNGEST IDEMPOTENCY RECOVERY] Skipping redundant on-chain call for node ${node.id}. Recorded txHash: ${recordedLog.txHash}`);
            return;
          }

          if (nodeType === 'swap') {
            const tokenOut = nodeData.tokenOut || 'EURC';

            // Pre-flight Gas Reserve Validation
            const balances = await getWalletBalances(walletAddress).catch(() => ({ usdc: '0', eurc: '0' }));
            const currentUsdcBalance = parseFloat(balances.usdc || '0');
            const requiredGasReserve = 0.05;

            let executableAmount = parseFloat(actionAmount);
            if (currentUsdcBalance < requiredGasReserve) {
              throw new Error(`Insufficient USDC balance on Arc Testnet wallet for gas reserve. Available: ${currentUsdcBalance.toFixed(4)} USDC, Required Gas Reserve: ${requiredGasReserve} USDC.`);
            }

            if (currentUsdcBalance < executableAmount + requiredGasReserve) {
              executableAmount = Math.max(0.0001, currentUsdcBalance - requiredGasReserve);
              console.log(`[GAS RESERVE GUARD] Capped swap amount from ${actionAmount} to ${executableAmount.toFixed(6)} USDC to preserve ${requiredGasReserve} USDC gas reserve.`);
            }

            const finalAmountStr = executableAmount.toFixed(6);

            // Emit immediate RUNNING log before App Kit call
            await updateLog({
              stepId: node.id,
              nodeType: 'swap',
              nodeName: nodeData.label || 'Swap Action',
              status: 'RUNNING',
              details: `Submitting ${finalAmountStr} USDC swap USDC → ${tokenOut} on Arc Testnet...`,
            });

            let txResult: any;

            if (process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET) {
              txResult = await executeAppKitSwap({
                userWalletAddress: walletAddress,
                walletId,
                amountUsdc: finalAmountStr,
                tokenOut,
              });
            } else {
              throw new Error('CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET missing in environment');
            }

            const realTxHash = txResult?.txHash || txResult?.id || txResult?.transactionHash || txResult?.steps?.find((s: any) => s.txHash)?.txHash;

            if (!realTxHash) {
              await updateLog({
                stepId: node.id,
                nodeType: 'swap',
                nodeName: nodeData.label || 'Swap Action',
                status: 'FAILED',
                error: `Swap failed: no valid transaction hash returned from Circle App Kit. State: ${txResult?.state || 'unknown'}`,
              });
            } else {
              // Persist txHash immediately to DB as PARTIAL to secure idempotency before any secondary operations
              await updateLog({
                stepId: node.id,
                nodeType: 'swap',
                nodeName: nodeData.label || 'Swap Action',
                status: 'PARTIAL',
                txHash: realTxHash,
                details: `Swap transaction submitted on Arc Testnet (tx: ${realTxHash})...`,
              });

              await updateLog({
                stepId: node.id,
                nodeType: 'swap',
                nodeName: nodeData.label || 'Swap Action',
                status: 'COMPLETE',
                txHash: realTxHash,
                details: `Swapped ${actionAmount} USDC to ${tokenOut} on Arc Testnet`,
              });
            }
          } else if (nodeType === 'bridge') {
            const destinationAddress = nodeData.destinationAddress;
            const destinationChain = nodeData.destinationChain || 'Solana_Devnet';

            const isSolana = destinationChain === 'Solana_Devnet';
            const isValidAddr = isSolana
              ? isValidSolanaAddress(destinationAddress)
              : isValidEvmAddress(destinationAddress);

            if (!isValidAddr) {
              const errMessage = `Invalid bridge destination address ("${destinationAddress || ''}") for target chain ${destinationChain}. ${isSolana ? 'Solana base58 address required.' : 'Valid EVM address required.'}`;
              await updateLog({
                stepId: node.id,
                nodeType: 'bridge',
                nodeName: nodeData.label || 'CCTP Bridge Action',
                status: 'FAILED',
                destinationChain,
                error: errMessage,
                details: errMessage,
              });
              return;
            }

            // Pre-flight Gas Reserve Validation
            const balances = await getWalletBalances(walletAddress).catch(() => ({ usdc: '0', eurc: '0' }));
            const currentUsdcBalance = parseFloat(balances.usdc || '0');
            const requiredGasReserve = 0.05;

            let executableAmount = parseFloat(actionAmount);
            if (currentUsdcBalance < requiredGasReserve) {
              throw new Error(`Insufficient USDC balance on Arc Testnet wallet for gas reserve. Available: ${currentUsdcBalance.toFixed(4)} USDC, Required Gas Reserve: ${requiredGasReserve} USDC.`);
            }

            if (currentUsdcBalance < executableAmount + requiredGasReserve) {
              executableAmount = Math.max(0.0001, currentUsdcBalance - requiredGasReserve);
              console.log(`[GAS RESERVE GUARD] Capped bridge amount from ${actionAmount} to ${executableAmount.toFixed(6)} USDC to preserve ${requiredGasReserve} USDC gas reserve.`);
            }

            const finalAmountStr = executableAmount.toFixed(6);

            // Emit immediate RUNNING log before App Kit bridge call
            await updateLog({
              stepId: node.id,
              nodeType: 'bridge',
              nodeName: nodeData.label || 'CCTP Bridge Action',
              status: 'RUNNING',
              destinationChain,
              details: `Initiating CCTP bridge of ${finalAmountStr} USDC from Arc Testnet to ${destinationChain}...`,
            });

            let txResult: any;
            if (process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET) {
              txResult = await executeAppKitBridge({
                userWalletAddress: walletAddress,
                walletId,
                destinationAddress,
                amountUsdc: finalAmountStr,
                destinationChain,
              });
            } else {
              throw new Error('CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET missing in environment');
            }

            const burnStep = txResult?.steps?.find((s: any) => s.name === 'burn');
            const mintStep = txResult?.steps?.find((s: any) => s.name === 'mint');
            const realTxHash = burnStep?.txHash || txResult?.txHash || txResult?.steps?.find((s: any) => s.txHash)?.txHash;

            if (!realTxHash) {
              await updateLog({
                stepId: node.id,
                nodeType: 'bridge',
                nodeName: nodeData.label || 'CCTP Bridge Action',
                status: 'FAILED',
                destinationChain,
                error: `Bridge failed: no valid burn transaction hash returned on Arc Testnet. State: ${txResult?.state || 'unknown'}`,
              });
            } else if (mintStep?.state !== 'success') {
              await updateLog({
                stepId: node.id,
                nodeType: 'bridge',
                nodeName: nodeData.label || 'CCTP Bridge Action',
                status: 'PARTIAL',
                txHash: realTxHash,
                destinationChain,
                details: `Burn submitted on Arc Testnet (tx: ${realTxHash}). Waiting for Circle CCTP attestation and mint on ${destinationChain}...`,
              });
            } else {
              const mintTxHash = mintStep?.txHash || realTxHash;
              await updateLog({
                stepId: node.id,
                nodeType: 'bridge',
                nodeName: nodeData.label || 'CCTP Bridge Action',
                status: 'COMPLETE',
                txHash: mintTxHash,
                destinationChain,
                details: `Bridged ${finalAmountStr} USDC via CCTP to ${destinationChain} recipient: ${destinationAddress}`,
              });
            }
          } else if (nodeType === 'send') {
            const destinationAddress = nodeData.destinationAddress;

            if (!isValidEvmAddress(destinationAddress)) {
              const errMessage = `Invalid send recipient EVM address ("${destinationAddress || ''}"). Valid EVM 0x address required.`;
              await updateLog({
                stepId: node.id,
                nodeType: 'send',
                nodeName: nodeData.label || 'Send Action',
                status: 'FAILED',
                error: errMessage,
                details: errMessage,
              });
              return;
            }

            // Pre-flight Gas Reserve Validation
            const balances = await getWalletBalances(walletAddress).catch(() => ({ usdc: '0', eurc: '0' }));
            const currentUsdcBalance = parseFloat(balances.usdc || '0');
            const requiredGasReserve = 0.05;

            let executableAmount = parseFloat(actionAmount);
            if (currentUsdcBalance < requiredGasReserve) {
              throw new Error(`Insufficient USDC balance on Arc Testnet wallet for gas reserve. Available: ${currentUsdcBalance.toFixed(4)} USDC, Required Gas Reserve: ${requiredGasReserve} USDC.`);
            }

            if (currentUsdcBalance < executableAmount + requiredGasReserve) {
              executableAmount = Math.max(0.0001, currentUsdcBalance - requiredGasReserve);
              console.log(`[GAS RESERVE GUARD] Capped send amount from ${actionAmount} to ${executableAmount.toFixed(6)} USDC to preserve ${requiredGasReserve} USDC gas reserve.`);
            }

            const finalAmountStr = executableAmount.toFixed(6);

            // Emit immediate RUNNING log before App Kit send call
            await updateLog({
              stepId: node.id,
              nodeType: 'send',
              nodeName: nodeData.label || 'Send Action',
              status: 'RUNNING',
              details: `Submitting ${finalAmountStr} USDC transfer to ${destinationAddress} on Arc Testnet...`,
            });

            let realTxHash = '';
            if (process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET) {
              try {
                const res: any = await executeAppKitSend({
                  userWalletAddress: walletAddress,
                  walletId,
                  destinationAddress,
                  amountUsdc: finalAmountStr,
                });
                realTxHash = res?.txHash || res?.id || res?.transactionHash || res?.steps?.find((s: any) => s.txHash)?.txHash || '';
              } catch (appKitErr) {
                // Fallback to Developer Controlled Wallet transfer API if direct App Kit send adapter is busy
                realTxHash = (await sendArcTransfer({
                  walletId,
                  destinationAddress,
                  amountUsdc: finalAmountStr,
                })) || '';
              }
            } else {
              throw new Error('CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET missing in environment');
            }

            if (!realTxHash) {
              await updateLog({
                stepId: node.id,
                nodeType: 'send',
                nodeName: nodeData.label || 'Send Action',
                status: 'FAILED',
                error: `Send failed: no valid transaction hash returned from Circle App Kit.`,
              });
            } else {
              // Persist txHash immediately to DB as PARTIAL to secure idempotency before any secondary operations
              await updateLog({
                stepId: node.id,
                nodeType: 'send',
                nodeName: nodeData.label || 'Send Action',
                status: 'PARTIAL',
                txHash: realTxHash,
                details: `Transfer submitted on Arc Testnet (tx: ${realTxHash})...`,
              });

              await updateLog({
                stepId: node.id,
                nodeType: 'send',
                nodeName: nodeData.label || 'Send Action',
                status: 'COMPLETE',
                txHash: realTxHash,
                details: `Sent ${actionAmount} USDC to ${destinationAddress} on Arc Testnet`,
              });
            }
          } else if (nodeType === 'notify') {
            const webhookUrl = nodeData.webhookUrl;
            const template = nodeData.template || 'Delta Alert: {{amount}} USDC processed. Tx: {{txHash}}';

            await updateLog({
              stepId: node.id,
              nodeType: 'notify',
              nodeName: nodeData.label || 'Log Notification',
              status: 'RUNNING',
              details: `Preparing webhook notification dispatch...`,
            });

            let message = template
              .replace('{{amount}}', triggerAmount)
              .replace('{{txHash}}', triggerTxHash)
              .replace('{{step}}', nodeData.label || 'Automation');

            if (webhookUrl) {
              const urlValidation = await validateWebhookUrl(webhookUrl);
              if (!urlValidation.valid) {
                const blockReason = urlValidation.reason || 'Blocked: unsafe webhook URL';
                await updateLog({
                  stepId: node.id,
                  nodeType: 'notify',
                  nodeName: nodeData.label || 'Log Notification',
                  status: 'FAILED',
                  error: blockReason,
                  details: blockReason,
                });
                return;
              }

              try {
                await fetch(webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    event: 'workflow.step.executed',
                    workflowId,
                    message,
                    amount: actionAmount,
                    txHash: triggerTxHash,
                  }),
                });
              } catch (webhookErr: any) {
                console.warn('Webhook notification dispatch error:', webhookErr.message);
              }
            }

            await updateLog({
              stepId: node.id,
              nodeType: 'notify',
              nodeName: nodeData.label || 'Log Notification',
              status: 'COMPLETE',
              details: `Sent webhook alert: "${message}"`,
            });
          }
        } catch (err: any) {
          await updateLog({
            stepId: node.id,
            nodeType: node.type,
            nodeName: nodeData.label || node.type.toUpperCase(),
            status: 'FAILED',
            error: err.message || String(err),
          });
        }
      });
    }

    // 4. Mark execution complete
    await step.run('finalize-execution', async () => {
      const finalExecution = await prisma.execution.findUnique({
        where: { id: execution.id },
      });

      const logs = typeof finalExecution?.stepLogs === 'string'
        ? JSON.parse(finalExecution.stepLogs)
        : (finalExecution?.stepLogs || []);

      const hasFailed = logs.some((s: any) => s.status === 'FAILED');

      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: hasFailed ? 'FAILED' : 'COMPLETE',
          finishedAt: new Date(),
        },
      });
    });

    return { status: 'SUCCESS', executionId: execution.id };
  }
);
