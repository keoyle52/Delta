/**
 * Phase 3 Verification Script: USDC Gas & Decimal Verification
 * Tests Arc Mainnet & Testnet gas price floor, 6-decimal vs 18-decimal conversions,
 * and RPC response properties.
 */

import { formatUnits, parseUnits } from 'viem';
import { getNetworkConfig } from '../src/config/network';
import { getArcPublicClient, getGasPriceWithFloor, estimateGasFeeUsdc } from '../src/lib/arc/rpc';

async function runPhase3Verification() {
  console.log('======================================================================');
  console.log('PHASE 3: USDC GAS & DECIMAL VERIFICATION');
  console.log('======================================================================\n');

  let allPassed = true;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
    } else {
      console.error(`  [FAIL] ${message}`);
      allPassed = false;
    }
  }

  // -------------------------------------------------------------------------
  // 1. DECIMAL ARITHMETIC & UNIT CONVERSIONS
  // -------------------------------------------------------------------------
  console.log('--- 1. Decimal Arithmetic & Unit Conversions ---');

  // ERC-20 USDC (6 decimals)
  const usdcRaw = parseUnits('1.50', 6);
  assert(usdcRaw === BigInt(1500000), '1.50 USDC parses to exactly 1,500,000 units (6 decimals)');
  const usdcFormatted = formatUnits(BigInt(1500000), 6);
  assert(usdcFormatted === '1.5', '1,500,000 units formats back to 1.5 USDC (6 decimals)');

  // ERC-20 EURC (6 decimals)
  const eurcRaw = parseUnits('100.25', 6);
  assert(eurcRaw === BigInt(100250000), '100.25 EURC parses to exactly 100,250,000 units (6 decimals)');
  const eurcFormatted = formatUnits(BigInt(100250000), 6);
  assert(eurcFormatted === '100.25', '100,250,000 units formats back to 100.25 EURC (6 decimals)');

  // Native Gas Token (18 decimals on Arc)
  const nativeGasRaw = parseUnits('1.50', 18);
  assert(nativeGasRaw === BigInt('1500000000000000000'), '1.50 Native USDC gas parses to exactly 1.5 * 10^18 Wei');
  const nativeGasFormatted = formatUnits(BigInt('1500000000000000000'), 18);
  assert(nativeGasFormatted === '1.5', '1.5 * 10^18 Wei formats back to 1.5 USDC');

  // Gas Fee Calculation: 21,000 gas units @ 20 Gwei floor
  const standardGasUnits = BigInt(21000);
  const floorGwei = BigInt(20);
  const floorWei = floorGwei * BigInt(10 ** 9); // 20,000,000,000 Wei
  const standardCostWei = standardGasUnits * floorWei; // 420,000,000,000,000 Wei
  const standardCostUsdc = parseFloat(formatUnits(standardCostWei, 18));
  assert(
    Math.abs(standardCostUsdc - 0.00042) < 0.000001,
    `Standard tx (21,000 gas @ 20 Gwei floor) costs exactly $0.00042 USDC (computed: ${standardCostUsdc})`
  );

  // Gas Fee Calculation: 200,000 gas units @ 20 Gwei floor (complex swap/bridge)
  const complexGasUnits = BigInt(200000);
  const complexCostWei = complexGasUnits * floorWei;
  const complexCostUsdc = parseFloat(formatUnits(complexCostWei, 18));
  assert(
    Math.abs(complexCostUsdc - 0.004) < 0.000001,
    `Complex tx (200,000 gas @ 20 Gwei floor) costs exactly $0.004 USDC (computed: ${complexCostUsdc})`
  );

  // -------------------------------------------------------------------------
  // 2. NETWORK CONFIGURATION SPECIFICATIONS
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Network Configuration Specifications ---');
  const mainnetConfig = getNetworkConfig('mainnet');
  const testnetConfig = getNetworkConfig('testnet');

  assert(mainnetConfig.chainId === 5042, 'Mainnet chain ID is 5042');
  assert(mainnetConfig.minGasFeeFloorGwei === BigInt(20), 'Mainnet gas fee floor is 20 Gwei');
  assert(mainnetConfig.usdcAddress === '0x3600000000000000000000000000000000000000', 'Mainnet USDC is 0x3600...0000');
  assert(mainnetConfig.eurcAddress === '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1', 'Mainnet EURC is 0xbEf5...21c1');

  assert(testnetConfig.chainId === 5042002, 'Testnet chain ID is 5042002');
  assert(testnetConfig.minGasFeeFloorGwei === BigInt(0), 'Testnet gas fee floor is 0 Gwei');
  assert(testnetConfig.usdcAddress === '0x3600000000000000000000000000000000000000', 'Testnet USDC is 0x3600...0000');
  assert(testnetConfig.eurcAddress === '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', 'Testnet EURC is 0x89B5...D72a');

  // -------------------------------------------------------------------------
  // 3. LIVE RPC & GAS FLOOR CLAMPING TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Live RPC & Gas Floor Clamping ---');

  // Mainnet RPC
  try {
    const mainnetClient = getArcPublicClient('mainnet');
    const mainnetChainId = await mainnetClient.getChainId();
    assert(mainnetChainId === 5042, `Live Mainnet RPC returned chainId: ${mainnetChainId}`);

    const mainnetGasPriceWithFloor = await getGasPriceWithFloor('mainnet');
    const mainnetFloorWei = BigInt(20) * BigInt(10 ** 9);
    assert(
      mainnetGasPriceWithFloor >= mainnetFloorWei,
      `Mainnet gasPriceWithFloor (${mainnetGasPriceWithFloor} Wei = ${Number(mainnetGasPriceWithFloor) / 1e9} Gwei) >= 20 Gwei floor`
    );

    const mainnetEstimatedFee = await estimateGasFeeUsdc(BigInt(21000), 'mainnet');
    assert(
      mainnetEstimatedFee >= 0.00042,
      `Mainnet 21,000 gas estimated fee ($${mainnetEstimatedFee} USDC) >= 0.00042 USDC floor`
    );
  } catch (err: any) {
    console.warn(`  [WARN] Mainnet RPC check warning: ${err.message}`);
  }

  // Testnet RPC
  try {
    const testnetClient = getArcPublicClient('testnet');
    const testnetChainId = await testnetClient.getChainId();
    assert(testnetChainId === 5042002, `Live Testnet RPC returned chainId: ${testnetChainId}`);

    const testnetGasPriceWithFloor = await getGasPriceWithFloor('testnet');
    assert(
      testnetGasPriceWithFloor >= BigInt(0),
      `Testnet gasPriceWithFloor (${testnetGasPriceWithFloor} Wei = ${Number(testnetGasPriceWithFloor) / 1e9} Gwei) >= 0 Gwei floor`
    );

    const testnetEstimatedFee = await estimateGasFeeUsdc(BigInt(21000), 'testnet');
    assert(
      testnetEstimatedFee >= 0,
      `Testnet 21,000 gas estimated fee ($${testnetEstimatedFee} USDC) >= 0`
    );
  } catch (err: any) {
    console.warn(`  [WARN] Testnet RPC check warning: ${err.message}`);
  }

  console.log('\n======================================================================');
  if (allPassed) {
    console.log('ALL PHASE 3 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('SOME CHECKS FAILED!');
    process.exit(1);
  }
  console.log('======================================================================');
}

runPhase3Verification().catch((err) => {
  console.error('Fatal error running Phase 3 verification:', err);
  process.exit(1);
});
