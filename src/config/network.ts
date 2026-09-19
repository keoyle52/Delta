import { z } from 'zod';
import { Chain } from 'viem';
import { arc, arcTestnet } from 'viem/chains';

export type Network = 'mainnet' | 'testnet';

export const NetworkSchema = z.enum(['mainnet', 'testnet']);

export interface NetworkConfig {
  network: Network;
  chainId: number;
  viemChain: Chain;
  rpcUrls: readonly string[];
  explorerBaseUrl: string;
  usdcAddress: `0x${string}`;
  eurcAddress: `0x${string}`;
  cctpTokenMessenger: `0x${string}`;
  cctpMessageTransmitter: `0x${string}`;
  circleChainCode: 'ARC' | 'ARC-TESTNET';
  circleSolanaChainCode: 'SOL' | 'SOL-DEVNET';
  appKitChain: 'Arc' | 'Arc_Testnet';
  appKitSolanaChain: 'Solana' | 'Solana_Devnet';
  isMainnet: boolean;
  cctpDomain: number;
  minGasFeeFloorGwei: bigint;
}

const MAINNET_CONFIG: NetworkConfig = {
  network: 'mainnet',
  chainId: 5042,
  viemChain: arc,
  rpcUrls: [
    'https://rpc.mainnet.arc.io',
    'https://rpc.blockdaemon.mainnet.arc.io',
    'https://rpc.drpc.mainnet.arc.io',
    'https://rpc.quicknode.mainnet.arc.io',
  ],
  explorerBaseUrl: 'https://explorer.arc.io',
  usdcAddress: '0x3600000000000000000000000000000000000000',
  eurcAddress: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1',
  cctpTokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
  cctpMessageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
  circleChainCode: 'ARC',
  circleSolanaChainCode: 'SOL',
  appKitChain: 'Arc',
  appKitSolanaChain: 'Solana',
  isMainnet: true,
  cctpDomain: 26,
  minGasFeeFloorGwei: BigInt(20),
};

const TESTNET_CONFIG: NetworkConfig = {
  network: 'testnet',
  chainId: 5042002,
  viemChain: arcTestnet,
  rpcUrls: [
    'https://rpc.testnet.arc.io',
    'https://rpc.blockdaemon.testnet.arc.io',
    'https://rpc.drpc.testnet.arc.io',
    'https://rpc.quicknode.testnet.arc.io',
  ],
  explorerBaseUrl: 'https://explorer.testnet.arc.io',
  usdcAddress: '0x3600000000000000000000000000000000000000',
  eurcAddress: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
  cctpTokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
  cctpMessageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  circleChainCode: 'ARC-TESTNET',
  circleSolanaChainCode: 'SOL-DEVNET',
  appKitChain: 'Arc_Testnet',
  appKitSolanaChain: 'Solana_Devnet',
  isMainnet: false,
  cctpDomain: 26,
  minGasFeeFloorGwei: BigInt(0),
};

/**
 * Pure function returning NetworkConfig for the given network.
 * No other file may hardcode these values.
 */
export function getNetworkConfig(network: Network): NetworkConfig {
  if (network === 'mainnet') {
    return MAINNET_CONFIG;
  }
  if (network === 'testnet') {
    return TESTNET_CONFIG;
  }
  throw new Error(`Unsupported network: ${network}. Must be 'mainnet' or 'testnet'.`);
}

export interface ServerCircleCredentials {
  apiKey: string;
  entitySecret: string;
  walletSetId: string;
  kitKey: string;
}

/**
 * Server-only resolver for Circle credentials per environment.
 * Prevents silent fallback to testnet if mainnet variables are missing.
 */
export function getServerCircleCredentials(network: Network): ServerCircleCredentials {
  if (network === 'mainnet') {
    const apiKey = process.env.CIRCLE_MAINNET_API_KEY;
    const entitySecret = process.env.CIRCLE_MAINNET_ENTITY_SECRET;
    const walletSetId = process.env.CIRCLE_MAINNET_WALLET_SET_ID;
    const kitKey = process.env.CIRCLE_MAINNET_KIT_KEY;

    const missing: string[] = [];
    if (!apiKey) missing.push('CIRCLE_MAINNET_API_KEY');
    if (!entitySecret) missing.push('CIRCLE_MAINNET_ENTITY_SECRET');
    if (!walletSetId) missing.push('CIRCLE_MAINNET_WALLET_SET_ID');
    if (!kitKey) missing.push('CIRCLE_MAINNET_KIT_KEY');

    if (missing.length > 0) {
      throw new Error(
        `[SECURITY ERROR] Missing required Circle Mainnet credential(s): ${missing.join(', ')}. ` +
        `Mainnet requests cannot proceed without dedicated mainnet credentials. Silent fallback to testnet is prohibited.`
      );
    }

    return {
      apiKey: apiKey!,
      entitySecret: entitySecret!,
      walletSetId: walletSetId!,
      kitKey: kitKey!,
    };
  }

  // Testnet credentials resolution
  const apiKey = process.env.CIRCLE_TESTNET_API_KEY || process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_TESTNET_ENTITY_SECRET || process.env.CIRCLE_ENTITY_SECRET;
  const walletSetId = process.env.CIRCLE_TESTNET_WALLET_SET_ID || process.env.CIRCLE_WALLET_SET_ID;
  const kitKey = process.env.CIRCLE_TESTNET_KIT_KEY || process.env.CIRCLE_KIT_KEY;

  const missing: string[] = [];
  if (!apiKey) missing.push('CIRCLE_TESTNET_API_KEY (or CIRCLE_API_KEY)');
  if (!entitySecret) missing.push('CIRCLE_TESTNET_ENTITY_SECRET (or CIRCLE_ENTITY_SECRET)');
  if (!walletSetId) missing.push('CIRCLE_TESTNET_WALLET_SET_ID (or CIRCLE_WALLET_SET_ID)');
  if (!kitKey) missing.push('CIRCLE_TESTNET_KIT_KEY (or CIRCLE_KIT_KEY)');

  if (missing.length > 0) {
    throw new Error(
      `Missing required Circle Testnet credential(s): ${missing.join(', ')}. Please configure your testnet environment variables.`
    );
  }

  return {
    apiKey: apiKey!,
    entitySecret: entitySecret!,
    walletSetId: walletSetId!,
    kitKey: kitKey!,
  };
}
