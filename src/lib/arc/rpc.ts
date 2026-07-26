/**
 * Arc Network RPC Client with Multi-Node Provider Fallback
 *
 * Arc Ecosystem Official Node Providers (Docs: https://docs.arc.io/arc/tools/node-providers):
 * 1. Primary: https://rpc.testnet.arc.network
 * 2. Blockdaemon: https://rpc.blockdaemon.testnet.arc.network
 * 3. dRPC: https://rpc.drpc.testnet.arc.network
 * 4. QuickNode (Optional)
 */

import { createPublicClient, fallback, http, formatUnits, parseAbi } from 'viem';
import { defineChain } from 'viem';

// Arc Testnet Chain Definition (Chain ID 5042002)
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18, // Native gas token uses 18 decimals
  },
  rpcUrls: {
    default: {
      http: [
        process.env.ARC_RPC_PRIMARY || 'https://rpc.testnet.arc.network',
        process.env.ARC_RPC_BLOCKDAEMON || 'https://rpc.blockdaemon.testnet.arc.network',
        process.env.ARC_RPC_DRPC || 'https://rpc.drpc.testnet.arc.network',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
});

// Contract Addresses on Arc Testnet
export const ARC_CONTRACTS = {
  USDC: '0x3600000000000000000000000000000000000000' as `0x${string}`,
  EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as `0x${string}`,
  CCTP_TOKEN_MESSENGER: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`,
  CCTP_MESSAGE_TRANSMITTER: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as `0x${string}`,
};

const ERC20_ABI = parseAbi([
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
]);

/**
 * Creates Viem Public Client with fallback transport across official Arc node providers
 */
export function getArcPublicClient() {
  const rpcEndpoints = [
    process.env.ARC_RPC_PRIMARY || 'https://rpc.testnet.arc.network',
    process.env.ARC_RPC_BLOCKDAEMON || 'https://rpc.blockdaemon.testnet.arc.network',
    process.env.ARC_RPC_DRPC || 'https://rpc.drpc.testnet.arc.network',
    process.env.ARC_RPC_QUICKNODE,
  ].filter(Boolean) as string[];

  return createPublicClient({
    chain: arcTestnet,
    transport: fallback(rpcEndpoints.map((url) => http(url))),
  });
}

/**
 * Fetch real-time wallet balances from Arc Testnet RPC
 */
export async function getWalletBalances(address: string) {
  if (!address || !address.startsWith('0x')) {
    throw new Error(`Invalid EVM address: ${address}`);
  }

  const client = getArcPublicClient();
  const targetAddress = address as `0x${string}`;

  try {
    // 1. Get native gas balance (18 decimals)
    const nativeBalanceRaw = await client.getBalance({ address: targetAddress });
    const nativeGasUsdc = formatUnits(nativeBalanceRaw, 18);

    // 2. Get ERC-20 USDC balance (6 decimals)
    const usdcBalanceRaw = await client.readContract({
      address: ARC_CONTRACTS.USDC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [targetAddress],
    });
    const usdcBalance = formatUnits(usdcBalanceRaw as bigint, 6);

    // 3. Get ERC-20 EURC balance (6 decimals)
    let eurcBalance = '0.00';
    try {
      const eurcBalanceRaw = await client.readContract({
        address: ARC_CONTRACTS.EURC,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [targetAddress],
      });
      eurcBalance = formatUnits(eurcBalanceRaw as bigint, 6);
    } catch {
      eurcBalance = '0.00';
    }

    return {
      usdc: usdcBalance,
      eurc: eurcBalance,
      nativeGasUsdc,
      formattedUsdc: parseFloat(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
      formattedEurc: parseFloat(eurcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
      activeProviders: ['Arc Public RPC', 'Blockdaemon', 'dRPC'],
    };
  } catch (error: any) {
    console.error('Error fetching Arc RPC balances:', error);
    throw new Error(`Failed to fetch live balances from Arc Testnet RPC: ${error.message}`);
  }
}
