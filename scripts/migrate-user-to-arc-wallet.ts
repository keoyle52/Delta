import * as dotenv from 'dotenv';
dotenv.config();

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { prisma } from '../src/lib/prisma';
import { randomUUID } from 'crypto';

async function migrateUserToArcWallet() {
  console.log('===========================================================');
  console.log('MIGRATING KEOQLEAIRDROP@GMAIL.COM TO REAL ARC-TESTNET WALLET');
  console.log('===========================================================');

  const user = await prisma.user.findFirst({
    where: { email: 'keoqleairdrop@gmail.com' },
    include: { wallet: true },
  });

  if (!user || !user.wallet) {
    console.error('❌ User or wallet missing in DB!');
    process.exit(1);
  }

  console.log('[1] Target User Email:', user.email);
  console.log('   Current DB Wallet Address:', user.wallet.address);
  console.log('   Current DB Circle Wallet ID:', user.wallet.circleWalletId);

  const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });

  const walletSetId = process.env.CIRCLE_WALLET_SET_ID || '83c8aff8-bdfc-5930-aa94-3524e6f9cb4e';

  // 1. Create a dedicated ARC-TESTNET wallet for this user
  console.log('\n[2] Calling Circle W3S API to create dedicated ARC-TESTNET wallet...');
  try {
    const res = await client.createWallets({
      blockchains: ['ARC-TESTNET' as any],
      count: 1,
      walletSetId,
      accountType: 'EOA',
      idempotencyKey: randomUUID(),
    });

    const arcWallet = res.data?.wallets?.[0];
    if (!arcWallet) {
      throw new Error('Circle API returned empty wallet array');
    }

    console.log('✅ Fresh Circle ARC-TESTNET Wallet Provisioned:');
    console.log('   Circle Wallet ID:', arcWallet.id);
    console.log('   Address:', arcWallet.address);
    console.log('   Blockchain:', arcWallet.blockchain);

    // 2. Update user's DB Wallet record with the new ARC-TESTNET circleWalletId and address
    await prisma.wallet.update({
      where: { id: user.wallet.id },
      data: {
        circleWalletId: arcWallet.id,
        address: arcWallet.address,
      },
    });

    console.log(`\n✅ SUCCESSFULLY MIGRATED user ${user.email} in Database!`);
    console.log(`   New DB circleWalletId: ${arcWallet.id}`);
    console.log(`   New DB address: ${arcWallet.address}`);
  } catch (err: any) {
    console.error('❌ Migration Error:', err.message);
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

migrateUserToArcWallet();
