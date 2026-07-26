/**
 * Delta Setup Script: Create Single App-Wide Circle Wallet Set
 *
 * Run this script once during initial project setup:
 * npx tsx scripts/create-wallet-set.ts
 *
 * Output will give the CIRCLE_WALLET_SET_ID to save into .env
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error('ERROR: CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be set in .env to run this script.');
    process.exit(1);
  }

  console.log('Creating single application-wide Wallet Set on Circle Developer-Controlled Wallets...');

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  try {
    const res = await client.createWalletSet({
      name: 'Delta-App-Shared-WalletSet',
    });

    const walletSet = res.data?.walletSet;
    if (walletSet?.id) {
      console.log('\n✅ SUCCESS: Single Wallet Set Created!');
      console.log(`Wallet Set ID: ${walletSet.id}`);
      console.log(`\nAdd this to your .env file:\nCIRCLE_WALLET_SET_ID="${walletSet.id}"\n`);
    } else {
      console.error('Failed to receive walletSet from Circle API:', res);
    }
  } catch (err: any) {
    console.error('Error creating Wallet Set:', err.message || err);
  }
}

main();
