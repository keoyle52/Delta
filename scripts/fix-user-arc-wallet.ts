import * as dotenv from 'dotenv';
dotenv.config();

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { prisma } from '../src/lib/prisma';
import { randomUUID } from 'crypto';

async function fixUserArcWallet() {
  console.log('===========================================================');
  console.log('PROVISIONING ARC-TESTNET WALLET FOR USER IN CIRCLE W3S');
  console.log('===========================================================');

  const user = await prisma.user.findFirst({
    where: { email: 'keoqleairdrop@gmail.com' },
    include: { wallet: true },
  });

  if (!user || !user.wallet) {
    console.error('❌ User missing');
    process.exit(1);
  }

  console.log('User Email:', user.email);
  console.log('Current DB Wallet Address:', user.wallet.address);
  console.log('Current DB Wallet ID:', user.wallet.circleWalletId);

  const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });

  const walletSetId = process.env.CIRCLE_WALLET_SET_ID || '83c8aff8-bdfc-5930-aa94-3524e6f9cb4e';

  console.log('\nCreating ARC-TESTNET wallet in Circle W3S API...');
  try {
    const res = await client.createWallets({
      blockchains: ['ARC-TESTNET' as any],
      count: 1,
      walletSetId,
      accountType: 'EOA',
      idempotencyKey: randomUUID(),
    });

    const newWallet = res.data?.wallets?.[0];
    console.log('✅ New Circle ARC-TESTNET Wallet Created:');
    console.log('   ID:', newWallet?.id);
    console.log('   Address:', newWallet?.address);
    console.log('   Blockchain:', newWallet?.blockchain);

    if (newWallet) {
      await prisma.wallet.update({
        where: { id: user.wallet.id },
        data: {
          circleWalletId: newWallet.id,
          address: newWallet.address,
        },
      });
      console.log('✅ Updated DB Wallet record with new Circle ARC-TESTNET Wallet ID & Address!');
    }
  } catch (err: any) {
    console.error('❌ Error creating ARC-TESTNET wallet:', err.message);
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

fixUserArcWallet();
