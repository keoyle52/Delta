import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';
import { inngest } from '../src/lib/inngest/client';

async function triggerLiveInngestEvent() {
  console.log('===========================================================');
  console.log('SENDING EVENT TO LIVE INNGEST DEV SERVER');
  console.log('===========================================================');

  const user = await prisma.user.findFirst({ include: { wallet: true } });
  if (!user || !user.wallet) {
    console.error('❌ User/Wallet missing');
    process.exit(1);
  }

  const testNodes = [
    { id: 'node-trigger-1', type: 'trigger', data: { label: 'USDC Received' } },
    { id: 'node-swap-1', type: 'swap', data: { label: 'Swap USDC to EURC', tokenOut: 'EURC', percentage: '10' } },
  ];

  let workflow = await prisma.workflow.findFirst({ where: { userId: user.id } });
  if (!workflow) {
    workflow = await prisma.workflow.create({
      data: { userId: user.id, name: 'Live Inngest Workflow', nodes: testNodes as any, edges: [] as any },
    });
  } else {
    await prisma.workflow.update({
      where: { id: workflow.id },
      data: { nodes: testNodes as any, isActive: true },
    });
  }

  const execution = await prisma.execution.create({
    data: {
      workflowId: workflow.id,
      triggerTxHash: `0x-live-trigger-${Date.now()}`,
      triggerAmount: '10.00',
      status: 'RUNNING',
      stepLogs: [
        {
          stepId: 'node-trigger-1',
          nodeType: 'trigger',
          nodeName: 'USDC Received',
          status: 'COMPLETE',
          details: 'Received 10.00 USDC',
          timestamp: new Date().toISOString(),
        },
      ] as any,
      startedAt: new Date(),
    },
  });

  console.log('[1] Created DB Execution Record ID:', execution.id);

  console.log('[2] Sending event workflow.trigger to Inngest Dev Server...');
  await inngest.send({
    name: 'workflow.trigger',
    data: {
      workflowId: workflow.id,
      executionId: execution.id,
      triggerTxHash: execution.triggerTxHash,
      triggerAmount: '10.00',
      userId: user.id,
      walletAddress: user.wallet.address,
      walletId: user.wallet.id,
      amount: '1.00',
    },
  });

  console.log('✅ Event sent to Inngest Dev Server successfully!');
  console.log('===========================================================');
  await prisma.$disconnect();
}

triggerLiveInngestEvent();
