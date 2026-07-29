import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function checkLiveExecution2() {
  const executionId = 'cms4hk6ed00011146ray0fac6';
  const record = await prisma.execution.findUnique({
    where: { id: executionId },
  });

  console.log('===========================================================');
  console.log('LIVE INNGEST DEV SERVER RUNTIME EXECUTION RESULT:');
  console.log('Execution ID:', executionId);
  console.log('Status:', record?.status);
  console.log('Step Logs:');
  console.log(JSON.stringify(record?.stepLogs, null, 2));
  console.log('===========================================================');
  await prisma.$disconnect();
}

checkLiveExecution2();
