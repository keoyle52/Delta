import * as dotenv from 'dotenv';
dotenv.config();

import { AppKit } from '@circle-fin/app-kit';
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets';
import { prisma } from '../src/lib/prisma';

async function testAdapterWalletId() {
  console.log('===========================================================');
  console.log('TESTING CIRCLE WALLETS ADAPTER RESOLUTION');
  console.log('===========================================================');

  const user = await prisma.user.findFirst({
    where: { email: 'demo-test-user@delta.app' },
    include: { wallet: true },
  });

  if (!user || !user.wallet) process.exit(1);

  const apiKey = process.env.CIRCLE_API_KEY!;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;
  const kitKey = process.env.CIRCLE_KIT_KEY!;

  const adapter = createCircleWalletsAdapter({
    apiKey,
    entitySecret,
  });

  const kit = new AppKit();

  console.log('[1] Testing kit.swap with address only...');
  try {
    const res1 = await kit.swap({
      from: {
        adapter,
        chain: 'Arc_Testnet',
        address: user.wallet.address,
      },
      tokenIn: 'USDC',
      tokenOut: 'EURC',
      amountIn: '1.00',
      config: { kitKey },
    });
    console.log('   ✅ Test 1 (address only) Succeeded! TxHash:', res1.txHash);
  } catch (err1: any) {
    console.log('   ❌ Test 1 (address only) Failed:', err1.message);
  }

  console.log('\n[2] Testing kit.swap with walletId explicitly...');
  try {
    const res2 = await kit.swap({
      from: {
        adapter,
        chain: 'Arc_Testnet',
        address: user.wallet.address,
        walletId: user.wallet.circleWalletId,
      } as any,
      tokenIn: 'USDC',
      tokenOut: 'EURC',
      amountIn: '1.00',
      config: { kitKey },
    });
    console.log('   ✅ Test 2 (with walletId) Succeeded! TxHash:', res2.txHash);
  } catch (err2: any) {
    console.log('   ❌ Test 2 (with walletId) Failed:', err2.message);
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

testAdapterWalletId();
