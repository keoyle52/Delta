/**
 * Phase 4 Verification Script: Circle Developer-Controlled Wallets Mainnet Migration
 * Tests chain codes, credential isolation, silent fallback prevention,
 * and Circle Developer-Controlled Wallets API connectivity.
 */

import { getNetworkConfig, getServerCircleCredentials } from '../src/config/network';
import { getCircleWalletsClient } from '../src/lib/circle/wallets';
import { prisma } from '../src/lib/prisma';

async function runPhase4Verification() {
  console.log('======================================================================');
  console.log('PHASE 4: CIRCLE DEVELOPER-CONTROLLED WALLETS VERIFICATION');
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
  // 1. CHAIN CODE VERIFICATION
  // -------------------------------------------------------------------------
  console.log('--- 1. Chain Code Verification ---');
  const mainnetConfig = getNetworkConfig('mainnet');
  const testnetConfig = getNetworkConfig('testnet');

  assert(mainnetConfig.circleChainCode === 'ARC', 'Mainnet Circle chain code is exactly "ARC"');
  assert(testnetConfig.circleChainCode === 'ARC-TESTNET', 'Testnet Circle chain code is exactly "ARC-TESTNET"');
  assert(mainnetConfig.circleSolanaChainCode === 'SOL', 'Mainnet Circle Solana chain code is exactly "SOL"');
  assert(testnetConfig.circleSolanaChainCode === 'SOL-DEVNET', 'Testnet Circle Solana chain code is exactly "SOL-DEVNET"');

  // -------------------------------------------------------------------------
  // 2. CREDENTIAL ISOLATION & SILENT FALLBACK PREVENTION
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Credential Isolation & Silent Fallback Prevention ---');

  // Verify Mainnet credentials guard (throws if missing, never falls back)
  let mainnetGuardPassed = false;
  try {
    const mainnetCreds = getServerCircleCredentials('mainnet');
    // If environment has mainnet credentials configured, verify they are distinct
    assert(
      !mainnetCreds.apiKey.startsWith('TEST_API_KEY'),
      'Mainnet API Key is NOT a testnet key'
    );
    mainnetGuardPassed = true;
  } catch (err: any) {
    if (err.message.includes('[SECURITY ERROR]') && err.message.includes('Silent fallback to testnet is prohibited')) {
      console.log('  [PASS] Mainnet credential guard: Threw security exception when mainnet keys not set (prevented silent fallback to testnet)');
      mainnetGuardPassed = true;
    } else {
      console.error('  [FAIL] Unexpected error from getServerCircleCredentials(mainnet):', err.message);
    }
  }
  assert(mainnetGuardPassed, 'Mainnet credential security guard verified');

  // Verify Testnet credentials resolution
  try {
    const testnetCreds = getServerCircleCredentials('testnet');
    assert(!!testnetCreds.apiKey, 'Testnet API key is resolved');
    assert(!!testnetCreds.entitySecret, 'Testnet Entity Secret is resolved');
    assert(!!testnetCreds.walletSetId, 'Testnet Wallet Set ID is resolved');
    assert(testnetCreds.apiKey.startsWith('TEST_API_KEY'), 'Testnet API key starts with TEST_API_KEY');
  } catch (err: any) {
    assert(false, `Testnet credentials failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 3. LIVE CIRCLE WALLETS SDK CLIENT & API CONNECTIVITY
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Live Circle Wallets SDK & API Connectivity (Testnet) ---');
  try {
    const client = getCircleWalletsClient('testnet');
    assert(!!client, 'Circle Developer-Controlled Wallets client instantiated for testnet');

    const testnetCreds = getServerCircleCredentials('testnet');
    const walletSetRes = await client.getWalletSet({ id: testnetCreds.walletSetId });
    const walletSet = walletSetRes.data?.walletSet;

    assert(!!walletSet, `Live Circle API returned WalletSet (id: ${walletSet?.id})`);
    assert(walletSet?.id === testnetCreds.walletSetId, `WalletSet ID matches configured ID: ${walletSet?.id}`);
  } catch (err: any) {
    console.error(`  [FAIL] Circle API call failed:`, err.response?.data || err.message);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // 4. DATABASE WALLET MULTI-NETWORK ISOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Database Multi-Network Wallet Isolation ---');
  try {
    const wallets = await prisma.wallet.findMany({ take: 10 });
    assert(wallets.length > 0, `Found ${wallets.length} existing wallets in Neon Postgres DB`);

    const allHaveNetwork = wallets.every((w) => w.network === 'testnet' || w.network === 'mainnet');
    assert(allHaveNetwork, 'All wallets in database have a valid network property');

    const allTestnetHaveArcTestnet = wallets
      .filter((w) => w.network === 'testnet')
      .every((w) => w.blockchain === 'ARC-TESTNET');
    assert(allTestnetHaveArcTestnet, 'All testnet wallets have blockchain="ARC-TESTNET"');
  } catch (err: any) {
    assert(false, `Database query failed: ${err.message}`);
  }

  console.log('\n======================================================================');
  if (allPassed) {
    console.log('ALL PHASE 4 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('SOME CHECKS FAILED!');
    process.exit(1);
  }
  console.log('======================================================================');
}

runPhase4Verification().catch((err) => {
  console.error('Fatal error running Phase 4 verification:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
