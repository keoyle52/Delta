import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function diagnoseCircleWalletsApi() {
  console.log('===========================================================');
  console.log('DIAGNOSING CIRCLE DEVELOPER-CONTROLLED WALLETS API');
  console.log('===========================================================');

  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    console.error('❌ CIRCLE_API_KEY missing in environment!');
    process.exit(1);
  }

  console.log('[1] CIRCLE_API_KEY prefix:', apiKey.substring(0, 15) + '...');

  // 1. Query all wallets registered under this API Key in Circle Developer Console
  console.log('\n[2] Querying Circle API: GET /v1/w3s/wallets ...');
  try {
    const res = await fetch('https://api.circle.com/v1/w3s/wallets', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const body = await res.json();
    console.log('   Response Status:', res.status);
    console.log('   Total Wallets in Circle API Key Wallet Set:', body?.data?.wallets?.length ?? 0);

    if (body?.data?.wallets) {
      console.log('\n   Registered Circle Wallets under this API Key:');
      for (const w of body.data.wallets) {
        console.log(`   - ID: ${w.id} | Address: ${w.address} | Blockchain: ${w.blockchain} | WalletSetId: ${w.walletSetId} | State: ${w.state}`);
      }
    } else {
      console.log('   Raw Response:', JSON.stringify(body, null, 2));
    }
  } catch (err: any) {
    console.error('   ❌ Error querying Circle wallets:', err.message);
  }

  // 2. Query Neon PostgreSQL database wallets
  console.log('\n[3] Querying Neon PostgreSQL Database Wallets...');
  const dbWallets = await prisma.wallet.findMany({
    include: { user: true },
  });

  for (const dbW of dbWallets) {
    console.log(`\n   DB User: ${dbW.user.email}`);
    console.log(`   DB Wallet Address: ${dbW.address}`);
    console.log(`   DB Circle Wallet ID: ${dbW.circleWalletId}`);

    // Query Circle API specifically for this DB wallet ID
    if (dbW.circleWalletId) {
      try {
        const singleRes = await fetch(`https://api.circle.com/v1/w3s/wallets/${dbW.circleWalletId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
        });
        const singleBody = await singleRes.json();
        console.log(`   -> Query Circle API GET /v1/w3s/wallets/${dbW.circleWalletId}: Status ${singleRes.status}`);
        if (singleRes.status === 200) {
          console.log(`      ✅ Wallet EXISTS in Circle API Key Wallet Set! Address: ${singleBody?.data?.wallet?.address}`);
        } else {
          console.log(`      ❌ Wallet NOT FOUND / NOT ACCESSIBLE under this API Key! Circle Response:`, JSON.stringify(singleBody));
        }
      } catch (err: any) {
        console.error(`      ❌ Error querying wallet ${dbW.circleWalletId}:`, err.message);
      }
    }
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

diagnoseCircleWalletsApi();
