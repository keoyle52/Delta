import * as dotenv from 'dotenv';
dotenv.config();

import { executeAppKitSend } from '../src/lib/circle/app-kit';
import { prisma } from '../src/lib/prisma';

async function sendTestnetUsdcDeposit() {
  console.log('===========================================================');
  console.log('SENDING REAL ON-CHAIN TESTNET USDC TRANSFER VIA APP KIT SDK');
  console.log('===========================================================');

  const senderUser = await prisma.user.findFirst({
    where: { email: 'demo@delta.build' },
    include: { wallet: true },
  });

  const recipientUser = await prisma.user.findFirst({
    where: { email: 'demo-test-user@delta.app' },
    include: { wallet: true },
  });

  if (!senderUser?.wallet || !recipientUser?.wallet) {
    console.error('❌ Sender or recipient wallet missing in DB');
    process.exit(1);
  }

  console.log('[1] Sender Wallet Address:', senderUser.wallet.address);
  console.log('[2] Recipient Wallet Address:', recipientUser.wallet.address);

  try {
    const res: any = await executeAppKitSend({
      userWalletAddress: senderUser.wallet.address,
      destinationAddress: recipientUser.wallet.address,
      amountUsdc: '1.00',
    });

    const txHash = res?.txHash || res?.id || res?.transactionHash || res?.steps?.find((s: any) => s.txHash)?.txHash || '0x-complete';
    console.log('\n✅ Real On-Chain Arc Testnet USDC Transfer Executed via App Kit!');
    console.log('   Transaction Result:', JSON.stringify(res, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    console.log('   TxHash:', txHash);
    console.log('   Arcscan Link: https://testnet.arcscan.app/tx/' + txHash);
  } catch (err: any) {
    console.error('❌ App Kit Transfer Error:', err.message);
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

sendTestnetUsdcDeposit();
