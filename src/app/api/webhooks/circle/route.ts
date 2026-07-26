import { NextRequest, NextResponse } from 'next/server';
import { verifyCircleWebhookSignature } from '@/lib/circle/webhook';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';

export async function POST(req: NextRequest) {
  try {
    // 1. Obtain raw, unparsed request string from req.text() BEFORE JSON.parse
    const rawRequestBody = await req.text();
    const signatureHeader = req.headers.get('x-circle-signature');
    const keyIdHeader = req.headers.get('x-circle-key-id');

    console.log('\n===========================================================');
    console.log('[DEBUG WEBHOOK] Incoming Request Received!');
    console.log('[DEBUG WEBHOOK] X-Circle-Key-Id:', keyIdHeader);
    console.log('[DEBUG WEBHOOK] X-Circle-Signature (Base64):', signatureHeader ? signatureHeader.substring(0, 35) + '...' : 'NONE');

    // 2. Cryptographic signature verification (v2 ECDSA SHA-256)
    const verification = await verifyCircleWebhookSignature({
      rawRequestBody,
      signatureHeader,
      keyIdHeader,
    });

    console.log('[DEBUG WEBHOOK] Cryptographic Verification Result (isValid):', verification.isValid);

    if (!verification.isValid) {
      console.error('[DEBUG WEBHOOK] Verification Rejected Reason:', verification.reason);
      console.log('===========================================================\n');
      return NextResponse.json({ error: verification.reason || 'Invalid webhook signature' }, { status: 401 });
    }

    console.log('===========================================================\n');

    // 3. Parse JSON only AFTER signature verification succeeds
    const payload = JSON.parse(rawRequestBody);
    const notificationType = payload.notificationType;

    // Process inbound transaction notifications
    if (notificationType === 'transactions' || notificationType === 'inboundTransfers') {
      const eventData = payload.event || payload.notification || payload;
      const transferState = eventData.state || eventData.status;
      const destinationAddress = (eventData.destinationAddress || eventData.to || '').toLowerCase();
      const amounts = eventData.amounts || [eventData.amount || '0'];
      const transferAmountStr = String(amounts[0] || '0');
      const transferAmount = parseFloat(transferAmountStr);
      const txHash = eventData.txHash || eventData.transactionHash || eventData.id || '0x-webhook-tx';

      if (transferState === 'COMPLETE' && destinationAddress) {
        // Find matching user wallet in DB
        const wallet = await prisma.wallet.findFirst({
          where: {
            address: {
              equals: destinationAddress,
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
                // Trigger Inngest workflow background job
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
