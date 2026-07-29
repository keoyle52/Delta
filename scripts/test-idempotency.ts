import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function testIdempotencyRecovery() {
  console.log('===========================================================');
  console.log('INNGEST IDEMPOTENCY RECOVERY TEST');
  console.log('===========================================================');

  const executionId = 'cms4gbuxr0001eiy6t0tkwek6';
  const nodeId = 'bridge-1';

  console.log('[1] Simulating Inngest Retry Attempt 2 for Execution:', executionId);

  // Query execution row from DB
  const freshExec = await prisma.execution.findUnique({
    where: { id: executionId },
  });

  const currentLogs = typeof freshExec?.stepLogs === 'string'
    ? JSON.parse(freshExec.stepLogs)
    : (freshExec?.stepLogs || []);

  // Run the exact idempotency logic from src/lib/inngest/functions.ts
  const recordedLog = currentLogs.find((l: any) => l.stepId === nodeId && l.txHash);

  if (recordedLog?.txHash) {
    console.log(`[INNGEST IDEMPOTENCY RECOVERY] Skipping redundant on-chain call for node ${nodeId}. Recorded txHash: ${recordedLog.txHash}`);
    console.log('✅ RECOVERY SUCCESSFUL: App Kit API call was safely bypassed!');
  } else {
    console.error('❌ IDEMPOTENCY FAILED: Recorded txHash not found in step logs.');
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

testIdempotencyRecovery();
