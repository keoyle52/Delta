import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';
import { executeAppKitBridge } from '../src/lib/circle/app-kit';

async function testBridgeBaseSepolia() {
  console.log('===========================================================');
  console.log('DELTA REAL-TIME CCTP BRIDGE TEST — DESTINATION: Base_Sepolia');
  console.log('===========================================================');

  // 1. Find or create demo user & wallet in DB
  let user = await prisma.user.findFirst({
    include: { wallet: true },
  });

  if (!user || !user.wallet) {
    console.error('❌ User or wallet not found in DB.');
    process.exit(1);
  }

  const walletAddress = user.wallet.address;
  const destinationAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const destinationChain = 'Base_Sepolia';
  const amountUsdc = '1.00';

  console.log('[1] User Email:', user.email);
  console.log('[2] Sender Arc Wallet Address:', walletAddress);
  console.log('[3] Target Recipient Address:', destinationAddress);
  console.log('[4] Destination Chain:', destinationChain);

  // 2. Create Execution row in DB
  const execution = await prisma.execution.create({
    data: {
      workflowId: (await prisma.workflow.findFirst({ where: { userId: user.id } }))?.id || 'demo-workflow-id',
      triggerTxHash: `0x-trigger-tx-${Date.now()}`,
      triggerAmount: '10.00',
      status: 'RUNNING',
      stepLogs: [
        {
          stepId: 'trigger-1',
          nodeType: 'trigger',
          nodeName: 'USDC Received',
          status: 'COMPLETE',
          details: 'Received 10.00 USDC on Arc Testnet',
          timestamp: new Date().toISOString(),
        },
        {
          stepId: 'bridge-1',
          nodeType: 'bridge',
          nodeName: 'Bridge to Base_Sepolia',
          status: 'RUNNING',
          destinationChain,
          details: `Initiating CCTP bridge of ${amountUsdc} USDC from Arc Testnet to ${destinationChain}...`,
          timestamp: new Date().toISOString(),
        },
      ] as any,
      startedAt: new Date(),
    },
  });

  console.log('\n[5] Created DB Execution Record ID:', execution.id);

  // 3. Execute real Circle App Kit CCTP Bridge call
  console.log('\n[6] Invoking kit.bridge() via Circle App Kit SDK...');
  try {
    const bridgeResult = await executeAppKitBridge({
      userWalletAddress: walletAddress,
      destinationAddress,
      amountUsdc,
      destinationChain,
    });

    console.log('\n[7] RAW App Kit Response:', JSON.stringify(bridgeResult, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

    await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: 'COMPLETE',
        finishedAt: new Date(),
        stepLogs: [
          {
            stepId: 'trigger-1',
            nodeType: 'trigger',
            nodeName: 'USDC Received',
            status: 'COMPLETE',
            details: 'Received 10.00 USDC on Arc Testnet',
            timestamp: new Date().toISOString(),
          },
          {
            stepId: 'bridge-1',
            nodeType: 'bridge',
            nodeName: 'Bridge to Base_Sepolia',
            status: 'COMPLETE',
            destinationChain,
            txHash: bridgeResult?.txHash || '0x-bridge-completed',
            details: `Bridged ${amountUsdc} USDC via CCTP to ${destinationChain} recipient: ${destinationAddress}`,
            timestamp: new Date().toISOString(),
          },
        ] as any,
      },
    });
  } catch (err: any) {
    console.error('\n❌ REAL RUNTIME APP KIT BRIDGE NOTICE / FAILURE:');
    console.error('Error Name:', err.name);
    console.error('Error Message:', err.message);
    if (err.stack) console.error('Stack Trace:', err.stack);

    await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        stepLogs: [
          {
            stepId: 'trigger-1',
            nodeType: 'trigger',
            nodeName: 'USDC Received',
            status: 'COMPLETE',
            details: 'Received 10.00 USDC on Arc Testnet',
            timestamp: new Date().toISOString(),
          },
          {
            stepId: 'bridge-1',
            nodeType: 'bridge',
            nodeName: 'Bridge to Base_Sepolia',
            status: 'FAILED',
            destinationChain,
            error: err.message,
            timestamp: new Date().toISOString(),
          },
        ] as any,
      },
    });
  }

  // 4. Query & print updated Execution record from DB
  const finalRecord = await prisma.execution.findUnique({
    where: { id: execution.id },
  });

  console.log('\n[8] ACTUAL DB ROW (prisma.execution.findUnique):');
  console.log(JSON.stringify(finalRecord, null, 2));

  console.log('\n===========================================================');
  await prisma.$disconnect();
}

testBridgeBaseSepolia();
