import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { randomUUID } from 'crypto';

/**
 * Initializes the Circle Developer-Controlled Wallets SDK Client
 */
export function getCircleWalletsClient() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('CIRCLE_API_KEY is not set in environment variables.');
  }

  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret: entitySecret || '',
  });
}

/**
 * Provision a single Developer-Controlled Custodial Wallet on Arc Testnet
 */
export async function createArcUserWallet(userId: string) {
  const client = getCircleWalletsClient();
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;

  if (!walletSetId || walletSetId.trim() === '') {
    throw new Error(
      'CIRCLE_WALLET_SET_ID is not configured in environment variables. Run setup:wallet-set script first.'
    );
  }

  try {
    const idempotencyKey = randomUUID();

    // Create EVM-compatible EOA wallet using testnet developer parameters
    const response = await client.createWallets({
      blockchains: ['ETH-SEPOLIA'],
      count: 1,
      walletSetId,
      accountType: 'EOA',
      idempotencyKey,
    });

    const createdWallet = response.data?.wallets?.[0];

    if (!createdWallet) {
      throw new Error('Circle API returned an empty wallet array.');
    }

    return {
      circleWalletId: createdWallet.id,
      circleWalletSetId: walletSetId,
      address: createdWallet.address,
      blockchain: 'ARC-TESTNET',
    };
  } catch (error: any) {
    console.error('Failed to create Circle wallet:', error);
    throw new Error(
      `Circle Wallet Creation Failed: ${error.response?.data?.message || error.message || error}`
    );
  }
}

/**
 * Perform outbound transfer of USDC / EURC on Arc Testnet
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
    const payload: any = {
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
    };

    if (tokenId) {
      payload.tokenId = tokenId;
    }

    const response = await client.createTransaction(payload);
    return response.data?.id;
  } catch (error: any) {
    console.error('Circle Transfer error:', error.response?.data || error);
    throw new Error(`Circle Wallet outbound transfer failed: ${error.response?.data?.message || error.message || error}`);
  }
}
