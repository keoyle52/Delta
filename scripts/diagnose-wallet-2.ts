import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function diagnoseWallet2() {
  console.log('===========================================================');
  console.log('DIAGNOSING USER 2 (b98c8c33-efd0-5cec-a730-ce954cfb6f4a)');
  console.log('===========================================================');

  const walletId = 'b98c8c33-efd0-5cec-a730-ce954cfb6f4a';

  const wallet = await prisma.wallet.findFirst({
    where: { circleWalletId: walletId },
    include: {
      user: {
        include: {
          workflows: true,
        },
      },
    },
  });

  if (!wallet) {
    console.error('❌ Wallet not found for ID:', walletId);
    process.exit(1);
  }

  console.log('[1] Address in DB:', wallet.address);
  console.log('[2] User Email:', wallet.user.email);
  console.log('[3] Workflows Count:', wallet.user.workflows.length);

  for (const wf of wallet.user.workflows) {
    console.log(`\n📌 Workflow ID: ${wf.id}`);
    console.log(`   Name: "${wf.name}"`);
    console.log(`   isActive: ${wf.isActive}`);
    console.log(`   Nodes (raw):`, JSON.stringify(wf.nodes, null, 2));
    console.log(`   Edges (raw):`, JSON.stringify(wf.edges, null, 2));
  }

  await prisma.$disconnect();
}

diagnoseWallet2();
