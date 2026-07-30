import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function inspectExecution() {
  console.log('===========================================================');
  console.log('INSPECTING EXECUTION RECORD: cms7c6s6x0001wa7z5jj3pp1h');
  console.log('===========================================================');

  const exec = await prisma.execution.findFirst({
    where: {
      id: {
        startsWith: 'cms7c6s6x',
      },
    },
    include: {
      workflow: {
        include: {
          user: {
            include: { wallet: true },
          },
        },
      },
    },
  });

  if (exec) {
    console.log('📌 Found Execution ID:', exec.id);
    console.log('   Status:', exec.status);
    console.log('   Workflow ID:', exec.workflowId, `("${exec.workflow.name}")`);
    console.log('   User Email:', exec.workflow.user.email);
    console.log('   User DB Wallet Address:', exec.workflow.user.wallet?.address);
    console.log('   User DB Circle Wallet ID:', exec.workflow.user.wallet?.circleWalletId);
    console.log('   Step Logs:');
    console.log(JSON.stringify(exec.stepLogs, null, 2));
  } else {
    console.log('❌ Execution starting with cms7c6s6x not found');
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

inspectExecution();
