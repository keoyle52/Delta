import * as dotenv from 'dotenv';
dotenv.config();

import { getWalletBalances } from '../src/lib/arc/rpc';

async function testDashboardApiBalance() {
  console.log('===========================================================');
  console.log('DELTA DASHBOARD API BALANCE ENDPOINT TEST');
  console.log('===========================================================');

  const targetAddress = '0xb191b3ae39685d69c69aabd35bf9f36d1ef60fd1';

  try {
    const data = await getWalletBalances(targetAddress);
    const apiPayload = {
      address: targetAddress,
      usdc: data.usdc,
      eurc: data.eurc,
      nativeGasUsdc: data.nativeGasUsdc,
      formattedUsdc: data.formattedUsdc,
      formattedEurc: data.formattedEurc,
      activeProviders: data.activeProviders,
    };

    console.log('✅ Dashboard API Response Payload:');
    console.log(JSON.stringify(apiPayload, null, 2));
  } catch (err: any) {
    console.error('API Test Error:', err.message || err);
  }
}

testDashboardApiBalance();
