import { NextRequest, NextResponse } from 'next/server';
import { verifyCircleWebhookSignature } from '@/lib/circle/webhook';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';
import { executeAppKitSwap, executeAppKitBridge, executeAppKitSend } from '@/lib/circle/app-kit';
import { sendExecutionNotificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    // 1. Obtain raw, unparsed request string from req.text() BEFORE JSON.parse
    const rawRequestBody = await req.text();
    const signatureHeader = req.headers.get('x-circle-signature');
    const keyIdHeader = req.headers.get('x-circle-key-id');

    console.log('[DEBUG WEBHOOK] Incoming Request Received!');
    console.log('[DEBUG WEBHOOK] KeyId:', keyIdHeader);

    // 2. Cryptographic signature verification (v2 ECDSA SHA-256)
    const verification = await verifyCircleWebhookSignature({
      rawRequestBody,
      signatureHeader,
      keyIdHeader,
    });

    if (!verification.isValid) {
      console.error('Circle Webhook Verification Rejected:', verification.reason);
      return NextResponse.json({ error: verification.reason || 'Invalid webhook signature' }, { status: 401 });
    }

    // 3. Parse JSON payload
    const payload = JSON.parse(rawRequestBody);
    const notificationType = payload.notificationType || '';

    console.log('[DEBUG WEBHOOK] notificationType:', notificationType);

    // FIX A: STRICT INBOUND ONLY MATCHING (Reject outbound transfers to prevent self-trigger loop)
    const isMatchingType =
      notificationType === 'transactions.inbound' ||
      notificationType.endsWith('.inbound') ||
      (notificationType.includes('inbound') && !notificationType.includes('outbound'));

    if (isMatchingType) {
      const eventData = payload.notification || payload.event || payload;
      const transactionType = (eventData.transactionType || eventData.type || eventData.operation || '').toUpperCase();

      if (transactionType && (transactionType === 'OUTBOUND' || transactionType.includes('SWAP') || transactionType.includes('INTERNAL'))) {
        console.log('[DEBUG WEBHOOK] Ignored OUTBOUND/SWAP/INTERNAL transaction to prevent self-trigger loop');
        return NextResponse.json({ success: true, message: 'Ignored non-inbound or swap transaction' });
      }

      // FIX B: STRICT TOKEN FILTERING (Reject EURC and non-USDC inbound transfers to prevent swap loop)
      const tokenSymbol = (
        eventData.tokenSymbol ||
        eventData.symbol ||
        eventData.currency ||
        eventData.token ||
        ''
      ).toUpperCase();

      const tokenAddress = (
        eventData.tokenAddress ||
        eventData.contractAddress ||
        eventData.tokenId ||
        ''
      ).toLowerCase();

      const isEurc =
        tokenSymbol === 'EURC' ||
        tokenAddress === '0x89b50855aa3be2f677cd6303cec089b5f319d72a';

      if (isEurc || (tokenSymbol && tokenSymbol !== 'USDC' && tokenSymbol !== 'USD')) {
        console.log(`[DEBUG WEBHOOK] Ignored non-USDC inbound transfer (token: ${tokenSymbol || tokenAddress}) to prevent swap loop.`);
        return NextResponse.json({ success: true, message: 'Ignored non-USDC inbound transfer' });
      }

      const transferState = (eventData.state || eventData.status || 'COMPLETE').toUpperCase();
      const destinationAddress = (
        eventData.destinationAddress ||
        eventData.to ||
        eventData.address ||
        ''
      ).toLowerCase();

      const walletId = eventData.walletId || '';
      const amounts = eventData.amounts || [eventData.amount || '0'];
      const transferAmountStr = String(amounts[0] || '0');
      const transferAmount = parseFloat(transferAmountStr);
      const txHash = eventData.txHash || eventData.transactionHash || eventData.id || `0x-webhook-${Date.now()}`;

      // FIX C: DEDUPLICATION CHECK BY TX HASH
      const existingExecution = await prisma.execution.findFirst({
        where: { triggerTxHash: txHash },
      });

      if (existingExecution) {
        console.log(`[DEBUG WEBHOOK] Ignored duplicate txHash: ${txHash}`);
        return NextResponse.json({ success: true, message: 'Transaction already processed' });
      }

      console.log('[DEBUG WEBHOOK] Matched INBOUND USDC payload fields:');
      console.log('   walletId:', walletId);
      console.log('   destinationAddress:', destinationAddress);
      console.log('   transferAmountStr:', transferAmountStr);

      if ((transferState === 'COMPLETE' || transferState === 'SUCCESS' || transferState === 'CONFIRMED')) {
        // Find matching custodial wallet in DB by address OR by circleWalletId
        const wallet = await prisma.wallet.findFirst({
          where: {
            OR: [
              ...(destinationAddress ? [{ address: { equals: destinationAddress, mode: 'insensitive' as const } }] : []),
              ...(walletId ? [{ circleWalletId: { equals: walletId } }] : []),
            ],
          },
          include: {
            user: {
              include: {
                workflows: {
                  where: { isActive: true },
                },
              },
            },
          },
        });

        if (wallet && wallet.user && wallet.user.workflows.length > 0) {
          console.log(`[DEBUG WEBHOOK] Found Wallet in DB! Address: ${wallet.address} | Workflows: ${wallet.user.workflows.length}`);
          let triggeredCount = 0;

          for (const workflow of wallet.user.workflows) {
            // FIX D: 30-SECOND WORKFLOW COOLDOWN GUARD (Prevents rapid loop re-triggers)
            const recentExecution = await prisma.execution.findFirst({
              where: {
                workflowId: workflow.id,
                startedAt: {
                  gt: new Date(Date.now() - 30 * 1000), // 30 second cooldown
                },
              },
            });

            if (recentExecution) {
              console.log(`[DEBUG WEBHOOK] Workflow ${workflow.id} is on 30s cooldown. Skipping trigger.`);
              continue;
            }

            const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
            const triggerNode = nodes.find((n: any) => n.type === 'trigger');

            if (triggerNode) {
              const minAmount = parseFloat(triggerNode.data?.minAmount || '0');
              const maxAmount = triggerNode.data?.maxAmount
                ? parseFloat(triggerNode.data.maxAmount)
                : Infinity;

              if (transferAmount >= minAmount && transferAmount <= maxAmount) {
                console.log(`[DEBUG WEBHOOK] Triggering Workflow ID: ${workflow.id}`);

                // 1. Send event to Inngest for logging/durability tracking (non-blocking)
                try {
                  await inngest.send({
                    name: 'workflow.trigger',
                    data: {
                      workflowId: workflow.id,
                      triggerTxHash: txHash,
                      triggerAmount: transferAmountStr,
                      walletAddress: wallet.address,
                      walletId: wallet.circleWalletId,
                    },
                  });
                  console.log('✅ Event sent to Inngest (informational, not blocking)');
                } catch (inngestErr: any) {
                  console.warn('Inngest send failed (informational, not blocking):', inngestErr.message);
                }

                // 2. ALWAYS execute workflow directly to guarantee instant execution & DB logs
                executeWorkflowDirectly({
                  workflowId: workflow.id,
                  triggerTxHash: txHash,
                  triggerAmount: transferAmountStr,
                  walletAddress: wallet.address,
                  walletId: wallet.circleWalletId,
                }).catch((err) => console.error('Direct workflow execution error:', err));

                triggeredCount++;
              }
            }
          }

          return NextResponse.json({
            success: true,
            message: `Processed transfer of ${transferAmountStr} USDC to ${destinationAddress || walletId}`,
            triggeredWorkflows: triggeredCount,
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook received' });
  } catch (error: any) {
    console.error('Circle Webhook Processing Error:', error);
    return NextResponse.json(
      { error: `Webhook processing error: ${error.message || error}` },
      { status: 500 }
    );
  }
}

/**
 * BFS Traversal to find all action nodes transitively reachable from the trigger node
 */
function getReachableActionNodes(triggerNodeId: string, nodes: any[], edges: any[]) {
  const visited = new Set<string>();
  const queue = [triggerNodeId];
  const orderedActionNodes: any[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const outgoing = edges.filter((e: any) => e.source === currentId);
    for (const edge of outgoing) {
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        const node = nodes.find((n: any) => n.id === edge.target);
        if (node && node.type !== 'trigger') {
          orderedActionNodes.push(node);
          queue.push(node.id);
        }
      }
    }
  }
  return orderedActionNodes;
}

/**
 * Direct workflow execution runner with resilient step-by-step isolation, BFS chained node execution, and strict transaction hash validation
 */
async function executeWorkflowDirectly({
  workflowId,
  triggerTxHash,
  triggerAmount,
  walletAddress,
  walletId,
}: {
  workflowId: string;
  triggerTxHash: string;
  triggerAmount: string;
  walletAddress: string;
  walletId: string;
}) {
  const execution = await prisma.execution.create({
    data: {
      workflowId,
      triggerTxHash,
      triggerAmount,
      status: 'RUNNING',
      stepLogs: [],
      startedAt: new Date(),
    },
  });

  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) return;

  const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
  const edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : (workflow.edges || []);
  const triggerNode = nodes.find((n: any) => n.type === 'trigger');
  if (!triggerNode) return;

  const stepLogs: any[] = [
    {
      stepId: triggerNode.id,
      nodeType: 'trigger',
      nodeName: triggerNode.data?.label || 'USDC Received',
      status: 'COMPLETE',
      txHash: triggerTxHash,
      details: `Triggered by transfer of ${triggerAmount} USDC`,
      timestamp: new Date().toISOString(),
    },
  ];

  const updateExecutionLogs = async () => {
    await prisma.execution.update({
      where: { id: execution.id },
      data: { stepLogs: stepLogs as any },
    });
  };

  await updateExecutionLogs();

  // Transitive graph traversal (BFS) to execute all chained downstream nodes
  const actionNodes = getReachableActionNodes(triggerNode.id, nodes, edges);
  const totalAmount = parseFloat(triggerAmount);
  let hasNotifyNode = false;

  for (const node of actionNodes) {
    const percentage = parseFloat(node.data?.percentage || '40');
    const actionAmount = ((totalAmount * percentage) / 100).toFixed(6);

    console.error(`[AMOUNT DEBUG] Node ${node.id} (${node.type}): raw percentage data = ${JSON.stringify(node.data?.percentage)}, parsed = ${percentage}, totalAmount = ${totalAmount}, actionAmount = ${actionAmount}`);

    if (parseFloat(actionAmount) <= 0) {
      stepLogs.push({
        stepId: node.id,
        nodeType: node.type,
        nodeName: node.data?.label || node.type.toUpperCase(),
        status: 'SKIPPED',
        details: `Skipped action: percentage is 0 or allocation amount is ${actionAmount} USDC`,
        timestamp: new Date().toISOString(),
      });
      await updateExecutionLogs();
      continue;
    }

    try {
      if (node.type === 'swap') {
        const tokenOut = node.data?.tokenOut || 'EURC';
        const res: any = await executeAppKitSwap({
          userWalletAddress: walletAddress,
          walletId,
          amountUsdc: actionAmount,
          tokenOut,
        });

        const realTxHash = res?.txHash || res?.id || res?.transactionHash || res?.steps?.find((s: any) => s.txHash)?.txHash;

        if (!realTxHash) {
          stepLogs.push({
            stepId: node.id,
            nodeType: 'swap',
            nodeName: node.data?.label || 'Swap Action',
            status: 'FAILED',
            error: `Swap failed: no valid transaction hash returned from Circle App Kit. State: ${res?.state || 'unknown'}`,
            timestamp: new Date().toISOString(),
          });
        } else {
          stepLogs.push({
            stepId: node.id,
            nodeType: 'swap',
            nodeName: node.data?.label || 'Swap Action',
            status: 'COMPLETE',
            txHash: realTxHash,
            details: `Swapped ${actionAmount} USDC to ${tokenOut}`,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (node.type === 'bridge') {
        const destinationAddress = node.data?.destinationAddress;
        if (!destinationAddress || destinationAddress.length < 32) {
          throw new Error(`Invalid Solana destination address: "${destinationAddress || ''}"`);
        }

        const res: any = await executeAppKitBridge({
          userWalletAddress: walletAddress,
          destinationAddress,
          amountUsdc: actionAmount,
        });

        const burnStep = res?.steps?.find((s: any) => s.name === 'burn');
        const mintStep = res?.steps?.find((s: any) => s.name === 'mint');
        const realTxHash = burnStep?.txHash || res?.txHash || res?.steps?.find((s: any) => s.txHash)?.txHash;

        if (!realTxHash) {
          stepLogs.push({
            stepId: node.id,
            nodeType: 'bridge',
            nodeName: node.data?.label || 'CCTP Bridge Action',
            status: 'FAILED',
            error: `Bridge failed: no valid burn transaction hash returned on Arc Testnet. State: ${res?.state || 'unknown'}`,
            timestamp: new Date().toISOString(),
          });
        } else if (mintStep?.state !== 'success') {
          stepLogs.push({
            stepId: node.id,
            nodeType: 'bridge',
            nodeName: node.data?.label || 'CCTP Bridge Action',
            status: 'PARTIAL',
            txHash: realTxHash,
            details: `Burn succeeded on Arc Testnet (source chain), but mint on Solana Devnet did not complete (relayer/attestation pending or failed).`,
            timestamp: new Date().toISOString(),
          });
        } else {
          const mintTxHash = mintStep?.txHash || realTxHash;
          stepLogs.push({
            stepId: node.id,
            nodeType: 'bridge',
            nodeName: node.data?.label || 'CCTP Bridge Action',
            status: 'COMPLETE',
            txHash: mintTxHash,
            details: `Bridged ${actionAmount} USDC to Solana Devnet successfully.`,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (node.type === 'send') {
        const destinationAddress = node.data?.destinationAddress;
        if (!destinationAddress || !destinationAddress.startsWith('0x')) {
          throw new Error(`Invalid EVM destination address: "${destinationAddress || ''}"`);
        }

        const res: any = await executeAppKitSend({
          userWalletAddress: walletAddress,
          destinationAddress,
          amountUsdc: actionAmount,
        });

        const realTxHash = res?.txHash || res?.id || res?.transactionHash || res?.steps?.find((s: any) => s.txHash)?.txHash;

        if (!realTxHash) {
          stepLogs.push({
            stepId: node.id,
            nodeType: 'send',
            nodeName: node.data?.label || 'Send Action',
            status: 'FAILED',
            error: `Send failed: no valid transaction hash returned from Circle App Kit. State: ${res?.state || 'unknown'}`,
            timestamp: new Date().toISOString(),
          });
        } else {
          stepLogs.push({
            stepId: node.id,
            nodeType: 'send',
            nodeName: node.data?.label || 'Send Action',
            status: 'COMPLETE',
            txHash: realTxHash,
            details: `Sent ${actionAmount} USDC to ${destinationAddress}`,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (node.type === 'hold') {
        stepLogs.push({
          stepId: node.id,
          nodeType: 'hold',
          nodeName: node.data?.label || 'Keep Remainder',
          status: 'COMPLETE',
          details: `Retained ${percentage}% (${actionAmount} USDC) safely in user wallet on Arc Testnet`,
          timestamp: new Date().toISOString(),
        });
      } else if (node.type === 'notify') {
        hasNotifyNode = true;
        stepLogs.push({
          stepId: node.id,
          nodeType: 'notify',
          nodeName: node.data?.label || 'Log Notification',
          status: 'COMPLETE',
          details: `Email notification triggered for ${node.data?.template || workflow.name}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      stepLogs.push({
        stepId: node.id,
        nodeType: node.type,
        nodeName: node.data?.label || node.type.toUpperCase(),
        status: 'FAILED',
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      });
    }

    await updateExecutionLogs();
  }

  const hasFailed = stepLogs.some((s) => s.status === 'FAILED');
  const finalStatus = hasFailed ? 'FAILED' : 'COMPLETE';

  await prisma.execution.update({
    where: { id: execution.id },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
      stepLogs: stepLogs as any,
    },
  });

  // ONLY send Resend Execution Alert Email if the workflow explicitly contains a 'notify' node
  if (hasNotifyNode) {
    try {
      const user = await prisma.user.findFirst({
        where: { workflows: { some: { id: workflowId } } },
      });

      if (user && user.email) {
        await sendExecutionNotificationEmail({
          to: user.email,
          workflowName: workflow.name,
          status: finalStatus,
          triggerAmount,
          stepLogs,
        });
      }
    } catch (emailErr: any) {
      console.warn('Resend notification dispatch notice:', emailErr.message);
    }
  }
}
