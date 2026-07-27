import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function clearDemoExecutions() {
  console.log('===========================================================');
  console.log('CLEARING DEMO EXECUTION LOGS FROM NEON POSTGRES DB');
  console.log('===========================================================');

  const result = await prisma.execution.deleteMany({});
  console.log(`✅ Successfully deleted ${result.count} demo execution records!`);

  await prisma.$disconnect();
}

clearDemoExecutions();
