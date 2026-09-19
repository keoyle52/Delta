/**
 * Arc Network RPC Client with Primary & Fallback Transports
 * Uses native viem/chains (arc, arcTestnet) and dynamic network configuration.
 */

import { createPublicClient, fallback, http, formatUnits, parseAbi } from 'viem';
import { getNetworkConfig, Network } from '@/config/network';

const ERC20_ABI = parseAbi([
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
]);

/**
 * Creates Viem Public Client with multi-RPC fallback transport per network.
 */
export function getArcPublicClient(network: Network = 'mainnet') {
  const config = getNetworkConfig(network);

  return createPublicClient({
    chain: config.viemChain,
    transport: fallback(config.rpcUrls.map((url) => http(url))),
  });
}

/**
 * Fetch real-time wallet balances from Arc RPC for the given network.
 * Note: USDC on Arc is read ONLY through the 6-decimal ERC-20 interface for user balances.
 * The 18-decimal native balance represents the same underlying tokens through the gas interface.
 */
export async function getWalletBalances(address: string, network: Network = 'mainnet') {
  if (!address || !address.startsWith('0x')) {
    throw new Error(`Invalid EVM address: ${address}`);
  }

  const config = getNetworkConfig(network);
  const client = getArcPublicClient(network);
  const targetAddress = address as `0x${string}`;

  try {
    // 1. Get ERC-20 USDC balance (6 decimals)
    const usdcBalanceRaw = await client.readContract({
      address: config.usdcAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [targetAddress],
    });
    const usdcBalance = formatUnits(usdcBalanceRaw as bigint, 6);

    // 2. Get ERC-20 EURC balance (6 decimals)
    let eurcBalance = '0.00';
    try {
      const eurcBalanceRaw = await client.readContract({
        address: config.eurcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [targetAddress],
      });
      eurcBalance = formatUnits(eurcBalanceRaw as bigint, 6);
    } catch {
      eurcBalance = '0.00';
    }

    // 3. Read native gas balance (18 decimals) for gas estimation and internal reserve checks only
    const nativeGasRaw = await client.getBalance({ address: targetAddress });
    const nativeGasUsdc = formatUnits(nativeGasRaw, 18);

    return {
      usdc: usdcBalance,
      eurc: eurcBalance,
      nativeGasUsdc,
      formattedUsdc: parseFloat(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
      formattedEurc: parseFloat(eurcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
      network,
      chainId: config.chainId,
      activeProviders: [...config.rpcUrls],
    };
  } catch (error: any) {
    console.error(`Error fetching Arc ${network} RPC balances:`, error);
    throw new Error(`Failed to fetch live balances from Arc ${network} RPC: ${error.message}`);
  }
}

/**
 * Fetch transaction receipt from Arc RPC and calculate actual USDC gas fee paid.
 * Returns null if receipt is not available or if query fails.
 */
export async function getTxFeePaidUsdc(txHash: string, network: Network = 'mainnet'): Promise<number | null> {
  if (!txHash || typeof txHash !== 'string' || !txHash.startsWith('0x') || txHash.startsWith('0xsim-')) {
    return null;
  }
  try {
    const client = getArcPublicClient(network);
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (!receipt || !receipt.gasUsed || !receipt.effectiveGasPrice) {
      return null;
    }
    const totalGasCostWei = receipt.gasUsed * receipt.effectiveGasPrice;
    // Native gas token on Arc uses 18 decimals (USDC)
    const feeUsdc = parseFloat(formatUnits(totalGasCostWei, 18));
    return isNaN(feeUsdc) ? null : feeUsdc;
  } catch (error: any) {
    console.warn(`[ARC ${network} RPC] Could not fetch tx receipt for gas calculation (${txHash}):`, error.message || error);
    return null;
  }
}

/**
 * Returns the current network gas price in Wei, clamped to the network's minimum gas fee floor.
 * On Arc Mainnet, minGasFeeFloorGwei = 20n (20 Gwei = 20_000_000_000 Wei).
 * On Arc Testnet, minGasFeeFloorGwei = 0n.
 */
export async function getGasPriceWithFloor(network: Network = 'mainnet'): Promise<bigint> {
  const config = getNetworkConfig(network);
  const client = getArcPublicClient(network);
  const floorWei = config.minGasFeeFloorGwei * BigInt(10 ** 9);

  try {
    const rpcGasPrice = await client.getGasPrice();
    return rpcGasPrice < floorWei ? floorWei : rpcGasPrice;
  } catch (error: any) {
    console.warn(`[ARC ${network} RPC] Could not fetch gasPrice, defaulting to floor:`, error.message || error);
    return floorWei > BigInt(0) ? floorWei : BigInt(20) * BigInt(10 ** 9);
  }
}

/**
 * Estimate gas fee in USDC for a given gas limit, clamped to the minimum gas fee floor.
 * Native gas on Arc uses 18 decimals.
 */
export async function estimateGasFeeUsdc(gasLimit: bigint, network: Network = 'mainnet'): Promise<number> {
  const gasPrice = await getGasPriceWithFloor(network);
  const totalCostWei = gasLimit * gasPrice;
  return parseFloat(formatUnits(totalCostWei, 18));
}
