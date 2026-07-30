import * as dotenv from 'dotenv';
dotenv.config();

import { AppKit } from '@circle-fin/app-kit';
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets';
import { prisma } from '../src/lib/prisma';

async function testBridgeSchema() {
  console.log('===========================================================');
  console.log('TESTING APP KIT BRIDGE FROM PARAMETER SCHEMA');
  console.log('===========================================================');

  const user = await prisma.user.findFirst({
    where: { email: 'demo-test-user@delta.app' },
    include: { wallet: true },
  });

  if (!user || !user.wallet) process.exit(1);

  const apiKey = process.env.CIRCLE_API_KEY!;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;

  const adapter = createCircleWalletsAdapter({
    apiKey,
    entitySecret,
  });

  const kit = new AppKit();

  console.log('[1] Testing kit.bridge with { adapter, chain: "Arc_Testnet", address } (NO walletId)...');
  try {
    const res1 = await kit.bridge({
      from: {
        adapter,
        chain: 'Arc_Testnet',
        address: user.wallet.address,
      },
      to: {
        chain: 'Solana_Devnet',
        recipientAddress: '9aW8e2Xv5k7P1m3Q8L0v9X1Y2Z3W4V5U6T7S8R9Q0P1N',
        useForwarder: true,
      } as any,
      amount: '1.00',
    });
    console.log('   ✅ kit.bridge Schema Test Succeeded!');
  } catch (err: any) {
    console.log('   ❌ kit.bridge Error Message:', err.message);
    console.log('   Full Error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

testBridgeSchema();
