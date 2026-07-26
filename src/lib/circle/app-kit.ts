/**
 * Circle App Kit Integration
 *
 * Chain naming convention for Circle App Kit:
 * - "Arc_Testnet" (PascalCase with underscore)
 * - "Solana_Devnet" (PascalCase with underscore)
 */

import { AppKit } from '@circle-fin/app-kit';
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets';

export function getAppKitInstance() {
  return new AppKit();
}

export function getCircleWalletsAdapter() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error('CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET are required for CircleWalletsAdapter.');
  }

  return createCircleWalletsAdapter({
    apiKey,
    entitySecret,
  });
}

/**
 * Execute a Token Swap on Arc Testnet (USDC -> EURC / USDC / cirBTC)
 */
export async function executeAppKitSwap({
  userWalletAddress,
  walletId,
  amountUsdc,
  tokenOut,
}: {
  userWalletAddress: string;
  walletId: string;
  amountUsdc: string;
  tokenOut: string;
}) {
  const kitKey = process.env.CIRCLE_KIT_KEY;
  if (!kitKey || kitKey.trim() === '') {
    throw new Error('Missing CIRCLE_KIT_KEY in environment variables. Token Swap operations require a valid Kit Key from Circle Developer Console (Console -> Keys -> Kit Key).');
  }

  const kit = getAppKitInstance();
  const circleWalletsAdapter = getCircleWalletsAdapter();

  try {
    const swapResult = await kit.swap({
      from: {
        adapter: circleWalletsAdapter,
        chain: 'Arc_Testnet',
        address: userWalletAddress,
      },
      tokenIn: 'USDC',
      tokenOut: tokenOut as 'EURC' | 'USDC',
      amountIn: amountUsdc,
      config: {
        kitKey,
      },
    });

    return swapResult;
  } catch (error: any) {
    console.error('App Kit Swap Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw new Error(`App Kit Swap operation failed: ${error.message || error}`);
  }
}

/**
 * Execute a Cross-chain Bridge from Arc Testnet to Solana Devnet (CCTP)
 */
export async function executeAppKitBridge({
  userWalletAddress,
  destinationAddress,
  amountUsdc,
}: {
  userWalletAddress: string;
  destinationAddress: string;
  amountUsdc: string;
}) {
  const kit = getAppKitInstance();
  const circleWalletsAdapter = getCircleWalletsAdapter();

  try {
    // 1. Check runtime forwarder support for bridge destination
    const bridgeChains = kit.getSupportedChains('bridge');
    const solanaDevnet = bridgeChains.find((c: any) => c.chain === 'Solana_Devnet');

    if (!solanaDevnet?.cctp?.forwarderSupported?.destination) {
      throw new Error('Solana_Devnet forwarder is not supported; recipientAddress bridge flow cannot proceed.');
    }

    // 2. Perform CCTP bridge call with developer-controlled wallet adapter
    const bridgeResult = await kit.bridge({
      from: {
        adapter: circleWalletsAdapter,
        chain: 'Arc_Testnet',
        address: userWalletAddress,
      },
      to: {
        adapter: circleWalletsAdapter,
        chain: 'Solana_Devnet',
        recipientAddress: destinationAddress,
      } as any,
      amount: amountUsdc,
    });

    return bridgeResult;
  } catch (error: any) {
    console.error('App Kit Bridge Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw new Error(`App Kit Bridge operation failed: ${error.message || error}`);
  }
}

/**
 * Execute Same-chain USDC Transfer on Arc Testnet
 */
export async function executeAppKitSend({
  userWalletAddress,
  destinationAddress,
  amountUsdc,
}: {
  userWalletAddress: string;
  destinationAddress: string;
  amountUsdc: string;
}) {
  const kit = getAppKitInstance();
  const circleWalletsAdapter = getCircleWalletsAdapter();

  try {
    const sendResult = await kit.send({
      from: {
        adapter: circleWalletsAdapter,
        chain: 'Arc_Testnet',
        address: userWalletAddress,
      },
      to: destinationAddress,
      token: 'USDC',
      amount: amountUsdc,
    });

    return sendResult;
  } catch (error: any) {
    console.error('App Kit Send Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw new Error(`App Kit Send operation failed: ${error.message || error}`);
  }
}
