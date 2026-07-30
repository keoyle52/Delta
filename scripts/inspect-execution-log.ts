import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function inspectExecutionLog() {
  console.log('===========================================================');
  console.log('INSPECTING DB GROUND TRUTH FOR EXECUTION RECORD');
  console.log('===========================================================');

  const targetExecutionId = 'cms7b95jh0';

  const targetExec = await prisma.execution.findFirst({
    where: {
      id: {
        startsWith: targetExecutionId,
      },
    },
    include: {
      workflow: {
        include: { user: { include: { wallet: true } } },
      },
    },
  });

  if (targetExec) {
    console.log(`\n📌 Found Target Execution ID: ${targetExec.id}`);
    console.log(`   Status: ${targetExec.status}`);
    console.log(`   Workflow: "${targetExec.workflow.name}" (${targetExec.workflowId})`);
    console.log(`   User Email: ${targetExec.workflow.user.email}`);
    console.log(`   User DB Wallet Address: ${targetExec.workflow.user.wallet?.address}`);
    console.log(`   User DB Circle Wallet ID: ${targetExec.workflow.user.wallet?.circleWalletId}`);
    console.log(`   Trigger TxHash: ${targetExec.triggerTxHash}`);
    console.log(`   Trigger Amount: ${targetExec.triggerAmount}`);
    console.log(`   Raw Step Logs:`, JSON.stringify(targetExec.stepLogs, null, 2));
  } else {
    console.log(`\n❌ Execution ID starting with "${targetExecutionId}" not found in DB!`);
  }

  console.log('\n📌 5 Most Recent Executions in Database:');
  const recentExecs = await prisma.execution.findMany({
    take: 5,
    orderBy: { id: 'desc' },
    include: { workflow: true },
  });

  for (const exec of recentExecs) {
    console.log(`\n - ID: ${exec.id} | Status: ${exec.status} | Workflow: "${exec.workflow.name}" | Trigger Amount: ${exec.triggerAmount}`);
    console.log(`   StepLogs:`, JSON.stringify(exec.stepLogs, null, 2));
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

inspectExecutionLog();
