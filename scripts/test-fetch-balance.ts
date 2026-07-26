import * as dotenv from 'dotenv';
dotenv.config();

import { getWalletBalances } from '../src/lib/arc/rpc';

async function testFetchBalance() {
  console.log('===========================================================');
  console.log('ARC TESTNET REAL-TIME RPC BALANCE FETCH TEST');
  console.log('===========================================================');

  const targetAddress = '0xb191b3ae39685d69c69aabd35bf9f36d1ef60fd1';
  console.log('[1] Target Wallet Address:', targetAddress);
  console.log('[2] Connecting to Arc Testnet Multi-RPC Fallback Chain...');

  try {
    const balances = await getWalletBalances(targetAddress);
    console.log('\n✅ Arc RPC Connection Successful!');
    console.log('   🔹 ERC-20 USDC Balance:', balances.usdc, 'USDC');
    console.log('   🔹 ERC-20 EURC Balance:', balances.eurc, 'EURC');
    console.log('   🔹 Native Gas Token Balance:', balances.nativeGasUsdc, 'USDC');
    console.log('   🔹 Active Providers:', balances.activeProviders.join(', '));
  } catch (err: any) {
    console.error('\n❌ RPC Fetch Error:', err.message || err);
  }
}

testFetchBalance();
