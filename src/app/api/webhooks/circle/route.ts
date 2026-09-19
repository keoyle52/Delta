import { NextRequest, NextResponse } from 'next/server';
import { verifyCircleWebhookSignature } from '@/lib/circle/webhook';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';
import { logger } from '@/lib/logger';
import { Network, NetworkSchema, getNetworkConfig } from '@/config/network';

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

    // Determine environment from query parameter (?env=mainnet or ?env=testnet) or payload
    const { searchParams } = new URL(req.url);
    const envParam = searchParams.get('env') || searchParams.get('network');
    let network: Network = 'mainnet';

    if (envParam) {
      const parsed = NetworkSchema.safeParse(envParam);
      if (parsed.success) {
        network = parsed.data;
      }
    } else if (payload.notification?.blockchain === 'ARC-TESTNET' || payload.blockchain === 'ARC-TESTNET') {
      network = 'testnet';
    }

    const signatureHeader = req.headers.get('x-circle-signature');
    const keyIdHeader = req.headers.get('x-circle-key-id');

    logger.debug(`[WEBHOOK ${network.toUpperCase()}] Incoming Request Received!`);
    logger.debug(`[WEBHOOK ${network.toUpperCase()}] KeyId:`, keyIdHeader);

    // 2. Cryptographic signature verification (v2 ECDSA SHA-256) using network-specific public key
    let verification = await verifyCircleWebhookSignature({
      rawRequestBody,
      signatureHeader,
      keyIdHeader,
      network,
    });

    // If verification failed and env was not explicitly provided in URL, attempt other environment before rejecting
    if (!verification.isValid && !envParam) {
      const altNetwork: Network = network === 'mainnet' ? 'testnet' : 'mainnet';
      const altVerification = await verifyCircleWebhookSignature({
        rawRequestBody,
        signatureHeader,
        keyIdHeader,
        network: altNetwork,
      });
      if (altVerification.isValid) {
        network = altNetwork;
        verification = altVerification;
      }
    }

    if (!verification.isValid) {
      console.error(`Circle Webhook Verification Rejected on ${network}:`, verification.reason);
      return NextResponse.json({ error: verification.reason || 'Invalid webhook signature' }, { status: 401 });
    }

    const config = getNetworkConfig(network);

    // 3. Parse notification payload
    const notificationType = payload.notificationType || '';
    logger.debug(`[WEBHOOK ${network.toUpperCase()}] notificationType:`, notificationType);

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
        logger.debug(`[WEBHOOK ${network.toUpperCase()}] Ignored OUTBOUND/SWAP/INTERNAL transaction to prevent self-trigger loop`);
        return NextResponse.json({ success: true, message: 'Ignored non-inbound or swap transaction' });
      }

      // STRICT TOKEN FILTERING: Reject EURC and non-USDC inbound transfers to prevent swap loop
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
        tokenAddress === config.eurcAddress.toLowerCase();

      if (isEurc || (tokenSymbol && tokenSymbol !== 'USDC' && tokenSymbol !== 'USD')) {
        logger.debug(`[WEBHOOK ${network.toUpperCase()}] Ignored non-USDC inbound transfer (token: ${tokenSymbol || tokenAddress}) to prevent swap loop.`);
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

      // Deduplication check by triggerTxHash and network
      const existingExecution = await prisma.execution.findFirst({
        where: { triggerTxHash: txHash, network },
      });

      if (existingExecution) {
        logger.debug(`[WEBHOOK ${network.toUpperCase()}] Ignored duplicate txHash: ${txHash}`);
        return NextResponse.json({ success: true, message: 'Transaction already processed' });
      }

      logger.debug(`[WEBHOOK ${network.toUpperCase()}] Matched INBOUND USDC payload fields:`);
      logger.debug('   walletId:', walletId);
      logger.debug('   destinationAddress:', destinationAddress);
      logger.debug('   sourceAddress:', sourceAddress);
      logger.debug('   transferAmountStr:', transferAmountStr);

      if ((transferState === 'COMPLETE' || transferState === 'SUCCESS' || transferState === 'CONFIRMED')) {
        // Find matching custodial wallet in DB by address OR circleWalletId, strictly scoped by network
        const wallet = await prisma.wallet.findFirst({
          where: {
            network,
            OR: [
              ...(destinationAddress ? [{ address: { equals: destinationAddress, mode: 'insensitive' as const } }] : []),
              ...(walletId ? [{ circleWalletId: { equals: walletId } }] : []),
            ],
          },
          include: {
            user: {
              include: {
                workflows: {
                  where: { isActive: true, network },
                },
              },
            },
          },
        });

        if (wallet && wallet.user && wallet.user.workflows.length > 0) {
          // Ignore sender if it matches user's own custodial wallet
          const userWalletAddr = wallet.address.toLowerCase();
          if (sourceAddress && (sourceAddress === userWalletAddr || sourceAddress === destinationAddress)) {
            logger.debug(`[WEBHOOK ${network.toUpperCase()}] Ignored transfer originating from user's own wallet (${sourceAddress})`);
            return NextResponse.json({ success: true, message: 'Ignored internal wallet transfer' });
          }

          logger.debug(`[WEBHOOK ${network.toUpperCase()}] Found Wallet in DB! Address: ${wallet.address} | Workflows: ${wallet.user.workflows.length}`);
          let triggeredCount = 0;

          for (const workflow of wallet.user.workflows) {
            // Active execution guard per workflow
            const STALE_EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;

            const activeExecution = await prisma.execution.findFirst({
              where: {
                workflowId: workflow.id,
                network,
                status: { in: ['PENDING', 'RUNNING'] },
                startedAt: { gt: new Date(Date.now() - STALE_EXECUTION_TIMEOUT_MS) },
              },
            });

            if (activeExecution) {
              logger.debug(
                `[WEBHOOK ${network.toUpperCase()}] Workflow ${workflow.id} already has an active execution (${activeExecution.id}, status=${activeExecution.status}). Skipping trigger until complete.`
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
                logger.debug(`[WEBHOOK ${network.toUpperCase()}] Triggering Workflow ID: ${workflow.id}`);

                // 1. Create DB execution record with network
                const execution = await prisma.execution.create({
                  data: {
                    workflowId: workflow.id,
                    network,
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
                        details: `Triggered by transfer of ${transferAmountStr} USDC on ${network === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'}`,
                        timestamp: new Date().toISOString(),
                      },
                    ],
                    startedAt: new Date(),
                  },
                });

                // 2. Dispatch event to Inngest engine with network
                const inngestRes = await inngest.send({
                  name: 'workflow.trigger',
                  data: {
                    executionId: execution.id,
                    workflowId: workflow.id,
                    network,
                    triggerTxHash: txHash,
                    triggerAmount: transferAmountStr,
                    walletAddress: wallet.address,
                    walletId: wallet.circleWalletId,
                  },
                });

                console.log(`✅ Webhook execution ${execution.id} (${network}) dispatched to Inngest engine. Event IDs: ${JSON.stringify(inngestRes?.ids || [])}`);
                triggeredCount++;
              }
            }
          }

          return NextResponse.json({
            success: true,
            network,
            message: `Processed transfer of ${transferAmountStr} USDC to ${destinationAddress || walletId} on ${network}`,
            triggeredWorkflows: triggeredCount,
          });
        }
      }
    }

    return NextResponse.json({ success: true, network, message: 'Webhook received' });
  } catch (error: any) {
    console.error('Circle Webhook Processing Error:', error);
    return NextResponse.json(
      { error: `Webhook processing error: ${error.message || error}` },
      { status: 500 }
    );
  }
}
