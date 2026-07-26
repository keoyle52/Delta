import { NextRequest, NextResponse } from 'next/server';
import { verifyCircleWebhookSignature } from '@/lib/circle/webhook';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';
import { executeAppKitSwap, executeAppKitBridge, executeAppKitSend } from '@/lib/circle/app-kit';

export async function POST(req: NextRequest) {
  try {
    // 1. Obtain raw, unparsed request string from req.text() BEFORE JSON.parse
    const rawRequestBody = await req.text();
    const signatureHeader = req.headers.get('x-circle-signature');
    const keyIdHeader = req.headers.get('x-circle-key-id');

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
    const notificationType = payload.notificationType;

    // Accept Circle notification types: 'transfers', 'transactions', 'inboundTransfers', 'settlements'
    const validNotificationTypes = ['transfers', 'transactions', 'inboundTransfers', 'settlements'];
    const isMatchingType = !notificationType || validNotificationTypes.includes(notificationType);

    if (isMatchingType) {
      const eventData = payload.event || payload.notification || payload;
      const transferState = (eventData.state || eventData.status || 'COMPLETE').toUpperCase();
      const destinationAddress = (
        eventData.destinationAddress ||
        eventData.to ||
        eventData.address ||
        ''
      ).toLowerCase();

      const amounts = eventData.amounts || [eventData.amount || '0'];
      const transferAmountStr = String(amounts[0] || '0');
      const transferAmount = parseFloat(transferAmountStr);
      const txHash = eventData.txHash || eventData.transactionHash || eventData.id || `0x-webhook-${Date.now()}`;

      if ((transferState === 'COMPLETE' || transferState === 'SUCCESS' || transferState === 'CONFIRMED') && destinationAddress) {
        // Find matching custodial wallet in DB (case-insensitive mode)
        const wallet = await prisma.wallet.findFirst({
          where: {
            address: {
              equals: destinationAddress,
              mode: 'insensitive',
            },
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
          let triggeredCount = 0;

          for (const workflow of wallet.user.workflows) {
            const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
            const triggerNode = nodes.find((n: any) => n.type === 'trigger');

            if (triggerNode) {
              const minAmount = parseFloat(triggerNode.data?.minAmount || '0');
              const maxAmount = triggerNode.data?.maxAmount
                ? parseFloat(triggerNode.data.maxAmount)
                : Infinity;

              if (transferAmount >= minAmount && transferAmount <= maxAmount) {
                let sentToInngest = false;

                // Try sending event to Inngest primary queue
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
                  sentToInngest = true;
                  console.log('✅ Inngest event dispatched successfully to primary queue.');
                } catch (inngestErr: any) {
                  console.warn('⚠️ INNGEST UNAVAILABLE — falling back to direct execution, durability/retry disabled for this run:', inngestErr.message);
                }

                // Direct background execution fallback if Inngest runner is offline or unconfigured
                if (!sentToInngest) {
                  executeWorkflowDirectly({
                    workflowId: workflow.id,
                    triggerTxHash: txHash,
                    triggerAmount: transferAmountStr,
                    walletAddress: wallet.address,
                    walletId: wallet.circleWalletId,
                  }).catch((err) => console.error('Direct workflow execution error:', err));
                }

                triggeredCount++;
              }
            }
          }

          return NextResponse.json({
            success: true,
            message: `Processed transfer of ${transferAmountStr} USDC to ${destinationAddress}`,
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
 * Direct workflow execution fallback runner when Inngest runner is offline or unconfigured
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

  const outgoingEdges = edges.filter((e: any) => e.source === triggerNode.id);
  const targetNodeIds = outgoingEdges.map((e: any) => e.target);
  const actionNodes = nodes.filter((n: any) => targetNodeIds.includes(n.id));

  const totalAmount = parseFloat(triggerAmount);
  let hasFailed = false;

  for (const node of actionNodes) {
    const percentage = parseFloat(node.data?.percentage || '0');
    const actionAmount = ((totalAmount * percentage) / 100).toFixed(6);

    try {
      if (node.type === 'swap') {
        const tokenOut = node.data?.tokenOut || 'EURC';
        const res: any = await executeAppKitSwap({
          userWalletAddress: walletAddress,
          walletId,
          amountUsdc: actionAmount,
          tokenOut,
        });

        stepLogs.push({
          stepId: node.id,
          nodeType: 'swap',
          nodeName: node.data?.label || 'Swap Action',
          status: 'COMPLETE',
          txHash: res?.txHash || res?.id || '0x-swap-complete',
          details: `Swapped ${actionAmount} USDC to ${tokenOut}`,
          timestamp: new Date().toISOString(),
        });
      } else if (node.type === 'bridge') {
        const res: any = await executeAppKitBridge({
          userWalletAddress: walletAddress,
          destinationAddress: node.data?.destinationAddress,
          amountUsdc: actionAmount,
        });

        stepLogs.push({
          stepId: node.id,
          nodeType: 'bridge',
          nodeName: node.data?.label || 'Bridge Action',
          status: 'COMPLETE',
          txHash: res?.txHash || res?.id || '0x-bridge-complete',
          details: `Bridged ${actionAmount} USDC to Solana Devnet`,
          timestamp: new Date().toISOString(),
        });
      } else if (node.type === 'send') {
        const res: any = await executeAppKitSend({
          userWalletAddress: walletAddress,
          destinationAddress: node.data?.destinationAddress,
          amountUsdc: actionAmount,
        });

        stepLogs.push({
          stepId: node.id,
          nodeType: 'send',
          nodeName: node.data?.label || 'Send Action',
          status: 'COMPLETE',
          txHash: res?.txHash || res?.id || '0x-send-complete',
          details: `Sent ${actionAmount} USDC to ${node.data?.destinationAddress}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      hasFailed = true;
      stepLogs.push({
        stepId: node.id,
        nodeType: node.type,
        nodeName: node.data?.label || node.type.toUpperCase(),
        status: 'FAILED',
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      });
      break;
    }
  }

  await prisma.execution.update({
    where: { id: execution.id },
    data: {
      status: hasFailed ? 'FAILED' : 'COMPLETE',
      finishedAt: new Date(),
      stepLogs: stepLogs as any,
    },
  });
}
