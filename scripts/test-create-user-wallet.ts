import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';
import { getOrCreateUserWallet } from '../src/lib/auth';

async function testUserWalletCreation() {
  console.log('===========================================================');
  console.log('DELTA USER CUSTODIAL WALLET CREATION & IDEMPOTENCY TEST');
  console.log('===========================================================');

  const testEmail = 'demo-test-user@delta.app';

  // Find or create test user in Neon Postgres
  let user = await prisma.user.findUnique({
    where: { email: testEmail },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: testEmail,
      },
    });
  }

  console.log('[1] Test User ID:', user.id);

  try {
    console.log('[2] Calling getOrCreateUserWallet (First Run - Provisioning Wallet)...');
    const wallet1 = await getOrCreateUserWallet(user.id);
    console.log('   ✅ Wallet Address:', wallet1.address);
    console.log('   ✅ Circle Wallet ID:', wallet1.circleWalletId);
    console.log('   ✅ Wallet Set ID:', wallet1.circleWalletSetId);
    console.log('   ✅ Blockchain:', wallet1.blockchain);

    console.log('\n[3] Calling getOrCreateUserWallet (Second Run - Idempotency Check)...');
    const wallet2 = await getOrCreateUserWallet(user.id);
    console.log('   ✅ Wallet Address:', wallet2.address);
    console.log('   ✅ Circle Wallet ID:', wallet2.circleWalletId);

    if (wallet1.circleWalletId === wallet2.circleWalletId && wallet1.address === wallet2.address) {
      console.log('\n🎉 SUCCESS: Idempotency verified! Second call returned existing wallet without duplicate creation.');
    } else {
      console.error('\n❌ FAILED: Idempotency test failed!');
    }
  } catch (err: any) {
    console.error('\n❌ ERROR during wallet creation:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

testUserWalletCreation();
