/**
 * Circle Developer-Controlled Wallets Integration
 *
 * Chain naming convention for Developer-Controlled Wallets API:
 * - "ARC-TESTNET" (Uppercase with hyphen)
 * - "SOL-DEVNET" (Uppercase with hyphen)
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { randomUUID } from 'crypto';

export function getCircleWalletsClient() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Missing CIRCLE_API_KEY in environment variables. Real Circle API access requires a valid key from console.circle.com.');
  }

  if (!entitySecret || entitySecret.trim() === '') {
    throw new Error(
      'Missing CIRCLE_ENTITY_SECRET in environment variables. Please register your entity secret in Circle Developer Console: https://developers.circle.com/wallets/dev-controlled/register-entity-secret'
    );
  }

  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
}

/**
 * Creates a developer-controlled custodial wallet for a user on Arc Testnet
 * using the single shared application CIRCLE_WALLET_SET_ID.
 */
export async function createArcUserWallet(userId: string) {
  const client = getCircleWalletsClient();
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;

  if (!walletSetId || walletSetId.trim() === '') {
    throw new Error(
      'Missing CIRCLE_WALLET_SET_ID in environment variables. Run `npm run setup:wallet-set` or run `npx tsx scripts/create-wallet-set.ts` once to create the application shared Wallet Set.'
    );
  }

  try {
    // Create Wallet on Arc Testnet ("ARC-TESTNET") inside the shared Wallet Set
    const walletResponse = await client.createWallets({
      blockchains: ['ARC-TESTNET'],
      count: 1,
      walletSetId,
    });

    const createdWallets = walletResponse.data?.wallets;
    if (!createdWallets || createdWallets.length === 0) {
      throw new Error('No wallet returned from Circle createWallets API');
    }

    const wallet = createdWallets[0];

    return {
      circleWalletId: wallet.id,
      circleWalletSetId: walletSetId,
      address: wallet.address,
      blockchain: wallet.blockchain,
    };
  } catch (error: any) {
    console.error('Circle Wallet creation error:', error);
    throw new Error(`Circle Wallet creation failed: ${error.message || error}`);
  }
}

/**
 * Execute an outbound transfer using Circle Developer-Controlled Wallets API
 */
export async function sendArcTransfer({
  walletId,
  destinationAddress,
  amountUsdc,
  tokenId,
}: {
  walletId: string;
  destinationAddress: string;
  amountUsdc: string;
  tokenId?: string;
}) {
  const client = getCircleWalletsClient();

  try {
    const idempotencyKey = randomUUID();
    const response = await client.createTransaction({
      walletId,
      destinationAddress,
      amount: [amountUsdc],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM',
        },
      },
      idempotencyKey,
    } as any);

    return response.data?.id;
  } catch (error: any) {
    console.error('Circle Transfer error:', error);
    throw new Error(`Circle Wallet outbound transfer failed: ${error.message || error}`);
  }
}
