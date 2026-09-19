/**
 * Circle App Kit Integration
 * Dynamically configured via getNetworkConfig and getServerCircleCredentials.
 */

import { AppKit } from '@circle-fin/app-kit';
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets';
import { logger } from '@/lib/logger';
import { getNetworkConfig, getServerCircleCredentials, Network } from '@/config/network';

export function getAppKitInstance() {
  return new AppKit();
}

export function getCircleWalletsAdapter(network: Network = 'mainnet') {
  const credentials = getServerCircleCredentials(network);

  return createCircleWalletsAdapter({
    apiKey: credentials.apiKey,
    entitySecret: credentials.entitySecret,
  });
}

/**
 * Execute a Token Swap on Arc (USDC -> EURC / USDC / cirBTC)
 */
export async function executeAppKitSwap({
  userWalletAddress,
  walletId,
  amountUsdc,
  tokenOut,
  network = 'mainnet',
}: {
  userWalletAddress: string;
  walletId?: string;
  amountUsdc: string;
  tokenOut: string;
  network?: Network;
}) {
  const config = getNetworkConfig(network);
  const credentials = getServerCircleCredentials(network);

  const kit = getAppKitInstance();
  const circleWalletsAdapter = getCircleWalletsAdapter(network);

  logger.debug(`[APP KIT SWAP ${network.toUpperCase()}] Calling kit.swap with parameters:`, JSON.stringify({
    chain: config.appKitChain,
    address: userWalletAddress,
    walletId: walletId || 'MISSING/UNDEFINED',
    amountIn: amountUsdc,
    tokenOut,
  }));

  try {
    const swapResult = await kit.swap({
      from: {
        adapter: circleWalletsAdapter,
        chain: config.appKitChain as any,
        address: userWalletAddress,
        ...(walletId ? { walletId } : {}),
      } as any,
      tokenIn: 'USDC',
      tokenOut: tokenOut as 'EURC' | 'USDC',
      amountIn: amountUsdc,
      config: {
        kitKey: credentials.kitKey,
      },
    });

    return swapResult;
  } catch (error: any) {
    console.error(`App Kit Swap Full Error Object (${network}):`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    const msg = String(error.message || error);
    if (msg.includes('No route available') || msg.includes('INPUT_UNSUPPORTED_ROUTE') || error.code === 1003) {
      throw new Error(
        `Swap amount of ${amountUsdc} USDC exceeds available Arc DEX pool liquidity. Please try a smaller amount.`
      );
    }
    throw new Error(`App Kit Swap operation failed on ${network}: ${msg}`);
  }
}

/**
 * Execute a Cross-chain Bridge from Arc to any supported destination chain (CCTP)
 */
export async function executeAppKitBridge({
  userWalletAddress,
  walletId,
  destinationAddress,
  amountUsdc,
  destinationChain,
  network = 'mainnet',
}: {
  userWalletAddress: string;
  walletId?: string;
  destinationAddress: string;
  amountUsdc: string;
  destinationChain?: string;
  network?: Network;
}) {
  const config = getNetworkConfig(network);
  const effectiveDestinationChain = destinationChain || config.appKitSolanaChain;
  const kit = getAppKitInstance();
  const circleWalletsAdapter = getCircleWalletsAdapter(network);

  try {
    // 1. Check runtime forwarder support for requested bridge destination chain
    const bridgeChains = kit.getSupportedChains('bridge');
    const targetChain: any = bridgeChains.find(
      (c: any) => c.chain === effectiveDestinationChain || c.name === effectiveDestinationChain
    );

    const isForwarderSupported = Boolean(
      targetChain?.cctp?.forwarderSupported?.destination ||
      targetChain?.forwarderSupported?.destination ||
      targetChain?.forwarderSupported
    );

    if (!targetChain || !isForwarderSupported) {
      throw new Error(
        `Destination chain "${effectiveDestinationChain}" is not supported for recipientAddress/forwarder CCTP bridge operations.`
      );
    }

    logger.debug(`[APP KIT BRIDGE ${network.toUpperCase()}] Calling kit.bridge with parameters:`, JSON.stringify({
      chain: config.appKitChain,
      address: userWalletAddress,
      destinationChain: effectiveDestinationChain,
      destinationAddress,
      amount: amountUsdc,
    }));

    // 2. Perform CCTP bridge call with forwarder-based destination (useForwarder: true is mandatory)
    const bridgeResult: any = await kit.bridge({
      from: {
        adapter: circleWalletsAdapter,
        chain: config.appKitChain as any,
        address: userWalletAddress,
      },
      to: {
        chain: effectiveDestinationChain,
        recipientAddress: destinationAddress,
        useForwarder: true,
      } as any,
      amount: amountUsdc,
    });

    return bridgeResult;
  } catch (error: any) {
    console.error(`App Kit Bridge Full Error Object (${network}):`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw new Error(`App Kit Bridge operation failed on ${network}: ${error.message || error}`);
  }
}

/**
 * Execute Same-chain Token Transfer on Arc (USDC / EURC)
 */
export async function executeAppKitSend({
  userWalletAddress,
  walletId,
  destinationAddress,
  amountUsdc,
  token = 'USDC',
  network = 'mainnet',
}: {
  userWalletAddress: string;
  walletId?: string;
  destinationAddress: string;
  amountUsdc: string;
  token?: 'USDC' | 'EURC';
  network?: Network;
}) {
  const config = getNetworkConfig(network);
  const kit = getAppKitInstance();
  const circleWalletsAdapter = getCircleWalletsAdapter(network);

  logger.debug(`[APP KIT SEND ${network.toUpperCase()}] Calling kit.send with parameters:`, JSON.stringify({
    chain: config.appKitChain,
    address: userWalletAddress,
    destinationAddress,
    amount: amountUsdc,
  }));

  try {
    const sendResult = await kit.send({
      from: {
        adapter: circleWalletsAdapter,
        chain: config.appKitChain as any,
        address: userWalletAddress,
      },
      to: destinationAddress,
      token: token as 'USDC' | 'EURC',
      amount: amountUsdc,
    });

    return sendResult;
  } catch (error: any) {
    console.error(`App Kit Send Full Error Object (${network}):`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw new Error(`App Kit Send operation failed on ${network}: ${error.message || error}`);
  }
}
