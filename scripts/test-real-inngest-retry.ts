import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';
import { executeWorkflowFunction } from '../src/lib/inngest/functions';

async function testRealInngestRetry() {
  console.log('===========================================================');
  console.log('REAL INNGEST STEP RETRY TEST — SWAP NODE');
  console.log('===========================================================');

  // 1. Get user & wallet
  const user = await prisma.user.findFirst({ include: { wallet: true } });
  if (!user || !user.wallet) {
    console.error('❌ Demo user/wallet not found.');
    process.exit(1);
  }

  // Define test nodes with valid swap node
  const testNodes = [
    {
      id: 'node-trigger-1',
      type: 'trigger',
      data: { label: 'USDC Received' },
    },
    {
      id: 'node-swap-1',
      type: 'swap',
      data: { label: 'Swap USDC to EURC', tokenOut: 'EURC', percentage: '10' },
    },
  ];

  let workflow = await prisma.workflow.findFirst({ where: { userId: user.id } });
  if (!workflow) {
    workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name: 'Retry Test Workflow',
        nodes: testNodes as any,
        edges: [] as any,
      },
    });
  } else {
    await prisma.workflow.update({
      where: { id: workflow.id },
      data: { nodes: testNodes as any, isActive: true },
    });
  }

  // 2. Create Execution in DB
  const execution = await prisma.execution.create({
    data: {
      workflowId: workflow.id,
      triggerTxHash: `0x-trigger-${Date.now()}`,
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

  console.log('[1] Created Execution ID:', execution.id);

  // 3. Mock Inngest Step Context
  const mockStep = {
    run: async (name: string, fn: Function) => {
      console.log(`\n---> Inngest step.run Executing: "${name}" <---`);
      return await fn();
    },
  };

  const mockEvent = {
    data: {
      workflowId: execution.workflowId,
      executionId: execution.id,
      triggerTxHash: execution.triggerTxHash,
      triggerAmount: '10.00',
      userId: user.id,
      walletAddress: user.wallet.address,
      walletId: user.wallet.id,
      amount: '1.00',
    },
  };

  console.log('\n[2] --- ATTEMPT 1: Invoking executeWorkflowFunction (Hits FORCED_TEST_CRASH after early updateLog) ---');
  try {
    // @ts-ignore
    await executeWorkflowFunction.fn({ event: mockEvent, step: mockStep });
  } catch (err: any) {
    console.log('❌ Attempt 1 Error Caught:', err.message);
  }

  console.log('\n[3] --- ATTEMPT 2 (Inngest Retry): Invoking executeWorkflowFunction again ---');
  try {
    // @ts-ignore
    await executeWorkflowFunction.fn({ event: mockEvent, step: mockStep });
    console.log('✅ Attempt 2 Finished without throwing!');
  } catch (err: any) {
    console.error('Attempt 2 Error:', err.message);
  }

  // 4. Print final DB logs for verification
  const finalExec = await prisma.execution.findUnique({ where: { id: execution.id } });
  console.log('\n[4] FINAL DB STEP LOGS:');
  console.log(JSON.stringify(finalExec?.stepLogs, null, 2));

  console.log('\n===========================================================');
  await prisma.$disconnect();
}

testRealInngestRetry();
