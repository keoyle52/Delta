import { inngest } from './client';
import { prisma } from '@/lib/prisma';
import { executeAppKitSwap, executeAppKitBridge, executeAppKitSend } from '@/lib/circle/app-kit';
import { sendArcTransfer } from '@/lib/circle/wallets';

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

        const updateLog = async (logEntry: any) => {
          logs.push(logEntry);
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
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const nodeType = node.type;
        const nodeData = node.data || {};

        try {
          if (nodeType === 'swap') {
            const tokenOut = nodeData.tokenOut || 'EURC';
            let txResult: any;

            if (process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET) {
              txResult = await executeAppKitSwap({
                userWalletAddress: walletAddress,
                walletId,
                amountUsdc: actionAmount,
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
                timestamp: new Date().toISOString(),
              });
            } else {
              await updateLog({
                stepId: node.id,
                nodeType: 'swap',
                nodeName: nodeData.label || 'Swap Action',
                status: 'COMPLETE',
                txHash: realTxHash,
                details: `Swapped ${actionAmount} USDC to ${tokenOut} on Arc Testnet`,
                timestamp: new Date().toISOString(),
              });
            }
          } else if (nodeType === 'bridge') {
            const destinationAddress = nodeData.destinationAddress;
            if (!destinationAddress) {
              throw new Error('Bridge node destinationAddress is required');
            }

            let txResult: any;
            if (process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET) {
              txResult = await executeAppKitBridge({
                userWalletAddress: walletAddress,
                destinationAddress,
                amountUsdc: actionAmount,
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
                error: `Bridge failed: no valid burn transaction hash returned on Arc Testnet. State: ${txResult?.state || 'unknown'}`,
                timestamp: new Date().toISOString(),
              });
            } else if (mintStep?.state !== 'success') {
              await updateLog({
                stepId: node.id,
                nodeType: 'bridge',
                nodeName: nodeData.label || 'CCTP Bridge Action',
                status: 'PARTIAL',
                txHash: realTxHash,
                details: `Burn succeeded on Arc Testnet (source chain), but mint on Solana Devnet did not complete (relayer/attestation pending or failed).`,
                timestamp: new Date().toISOString(),
              });
            } else {
              const mintTxHash = mintStep?.txHash || realTxHash;
              await updateLog({
                stepId: node.id,
                nodeType: 'bridge',
                nodeName: nodeData.label || 'CCTP Bridge Action',
                status: 'COMPLETE',
                txHash: mintTxHash,
                details: `Bridged ${actionAmount} USDC via CCTP to Solana Devnet recipient: ${destinationAddress}`,
                timestamp: new Date().toISOString(),
              });
            }
          } else if (nodeType === 'send') {
            const destinationAddress = nodeData.destinationAddress;
            if (!destinationAddress) {
              throw new Error('Send node destinationAddress is required');
            }

            let realTxHash = '';
            if (process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET) {
              try {
                const res: any = await executeAppKitSend({
                  userWalletAddress: walletAddress,
                  destinationAddress,
                  amountUsdc: actionAmount,
                });
                realTxHash = res?.txHash || res?.id || res?.transactionHash || res?.steps?.find((s: any) => s.txHash)?.txHash || '';
              } catch (appKitErr) {
                // Fallback to Developer Controlled Wallet transfer API if direct App Kit send adapter is busy
                realTxHash = (await sendArcTransfer({
                  walletId,
                  destinationAddress,
                  amountUsdc: actionAmount,
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
                timestamp: new Date().toISOString(),
              });
            } else {
              await updateLog({
                stepId: node.id,
                nodeType: 'send',
                nodeName: nodeData.label || 'Send Action',
                status: 'COMPLETE',
                txHash: realTxHash,
                details: `Sent ${actionAmount} USDC to ${destinationAddress} on Arc Testnet`,
                timestamp: new Date().toISOString(),
              });
            }
          } else if (nodeType === 'notify') {
            const webhookUrl = nodeData.webhookUrl;
            const template = nodeData.template || 'Delta Alert: {{amount}} USDC processed. Tx: {{txHash}}';

            let message = template
              .replace('{{amount}}', triggerAmount)
              .replace('{{txHash}}', triggerTxHash)
              .replace('{{step}}', nodeData.label || 'Automation');

            if (webhookUrl) {
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
              timestamp: new Date().toISOString(),
            });
          }
        } catch (err: any) {
          await updateLog({
            stepId: node.id,
            nodeType: node.type,
            nodeName: nodeData.label || node.type.toUpperCase(),
            status: 'FAILED',
            error: err.message || String(err),
            timestamp: new Date().toISOString(),
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
