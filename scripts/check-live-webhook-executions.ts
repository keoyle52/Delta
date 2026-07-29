import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function checkLiveWebhookExecutions() {
  console.log('===========================================================');
  console.log('CHECKING RECENT EXECUTIONS TRIGGERED BY CIRCLE WEBHOOK');
  console.log('===========================================================');

  const executions = await prisma.execution.findMany({
    take: 5,
    orderBy: { startedAt: 'desc' },
    include: {
      workflow: true,
    },
  });

  console.log(`Found ${executions.length} recent execution(s) in DB:\n`);
  for (const exec of executions) {
    console.log(`📌 Execution ID: ${exec.id}`);
    console.log(`   Workflow: "${exec.workflow?.name || exec.workflowId}"`);
    console.log(`   Status: ${exec.status}`);
    console.log(`   Trigger TxHash: ${exec.triggerTxHash}`);
    console.log(`   Trigger Amount: ${exec.triggerAmount}`);
    console.log(`   Started At: ${exec.startedAt.toISOString()}`);
    console.log(`   Step Logs:`, JSON.stringify(exec.stepLogs, null, 2));
    console.log('-----------------------------------------------------------');
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

checkLiveWebhookExecutions();
