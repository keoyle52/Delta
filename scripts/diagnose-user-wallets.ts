import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function diagnoseUserWallets() {
  console.log('===========================================================');
  console.log('DATABASE DIAGNOSIS: USERS, WALLETS, AND WORKFLOWS');
  console.log('===========================================================');

  const users = await prisma.user.findMany({
    include: {
      wallet: true,
      workflows: true,
    },
  });

  console.log(`Found ${users.length} total User record(s):\n`);

  for (const u of users) {
    console.log(`👤 User ID: ${u.id}`);
    console.log(`   Email: ${u.email}`);
    console.log(`   Created At: ${u.createdAt.toISOString()}`);
    console.log(`   Wallet linked: ${u.wallet ? `${u.wallet.address} (circleWalletId: ${u.wallet.circleWalletId || 'none'})` : 'NONE'}`);
    console.log(`   Workflows count: ${u.workflows.length}`);
    for (const wf of u.workflows) {
      console.log(`      └─ Workflow ID: ${wf.id} | Name: "${wf.name}" | isActive: ${wf.isActive} | Nodes: ${(typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : wf.nodes).length}`);
    }
    console.log('-----------------------------------------------------------');
  }

  const allWallets = await prisma.wallet.findMany();
  console.log(`\nFound ${allWallets.length} total Wallet record(s) in DB.`);

  console.log('===========================================================');
  await prisma.$disconnect();
}

diagnoseUserWallets();
