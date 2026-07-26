import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function checkLatestExecutions() {
  console.log('===========================================================');
  console.log('CHECKING LATEST EXECUTIONS IN NEON POSTGRES (LAST 1 HOUR)');
  console.log('===========================================================');

  const executions = await prisma.execution.findMany({
    orderBy: { startedAt: 'desc' },
    take: 10,
    include: {
      workflow: true,
    },
  });

  console.log(`[1] Total Executions Count: ${executions.length}`);

  for (const exec of executions) {
    console.log(`\n⚡ Execution ID: ${exec.id}`);
    console.log(`   Workflow Name: "${exec.workflow.name}" (ID: ${exec.workflowId})`);
    console.log(`   Status: ${exec.status}`);
    console.log(`   StartedAt: ${exec.startedAt}`);
    console.log(`   FinishedAt: ${exec.finishedAt || 'N/A'}`);
    console.log(`   Trigger TxHash: ${exec.triggerTxHash}`);
    console.log(`   Trigger Amount: ${exec.triggerAmount}`);
    console.log(`   Step Logs:`, JSON.stringify(exec.stepLogs, null, 2));
  }

  await prisma.$disconnect();
}

checkLatestExecutions();
