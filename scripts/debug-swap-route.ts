import * as dotenv from 'dotenv';
dotenv.config();

import { executeAppKitSwap } from '../src/lib/circle/app-kit';
import { prisma } from '../src/lib/prisma';

async function testUnsupportedTokens() {
  console.log('===========================================================');
  console.log('TESTING SWAP TOKENS (EURC vs SOL vs ETH vs USDT)');
  console.log('===========================================================');

  const user = await prisma.user.findFirst({
    where: { email: 'demo-test-user@delta.app' },
    include: { wallet: true },
  });

  if (!user || !user.wallet) process.exit(1);

  const testTokens = ['EURC', 'SOL', 'ETH', 'USDT'];

  for (const tok of testTokens) {
    console.log(`\n--- Swap Test Token Out: "${tok}" ---`);
    try {
      const res: any = await executeAppKitSwap({
        userWalletAddress: user.wallet.address,
        walletId: user.wallet.circleWalletId,
        amountUsdc: '1.00',
        tokenOut: tok,
      });
      console.log(`   ✅ SUCCESS: TxHash = ${res?.txHash || res?.id}`);
    } catch (err: any) {
      console.log(`   ❌ VERBATIM ERROR FOR "${tok}":`);
      console.log(`      Error Name: "${err.name}"`);
      console.log(`      Error Code: ${err.code}`);
      console.log(`      Error Message: "${err.message}"`);
      console.log(`      Full Object:`, JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    }
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

testUnsupportedTokens();
