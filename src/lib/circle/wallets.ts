import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { randomUUID } from 'crypto';
import { getNetworkConfig, getServerCircleCredentials, Network } from '@/config/network';

/**
 * Initializes the Circle Developer-Controlled Wallets SDK Client for the specified network.
 */
export function getCircleWalletsClient(network: Network = 'mainnet') {
  const credentials = getServerCircleCredentials(network);

  return initiateDeveloperControlledWalletsClient({
    apiKey: credentials.apiKey,
    entitySecret: credentials.entitySecret,
  });
}

/**
 * Provision a single Developer-Controlled Custodial Wallet for the specified network.
 */
export async function createArcUserWallet(userId: string, network: Network = 'mainnet') {
  const config = getNetworkConfig(network);
  const credentials = getServerCircleCredentials(network);
  const client = getCircleWalletsClient(network);

  try {
    const idempotencyKey = randomUUID();

    // Create EVM-compatible EOA wallet on Arc network
    const response = await client.createWallets({
      blockchains: [config.circleChainCode as any],
      count: 1,
      walletSetId: credentials.walletSetId,
      accountType: 'EOA',
      idempotencyKey,
    });

    const createdWallet = response.data?.wallets?.[0];

    if (!createdWallet) {
      throw new Error(`Circle API returned an empty wallet array for ${network}.`);
    }

    return {
      circleWalletId: createdWallet.id,
      circleWalletSetId: credentials.walletSetId,
      address: createdWallet.address,
      blockchain: config.circleChainCode,
      network,
    };
  } catch (error: any) {
    console.error(`Failed to create Circle wallet on ${network}:`, error);
    throw new Error(
      `Circle Wallet Creation Failed on ${network}: ${error.response?.data?.message || error.message || error}`
    );
  }
}

/**
 * Perform outbound transfer of USDC / EURC on Arc
 */
export async function sendArcTransfer({
  walletId,
  destinationAddress,
  amountUsdc,
  tokenId,
  network = 'mainnet',
}: {
  walletId: string;
  destinationAddress: string;
  amountUsdc: string;
  tokenId?: string;
  network?: Network;
}) {
  const client = getCircleWalletsClient(network);

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
    console.error(`Circle Transfer error on ${network}:`, error.response?.data || error);
    throw new Error(`Circle Wallet outbound transfer failed on ${network}: ${error.response?.data?.message || error.message || error}`);
  }
}
