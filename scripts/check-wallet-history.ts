import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';
import { getWalletBalances } from '../src/lib/arc/rpc';

async function checkWalletHistory() {
  console.log('===========================================================');
  console.log('WALLET TRANSACTION & BALANCE HISTORY CHECK');
  console.log('===========================================================');

  const walletAddress = '0xb191b3ae39685d69c69aabd35bf9f36d1ef60fd1';

  console.log('[1] Checking Arc Testnet RPC Balances for:', walletAddress);
  try {
    const balances = await getWalletBalances(walletAddress);
    console.log('   🔹 Arc USDC Balance:', balances.usdc, 'USDC');
    console.log('   🔹 Arc EURC Balance:', balances.eurc, 'EURC');
  } catch (err: any) {
    console.error('   ❌ Error fetching Arc balances:', err.message);
  }

  console.log('\n[2] Querying Recent Executions & Step Logs in Neon DB...');
  const executions = await prisma.execution.findMany({
    take: 10,
    orderBy: { startedAt: 'desc' },
  });

  console.log(`Found ${executions.length} recent executions:`);
  for (const exec of executions) {
    console.log(`\n--- Execution ID: ${exec.id} | Status: ${exec.status} | Started: ${exec.startedAt.toISOString()} ---`);
    console.log('Step Logs:', JSON.stringify(exec.stepLogs, null, 2));
  }

  console.log('\n===========================================================');
  await prisma.$disconnect();
}

checkWalletHistory();
