import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillTestnetNetwork() {
  console.log('🔄 Starting backfill of existing database records to "testnet"...');

  try {
    const walletsUpdated = await prisma.wallet.updateMany({
      data: {
        network: 'testnet',
        blockchain: 'ARC-TESTNET',
      },
    });
    console.log(`✅ Backfilled ${walletsUpdated.count} Wallet records to network='testnet' / blockchain='ARC-TESTNET'.`);

    const workflowsUpdated = await prisma.workflow.updateMany({
      data: {
        network: 'testnet',
      },
    });
    console.log(`✅ Backfilled ${workflowsUpdated.count} Workflow records to network='testnet'.`);

    const executionsUpdated = await prisma.execution.updateMany({
      data: {
        network: 'testnet',
      },
    });
    console.log(`✅ Backfilled ${executionsUpdated.count} Execution records to network='testnet'.`);

    console.log('🎉 Database backfill to testnet completed successfully.');
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backfillTestnetNetwork();
