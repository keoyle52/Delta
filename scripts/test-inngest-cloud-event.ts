import * as dotenv from 'dotenv';
dotenv.config();

import { inngest } from '../src/lib/inngest/client';
import { prisma } from '../src/lib/prisma';

async function testInngestCloudEvent() {
  console.log('===========================================================');
  console.log('TESTING INNGEST CLOUD EVENT DISPATCH');
  console.log('===========================================================');

  const user = await prisma.user.findFirst({
    where: { email: 'demo-test-user@delta.app' },
    include: { wallet: true, workflows: true },
  });

  if (!user || !user.workflows[0] || !user.wallet) {
    console.error('❌ User/workflow missing');
    process.exit(1);
  }

  const wf = user.workflows[0];
  const testTxHash = `0x-inngest-test-${Date.now().toString(16)}`;

  console.log('[1] Target Workflow:', wf.name, `(${wf.id})`);
  console.log('[2] User Wallet:', user.wallet.address, `(Circle ID: ${user.wallet.circleWalletId})`);

  console.log('\n[3] Calling inngest.send()...');
  try {
    const res = await inngest.send({
      name: 'workflow.trigger',
      data: {
        workflowId: wf.id,
        triggerTxHash: testTxHash,
        triggerAmount: '1.00',
        walletAddress: user.wallet.address,
        walletId: user.wallet.circleWalletId,
      },
    });

    console.log('✅ inngest.send() Response:', JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error('❌ inngest.send() Error:', err.message);
    console.error('   Full Error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

testInngestCloudEvent();
