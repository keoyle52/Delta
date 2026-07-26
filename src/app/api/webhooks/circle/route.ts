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

    // Accept Circle notification types: "transactions.inbound", "transactions.outbound", etc.
    const isMatchingType =
      !notificationType ||
      notificationType.startsWith('transactions.') ||
      notificationType.includes('inbound') ||
      notificationType.includes('transfer') ||
      notificationType === 'contracts.eventLog' ||
      notificationType.startsWith('modularWallet.');

    if (isMatchingType) {
      const eventData = payload.notification || payload.event || payload;
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

      console.log('[DEBUG WEBHOOK] Matched payload fields:');
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
 * Direct workflow execution runner with resilient step-by-step isolation
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

  const outgoingEdges = edges.filter((e: any) => e.source === triggerNode.id);
  const targetNodeIds = outgoingEdges.map((e: any) => e.target);
  const actionNodes = nodes.filter((n: any) => targetNodeIds.includes(n.id));

  const totalAmount = parseFloat(triggerAmount);

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
        const destinationAddress = node.data?.destinationAddress;
        if (!destinationAddress || destinationAddress.length < 32) {
          throw new Error(`Invalid Solana destination address: "${destinationAddress || ''}"`);
        }

        const res: any = await executeAppKitBridge({
          userWalletAddress: walletAddress,
          destinationAddress,
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
        const destinationAddress = node.data?.destinationAddress;
        if (!destinationAddress || !destinationAddress.startsWith('0x')) {
          throw new Error(`Invalid EVM destination address: "${destinationAddress || ''}"`);
        }

        const res: any = await executeAppKitSend({
          userWalletAddress: walletAddress,
          destinationAddress,
          amountUsdc: actionAmount,
        });

        stepLogs.push({
          stepId: node.id,
          nodeType: 'send',
          nodeName: node.data?.label || 'Send Action',
          status: 'COMPLETE',
          txHash: res?.txHash || res?.id || '0x-send-complete',
          details: `Sent ${actionAmount} USDC to ${destinationAddress}`,
          timestamp: new Date().toISOString(),
        });
      } else if (node.type === 'hold') {
        stepLogs.push({
          stepId: node.id,
          nodeType: 'hold',
          nodeName: node.data?.label || 'Keep Remainder',
          status: 'COMPLETE',
          details: `Retained ${percentage}% (${actionAmount} USDC) safely in user wallet on Arc Testnet`,
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
  await prisma.execution.update({
    where: { id: execution.id },
    data: {
      status: hasFailed ? 'FAILED' : 'COMPLETE',
      finishedAt: new Date(),
      stepLogs: stepLogs as any,
    },
  });
}
