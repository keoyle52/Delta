/**
 * Phase 10: Post-Deploy Smoke Test on Arc Mainnet (#5042)
 * Validates real onchain contract states on Arc Mainnet,
 * gas fee floors, CCTP contracts, and live production endpoints.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { parseAbi } from 'viem';
import { getNetworkConfig } from '../src/config/network';
import { getArcPublicClient, getGasPriceWithFloor, estimateGasFeeUsdc } from '../src/lib/arc/rpc';
import axios from 'axios';

const ERC20_METADATA_ABI = parseAbi([
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
]);

async function runMainnetSmokeTest() {
  console.log('======================================================================');
  console.log('PHASE 10: POST-DEPLOY SMOKE TEST ON ARC MAINNET (#5042)');
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

  const mainnetConfig = getNetworkConfig('mainnet');
  const mainnetClient = getArcPublicClient('mainnet');

  // -------------------------------------------------------------------------
  // 1. LIVE ARC MAINNET RPC & CHAIN ID VERIFICATION
  // -------------------------------------------------------------------------
  console.log('--- 1. Live Arc Mainnet RPC & Chain ID ---');
  try {
    const chainId = await mainnetClient.getChainId();
    assert(chainId === 5042, `Arc Mainnet RPC returned Chain ID: ${chainId} (Expected: 5042)`);

    const blockNumber = await mainnetClient.getBlockNumber();
    assert(blockNumber > 0n, `Arc Mainnet current block number: ${blockNumber.toString()}`);
  } catch (err: any) {
    assert(false, `Arc Mainnet RPC connection failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 2. LIVE ARC MAINNET USDC CONTRACT VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Live Arc Mainnet USDC Contract (0x3600...0000) ---');
  try {
    const [decimals, symbol, name] = await Promise.all([
      mainnetClient.readContract({
        address: mainnetConfig.usdcAddress as `0x${string}`,
        abi: ERC20_METADATA_ABI,
        functionName: 'decimals',
      }),
      mainnetClient.readContract({
        address: mainnetConfig.usdcAddress as `0x${string}`,
        abi: ERC20_METADATA_ABI,
        functionName: 'symbol',
      }),
      mainnetClient.readContract({
        address: mainnetConfig.usdcAddress as `0x${string}`,
        abi: ERC20_METADATA_ABI,
        functionName: 'name',
      }),
    ]);

    assert(decimals === 6, `USDC decimals on Arc Mainnet: ${decimals} (Expected: 6)`);
    assert(symbol === 'USDC', `USDC symbol on Arc Mainnet: "${symbol}" (Expected: "USDC")`);
    assert(typeof name === 'string' && name.length > 0, `USDC name on Arc Mainnet: "${name}"`);
  } catch (err: any) {
    assert(false, `Arc Mainnet USDC contract check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 3. LIVE ARC MAINNET EURC CONTRACT VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Live Arc Mainnet EURC Contract (0xbEf5...21c1) ---');
  try {
    const [decimals, symbol] = await Promise.all([
      mainnetClient.readContract({
        address: mainnetConfig.eurcAddress as `0x${string}`,
        abi: ERC20_METADATA_ABI,
        functionName: 'decimals',
      }),
      mainnetClient.readContract({
        address: mainnetConfig.eurcAddress as `0x${string}`,
        abi: ERC20_METADATA_ABI,
        functionName: 'symbol',
      }),
    ]);

    assert(decimals === 6, `EURC decimals on Arc Mainnet: ${decimals} (Expected: 6)`);
    assert(symbol === 'EURC', `EURC symbol on Arc Mainnet: "${symbol}" (Expected: "EURC")`);
  } catch (err: any) {
    assert(false, `Arc Mainnet EURC contract check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 4. LIVE ARC MAINNET CCTP CONTRACTS VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Live Arc Mainnet CCTP Contracts Bytecode ---');
  try {
    const [tokenMessengerCode, messageTransmitterCode] = await Promise.all([
      mainnetClient.getBytecode({ address: mainnetConfig.cctpTokenMessenger as `0x${string}` }),
      mainnetClient.getBytecode({ address: mainnetConfig.cctpMessageTransmitter as `0x${string}` }),
    ]);

    assert(
      !!tokenMessengerCode && tokenMessengerCode !== '0x',
      `CCTP TokenMessenger bytecode exists at ${mainnetConfig.cctpTokenMessenger}`
    );
    assert(
      !!messageTransmitterCode && messageTransmitterCode !== '0x',
      `CCTP MessageTransmitter bytecode exists at ${mainnetConfig.cctpMessageTransmitter}`
    );
  } catch (err: any) {
    assert(false, `CCTP contract bytecode check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 5. LIVE GAS PRICE & 20 GWEI FLOOR VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Live Gas Price & 20 Gwei Floor ---');
  try {
    const liveGasPrice = await getGasPriceWithFloor('mainnet');
    const floorWei = BigInt(20) * BigInt(10 ** 9);
    const gasPriceGwei = Number(liveGasPrice) / 1e9;

    assert(
      liveGasPrice >= floorWei,
      `Gas price with floor: ${gasPriceGwei.toFixed(2)} Gwei (${liveGasPrice.toString()} Wei) >= 20 Gwei floor`
    );

    const standardTransferFee = await estimateGasFeeUsdc(BigInt(21000), 'mainnet');
    assert(
      standardTransferFee >= 0.00042,
      `Standard 21k gas transfer estimated fee: $${standardTransferFee.toFixed(6)} USDC >= $0.00042 USDC floor`
    );
  } catch (err: any) {
    assert(false, `Gas price check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 6. LIVE PRODUCTION ENDPOINT HEALTH CHECK
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Live Production Endpoint Health Check (https://delta-omega-black.vercel.app) ---');
  try {
    const statsUrl = 'https://delta-omega-black.vercel.app/api/stats/arc-advantage';
    const res = await axios.get(statsUrl, { timeout: 10000 });
    assert(res.status === 200, `GET /api/stats/arc-advantage returned HTTP 200 OK`);
    assert(res.data && typeof res.data.totals === 'object', 'Response contains telemetry totals object');
    assert(res.data.totals.targetBaseFeeUsd === 0.01, 'Target base fee is $0.01');
  } catch (err: any) {
    assert(false, `Live production endpoint failed: ${err.message}`);
  }

  console.log('\n======================================================================');
  if (allPassed) {
    console.log('ALL PHASE 10 SMOKE TEST CHECKS PASSED ON ARC MAINNET!');
  } else {
    console.error('SOME SMOKE TEST CHECKS FAILED!');
    process.exit(1);
  }
  console.log('======================================================================');
}

runMainnetSmokeTest().catch((err) => {
  console.error('Fatal error running smoke test:', err);
  process.exit(1);
});
