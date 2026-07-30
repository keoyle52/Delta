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
  walletId?: string;
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
        ...(walletId ? { walletId } : {}),
      } as any,
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
 * Execute a Cross-chain Bridge from Arc Testnet to any supported destination chain (CCTP)
 */
export async function executeAppKitBridge({
  userWalletAddress,
  walletId,
  destinationAddress,
  amountUsdc,
  destinationChain = 'Solana_Devnet',
}: {
  userWalletAddress: string;
  walletId?: string;
  destinationAddress: string;
  amountUsdc: string;
  destinationChain?: string;
}) {
  const kit = getAppKitInstance();
  const circleWalletsAdapter = getCircleWalletsAdapter();

  try {
    // 1. Check runtime forwarder support for requested bridge destination chain
    const bridgeChains = kit.getSupportedChains('bridge');
    const targetChain: any = bridgeChains.find(
      (c: any) => c.chain === destinationChain || c.name === destinationChain
    );

    const isForwarderSupported = Boolean(
      targetChain?.cctp?.forwarderSupported?.destination ||
      targetChain?.forwarderSupported?.destination ||
      targetChain?.forwarderSupported
    );

    if (!targetChain || !isForwarderSupported) {
      throw new Error(
        `Destination chain "${destinationChain}" is not supported for recipientAddress/forwarder CCTP bridge operations.`
      );
    }

    // 2. Perform CCTP bridge call with forwarder-based destination (useForwarder: true is mandatory)
    const bridgeResult: any = await kit.bridge({
      from: {
        adapter: circleWalletsAdapter,
        chain: 'Arc_Testnet',
        address: userWalletAddress,
        ...(walletId ? { walletId } : {}),
      } as any,
      to: {
        chain: destinationChain,
        recipientAddress: destinationAddress,
        useForwarder: true,
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
 * Execute Same-chain Token Transfer on Arc Testnet (USDC / EURC)
 */
export async function executeAppKitSend({
  userWalletAddress,
  walletId,
  destinationAddress,
  amountUsdc,
  token = 'USDC',
}: {
  userWalletAddress: string;
  walletId?: string;
  destinationAddress: string;
  amountUsdc: string;
  token?: 'USDC' | 'EURC';
}) {
  const kit = getAppKitInstance();
  const circleWalletsAdapter = getCircleWalletsAdapter();

  try {
    const sendResult = await kit.send({
      from: {
        adapter: circleWalletsAdapter,
        chain: 'Arc_Testnet',
        address: userWalletAddress,
        ...(walletId ? { walletId } : {}),
      } as any,
      to: destinationAddress,
      token: token as 'USDC' | 'EURC',
      amount: amountUsdc,
    });

    return sendResult;
  } catch (error: any) {
    console.error('App Kit Send Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw new Error(`App Kit Send operation failed: ${error.message || error}`);
  }
}
