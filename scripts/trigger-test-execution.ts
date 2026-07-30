import * as dotenv from 'dotenv';
dotenv.config();

import { inngest } from '../src/lib/inngest/client';
import { prisma } from '../src/lib/prisma';

async function triggerTestExecution() {
  console.log('===========================================================');
  console.log('TRIGGERING PRODUCTION WORKFLOW EXECUTION VIA INNGEST');
  console.log('===========================================================');

  const wf = await prisma.workflow.findFirst({
    where: { isActive: true },
    include: { user: { include: { wallet: true } } },
  });

  if (!wf || !wf.user.wallet) {
    console.error('❌ Active workflow or wallet missing');
    process.exit(1);
  }

  const testTxHash = `0x-test-trigger-${Date.now().toString(16)}`;

  console.log('[1] Workflow ID:', wf.id, `("${wf.name}")`);
  console.log('[2] Wallet Address:', wf.user.wallet.address);
  console.log('[3] Circle Wallet ID:', wf.user.wallet.circleWalletId);

  // Create DB execution record
  const exec = await prisma.execution.create({
    data: {
      workflowId: wf.id,
      triggerTxHash: testTxHash,
      triggerAmount: '1.00',
      status: 'RUNNING',
      stepLogs: [
        {
          stepId: 'trigger-1',
          nodeType: 'trigger',
          nodeName: 'USDC Received',
          status: 'COMPLETE',
          txHash: testTxHash,
          details: 'Triggered manually for log verification',
          timestamp: new Date().toISOString(),
        },
      ],
      startedAt: new Date(),
    },
  });

  console.log('\n[4] Execution Record Created ID:', exec.id);

  console.log('\n[5] Dispatching event to Inngest...');
  try {
    const res = await inngest.send({
      name: 'workflow.trigger',
      data: {
        executionId: exec.id,
        workflowId: wf.id,
        triggerTxHash: testTxHash,
        triggerAmount: '1.00',
        walletAddress: wf.user.wallet.address,
        walletId: wf.user.wallet.circleWalletId,
      },
    });

    console.log('✅ inngest.send() Response:', JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error('❌ inngest.send() Error:', err.message);
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

triggerTestExecution();
