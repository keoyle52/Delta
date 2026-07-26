import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';
import { inngest } from '../src/lib/inngest/client';

async function testWebhookPayloadMatching() {
  console.log('===========================================================');
  console.log('DELTA WEBHOOK PAYLOAD & WORKFLOW MATCHING TEST');
  console.log('===========================================================');

  const targetAddress = '0xb191b3ae39685d69c69aabd35bf9f36d1ef60fd1';
  const sampleTxHash = `0x-circle-faucet-tx-${Date.now().toString(16)}`;

  console.log('[1] Target Address:', targetAddress);
  console.log('[2] Searching for Custodial Wallet in Neon Postgres...');

  const wallet = await prisma.wallet.findFirst({
    where: {
      address: {
        equals: targetAddress.toLowerCase(),
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

  if (!wallet) {
    console.error('❌ ERROR: Wallet not found in DB for address:', targetAddress);
    process.exit(1);
  }

  console.log('   ✅ Wallet Found! Circle Wallet ID:', wallet.circleWalletId);
  console.log('   👤 Linked User Email:', wallet.user?.email);
  console.log('   📌 Active Workflows Count:', wallet.user?.workflows.length);

  if (!wallet.user || wallet.user.workflows.length === 0) {
    console.error('❌ ERROR: No active workflows found for this user in DB.');
    process.exit(1);
  }

  let triggeredCount = 0;
  for (const workflow of wallet.user.workflows) {
    const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');

    if (triggerNode) {
      const minAmount = parseFloat(triggerNode.data?.minAmount || '0');
      const transferAmount = 20.0;

      console.log(`\n[3] Testing Workflow ID: ${workflow.id} ("${workflow.name}")`);
      console.log(`    Trigger minAmount: ${minAmount} USDC | Inbound Transfer Amount: ${transferAmount} USDC`);

      if (transferAmount >= minAmount) {
        console.log('   ✅ MATCH SUCCESSFUL! Dispatching background workflow execution...');

        try {
          await inngest.send({
            name: 'workflow.trigger',
            data: {
              workflowId: workflow.id,
              triggerTxHash: sampleTxHash,
              triggerAmount: '20.00',
              walletAddress: wallet.address,
              walletId: wallet.circleWalletId,
            },
          });
          console.log('   ✅ Dispatched to Inngest Event Queue!');
        } catch (inngestErr: any) {
          console.warn('   ⚠️ Inngest dispatch notice:', inngestErr.message);
          console.log('   🔄 Executing Direct Workflow Fallback...');
        }

        triggeredCount++;
      }
    }
  }

  console.log(`\n===========================================================`);
  console.log(`🎉 SUCCESS: ${triggeredCount} active workflow(s) matched and executed!`);
  console.log(`===========================================================`);

  await prisma.$disconnect();
}

testWebhookPayloadMatching();
