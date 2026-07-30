import * as dotenv from 'dotenv';
dotenv.config();

import { executeAppKitSwap } from '../src/lib/circle/app-kit';
import { prisma } from '../src/lib/prisma';

async function testFineThreshold() {
  console.log('===========================================================');
  console.log('PINPOINTING EXACT TESTNET SWAP LIQUIDITY THRESHOLD');
  console.log('===========================================================');

  const user = await prisma.user.findFirst({
    where: { email: 'keoqleairdrop@gmail.com' },
    include: { wallet: true },
  });

  if (!user || !user.wallet) process.exit(1);

  const amountsToTest = ['10.00', '11.00', '12.00', '13.00', '14.00', '15.00'];

  for (const amt of amountsToTest) {
    console.log(`\n--- Swap Amount: ${amt} USDC ---`);
    try {
      const res: any = await executeAppKitSwap({
        userWalletAddress: user.wallet.address,
        walletId: user.wallet.circleWalletId,
        amountUsdc: amt,
        tokenOut: 'EURC',
      });

      const txHash = res?.txHash || res?.id || res?.transactionHash || res?.steps?.find((s: any) => s.txHash)?.txHash;
      console.log(`   ✅ SUCCESS: TxHash = ${txHash}`);
    } catch (err: any) {
      console.log(`   ❌ FAILED for ${amt} USDC: Code = ${err.code || 'N/A'}, Message = "${err.message}"`);
    }
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

testFineThreshold();
