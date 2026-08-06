import { NextRequest, NextResponse } from 'next/server';
import { verifyCircleWebhookSignature } from '@/lib/circle/webhook';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';
import { sendExecutionNotificationEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    // 1. Obtain raw, unparsed request string from req.text() BEFORE JSON.parse
    const rawRequestBody = await req.text();
    let payload: any = {};
    try {
      payload = JSON.parse(rawRequestBody);
    } catch (e) {
      // Non-JSON payload
    }

    // Handle AWS SNS / Circle SubscriptionConfirmation Handshake BEFORE signature check
    if (payload.Type === 'SubscriptionConfirmation' || payload.SubscribeURL) {
      console.log('[CIRCLE WEBHOOK] Handling SubscriptionConfirmation handshake...');
      if (payload.SubscribeURL) {
        try {
          await fetch(payload.SubscribeURL);
          console.log('✅ Circle Webhook Subscription confirmed via SubscribeURL:', payload.SubscribeURL);
        } catch (confirmErr: any) {
          console.error('❌ Failed to confirm SubscribeURL:', confirmErr.message);
        }
      }
      return NextResponse.json({ success: true, message: 'SubscriptionConfirmed' });
    }

    const signatureHeader = req.headers.get('x-circle-signature');
    const keyIdHeader = req.headers.get('x-circle-key-id');

    logger.debug('[WEBHOOK] Incoming Request Received!');
    logger.debug('[WEBHOOK] KeyId:', keyIdHeader);

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

    // 3. Parse JSON payload (already parsed at top)
    const notificationType = payload.notificationType || '';

    logger.debug('[WEBHOOK] notificationType:', notificationType);

    const eventData = payload.notification || payload.event || payload;
    const rawTxType = (eventData.transactionType || eventData.type || eventData.operation || eventData.direction || '').toUpperCase();

    // Match inbound notifications across both DCW (transfers.update) and Core API (transactions.inbound)
    const isMatchingType =
      notificationType.includes('inbound') ||
      notificationType.includes('transfers') ||
      notificationType.includes('transactions') ||
      rawTxType === 'INBOUND';

    if (isMatchingType) {
      if (rawTxType === 'OUTBOUND' || rawTxType.includes('SWAP') || rawTxType.includes('INTERNAL')) {
        logger.debug('[WEBHOOK] Ignored OUTBOUND/SWAP/INTERNAL transaction to prevent self-trigger loop');
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
        logger.debug(`[WEBHOOK] Ignored non-USDC inbound transfer (token: ${tokenSymbol || tokenAddress}) to prevent swap loop.`);
        return NextResponse.json({ success: true, message: 'Ignored non-USDC inbound transfer' });
      }

      const transferState = (eventData.state || eventData.status || 'COMPLETE').toUpperCase();
      const destinationAddress = (
        eventData.destinationAddress ||
        eventData.to ||
        eventData.address ||
        ''
      ).toLowerCase();

      const sourceAddress = (
        eventData.sourceAddress ||
        eventData.from ||
        eventData.sender ||
        eventData.fromAddress ||
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
        logger.debug(`[WEBHOOK] Ignored duplicate txHash: ${txHash}`);
        return NextResponse.json({ success: true, message: 'Transaction already processed' });
      }

      logger.debug('[WEBHOOK] Matched INBOUND USDC payload fields:');
      logger.debug('   walletId:', walletId);
      logger.debug('   destinationAddress:', destinationAddress);
      logger.debug('   sourceAddress:', sourceAddress);
      logger.debug('   transferAmountStr:', transferAmountStr);

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
          // FIX D: IGNORE SENDER IF IT MATCHES USER'S OWN CUSTODIAL WALLET OR ADAPTER
          const userWalletAddr = wallet.address.toLowerCase();
          if (sourceAddress && (sourceAddress === userWalletAddr || sourceAddress === destinationAddress)) {
            logger.debug(`[WEBHOOK] Ignored transfer originating from user's own wallet/adapter (${sourceAddress})`);
            return NextResponse.json({ success: true, message: 'Ignored internal wallet/adapter transfer' });
          }

          logger.debug(`[WEBHOOK] Found Wallet in DB! Address: ${wallet.address} | Workflows: ${wallet.user.workflows.length}`);
          let triggeredCount = 0;

          for (const workflow of wallet.user.workflows) {
            // ACTIVE EXECUTION GUARD: Check if workflow currently has an active PENDING or RUNNING execution
            // Replaces fixed 120s cooldown with real state check. Once COMPLETE/FAILED, workflow can immediately re-trigger.
            // STALE_EXECUTION_TIMEOUT_MS (30m) acts as a safety valve in case of unhandled engine crashes.
            const STALE_EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;

            const activeExecution = await prisma.execution.findFirst({
              where: {
                workflowId: workflow.id,
                status: { in: ['PENDING', 'RUNNING'] },
                startedAt: { gt: new Date(Date.now() - STALE_EXECUTION_TIMEOUT_MS) },
              },
            });

            if (activeExecution) {
              logger.debug(
                `[WEBHOOK] Workflow ${workflow.id} already has an active execution (${activeExecution.id}, status=${activeExecution.status}, started ${activeExecution.startedAt}). Skipping trigger until complete.`
              );
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
                logger.debug(`[WEBHOOK] Triggering Workflow ID: ${workflow.id}`);

                // 1. Create DB execution record
                const execution = await prisma.execution.create({
                  data: {
                    workflowId: workflow.id,
                    triggerTxHash: txHash,
                    triggerAmount: transferAmountStr,
                    status: 'RUNNING',
                    stepLogs: [
                      {
                        stepId: triggerNode?.id || 'trigger-1',
                        nodeType: 'trigger',
                        nodeName: triggerNode?.data?.label || 'USDC Received',
                        status: 'COMPLETE',
                        txHash: txHash,
                        details: `Triggered by transfer of ${transferAmountStr} USDC`,
                        timestamp: new Date().toISOString(),
                      },
                    ],
                    startedAt: new Date(),
                  },
                });

                // 2. Dispatch event to Inngest engine
                const inngestRes = await inngest.send({
                  name: 'workflow.trigger',
                  data: {
                    executionId: execution.id,
                    workflowId: workflow.id,
                    triggerTxHash: txHash,
                    triggerAmount: transferAmountStr,
                    walletAddress: wallet.address,
                    walletId: wallet.circleWalletId,
                  },
                });

                console.log(`✅ Webhook execution ${execution.id} dispatched to Inngest engine. Event IDs: ${JSON.stringify(inngestRes?.ids || [])}`);
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
