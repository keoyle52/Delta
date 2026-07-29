import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';
import { getWalletBalances } from '../src/lib/arc/rpc';

async function checkWalletGasReserve() {
  console.log('===========================================================');
  console.log('WALLET BALANCE & GAS RESERVE HYPOTHESIS TEST');
  console.log('===========================================================');

  const users = await prisma.user.findMany({
    include: {
      wallet: true,
      workflows: true,
    },
  });

  for (const u of users) {
    if (!u.wallet) continue;

    console.log(`\n👤 User: ${u.email}`);
    console.log(`   Wallet Address: ${u.wallet.address}`);

    try {
      const balances = await getWalletBalances(u.wallet.address);
      console.log(`   💰 Live Arc Testnet USDC Balance: ${balances.usdc} USDC`);
      console.log(`   💰 Live Arc Testnet EURC Balance: ${balances.eurc} EURC`);

      for (const wf of u.workflows) {
        const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : (wf.nodes || []);
        const swapNodes = nodes.filter((n: any) => n.type === 'swap');

        console.log(`   📋 Workflow: "${wf.name}" (ID: ${wf.id})`);
        for (const sn of swapNodes) {
          const pct = parseFloat(sn.data?.percentage || '40');
          console.log(`      └─ Swap Node "${sn.data?.label || 'Swap'}": percentage = ${pct}%`);

          const testTriggers = ['1.00', '10.00', '50.00'];
          for (const trig of testTriggers) {
            const trigNum = parseFloat(trig);
            const actionAmount = (trigNum * pct) / 100;
            const remainingBalanceAfterSwap = parseFloat(balances.usdc) - actionAmount;
            console.log(`         • Trigger ${trig} USDC -> Swap Amount: ${actionAmount.toFixed(4)} USDC | Wallet Balance After Swap: ${remainingBalanceAfterSwap.toFixed(4)} USDC`);
          }
        }
      }
    } catch (err: any) {
      console.error(`   ❌ Balance Query Error: ${err.message}`);
    }
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

checkWalletGasReserve();
