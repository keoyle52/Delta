import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function checkLiveExecution() {
  const executionId = 'cms4hfdjo0001gjp1kuyfvfbj';
  const record = await prisma.execution.findUnique({
    where: { id: executionId },
  });

  console.log('===========================================================');
  console.log('LIVE INNGEST DEV SERVER EXECUTION RESULT:');
  console.log('Status:', record?.status);
  console.log('Step Logs:');
  console.log(JSON.stringify(record?.stepLogs, null, 2));
  console.log('===========================================================');
  await prisma.$disconnect();
}

checkLiveExecution();
