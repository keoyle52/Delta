import * as dotenv from 'dotenv';
dotenv.config();

import { getAppKitInstance, getCircleWalletsAdapter } from '../src/lib/circle/app-kit';
import { getNetworkConfig, getServerCircleCredentials } from '../src/config/network';

async function runPhase5Verification() {
  console.log('======================================================================');
  console.log('PHASE 5: CIRCLE APP KIT MIGRATION VERIFICATION');
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
  // 1. APP KIT INSTANTIATION & SUPPORTED CHAINS
  // -------------------------------------------------------------------------
  console.log('--- 1. App Kit Instantiation & Supported Chains ---');
  const kit = getAppKitInstance();
  assert(!!kit, 'AppKit instance instantiated successfully');

  const bridgeChains = kit.getSupportedChains('bridge');
  assert(bridgeChains.length > 0, `App Kit supports ${bridgeChains.length} chains for bridge operations`);

  // Verify Mainnet and Testnet destination chains
  const mainnetConfig = getNetworkConfig('mainnet');
  const testnetConfig = getNetworkConfig('testnet');

  assert(mainnetConfig.appKitChain === 'Arc', 'Mainnet App Kit chain identifier is "Arc"');
  assert(testnetConfig.appKitChain === 'Arc_Testnet', 'Testnet App Kit chain identifier is "Arc_Testnet"');

  assert(mainnetConfig.appKitSolanaChain === 'Solana', 'Mainnet App Kit Solana identifier is "Solana"');
  assert(testnetConfig.appKitSolanaChain === 'Solana_Devnet', 'Testnet App Kit Solana identifier is "Solana_Devnet"');

  // Verify CCTP forwarder support for key bridge destinations
  const solanaMainnetChain: any = bridgeChains.find((c: any) => c.chain === 'Solana' || c.name === 'Solana');
  const hasSolanaMainnetForwarder = Boolean(
    solanaMainnetChain?.cctp?.forwarderSupported?.destination ||
    solanaMainnetChain?.forwarderSupported?.destination ||
    solanaMainnetChain?.forwarderSupported
  );
  assert(hasSolanaMainnetForwarder, 'Solana Mainnet has CCTP forwarder support for bridge destination');

  const baseMainnetChain: any = bridgeChains.find((c: any) => c.chain === 'Base' || c.name === 'Base');
  const hasBaseMainnetForwarder = Boolean(
    baseMainnetChain?.cctp?.forwarderSupported?.destination ||
    baseMainnetChain?.forwarderSupported?.destination ||
    baseMainnetChain?.forwarderSupported
  );
  assert(hasBaseMainnetForwarder, 'Base Mainnet has CCTP forwarder support for bridge destination');

  const solanaDevnetChain: any = bridgeChains.find((c: any) => c.chain === 'Solana_Devnet' || c.name === 'Solana_Devnet');
  const hasSolanaDevnetForwarder = Boolean(
    solanaDevnetChain?.cctp?.forwarderSupported?.destination ||
    solanaDevnetChain?.forwarderSupported?.destination ||
    solanaDevnetChain?.forwarderSupported
  );
  assert(hasSolanaDevnetForwarder, 'Solana Devnet has CCTP forwarder support for bridge destination');

  // -------------------------------------------------------------------------
  // 2. CIRCLE WALLETS ADAPTER NETWORK ISOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Circle Wallets Adapter Network Isolation ---');

  // Testnet adapter creation with real testnet credentials
  try {
    const testnetAdapter = getCircleWalletsAdapter('testnet');
    assert(!!testnetAdapter, 'CircleWalletsAdapter successfully created for testnet');
  } catch (err: any) {
    assert(false, `Testnet adapter creation failed: ${err.message}`);
  }

  // Mainnet adapter creation guard (must throw security error if mainnet keys absent)
  let mainnetAdapterGuardPassed = false;
  try {
    const mainnetAdapter = getCircleWalletsAdapter('mainnet');
    assert(!!mainnetAdapter, 'Mainnet adapter created with explicit mainnet credentials');
    mainnetAdapterGuardPassed = true;
  } catch (err: any) {
    if (err.message.includes('[SECURITY ERROR]') && err.message.includes('Silent fallback to testnet is prohibited')) {
      console.log('  [PASS] Mainnet adapter guard: Threw security exception when mainnet keys not configured');
      mainnetAdapterGuardPassed = true;
    } else {
      console.error('  [FAIL] Unexpected error from getCircleWalletsAdapter(mainnet):', err.message);
    }
  }
  assert(mainnetAdapterGuardPassed, 'Mainnet adapter security guard verified');

  // -------------------------------------------------------------------------
  // 3. CCTP CONTRACT ADDRESSES SPECIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 3. CCTP Contract Addresses Specification ---');
  assert(
    mainnetConfig.cctpTokenMessenger === '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    'Mainnet TokenMessenger is 0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d'
  );
  assert(
    mainnetConfig.cctpMessageTransmitter === '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    'Mainnet MessageTransmitter is 0x81D40F21F12A8F0E3252Bccb954D722d4c464B64'
  );
  assert(
    testnetConfig.cctpTokenMessenger === '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    'Testnet TokenMessenger is 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA'
  );
  assert(
    testnetConfig.cctpMessageTransmitter === '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    'Testnet MessageTransmitter is 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275'
  );

  console.log('\n======================================================================');
  if (allPassed) {
    console.log('ALL PHASE 5 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('SOME CHECKS FAILED!');
    process.exit(1);
  }
  console.log('======================================================================');
}

runPhase5Verification().catch((err) => {
  console.error('Fatal error running Phase 5 verification:', err);
  process.exit(1);
});
