import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';
import { executeAppKitSwap, executeAppKitBridge, executeAppKitSend } from '../src/lib/circle/app-kit';

async function simulateCircleWebhook() {
  console.log('===========================================================');
  console.log('SIMULATING CIRCLE INBOUND TRANSFER WEBHOOK FOR WALLET 2');
  console.log('===========================================================');

  const targetWalletId = 'b98c8c33-efd0-5cec-a730-ce954cfb6f4a';
  const sampleTxHash = `0x-circle-faucet-sim-${Date.now().toString(16)}`;
  const transferAmountStr = '20.00';

  console.log('[1] Target Wallet ID:', targetWalletId);
  console.log('[2] Querying Neon Postgres for matching wallet...');

  const wallet = await prisma.wallet.findFirst({
    where: {
      OR: [
        { circleWalletId: { equals: targetWalletId } },
        { address: { equals: '0x396a7e5fbac43d149151627d71a01a121b9da989', mode: 'insensitive' } },
      ],
    },
    include: {
      user: {
        include: {
          workflows: {
            where: { isActive: true },
          },
        },
      },
    },
  });

  if (!wallet) {
    console.error('❌ Wallet not found in DB!');
    process.exit(1);
  }

  console.log('   ✅ Wallet Found!');
  console.log('   Address:', wallet.address);
  console.log('   User Email:', wallet.user.email);
  console.log('   Active Workflows:', wallet.user.workflows.length);

  for (const workflow of wallet.user.workflows) {
    console.log(`\n[3] Triggering Workflow ID: ${workflow.id} ("${workflow.name}")`);

    // Create Execution record
    const execution = await prisma.execution.create({
      data: {
        workflowId: workflow.id,
        triggerTxHash: sampleTxHash,
        triggerAmount: transferAmountStr,
        status: 'RUNNING',
        stepLogs: [],
        startedAt: new Date(),
      },
    });

    console.log('   ✅ Created Execution ID in Neon Postgres:', execution.id);

    const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
    const edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : (workflow.edges || []);
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');

    const stepLogs: any[] = [
      {
        stepId: triggerNode?.id || 'trigger-1',
        nodeType: 'trigger',
        nodeName: triggerNode?.data?.label || 'USDC Received',
        status: 'COMPLETE',
        txHash: sampleTxHash,
        details: `Triggered by inbound transfer of ${transferAmountStr} USDC`,
        timestamp: new Date().toISOString(),
      },
    ];

    const outgoingEdges = edges.filter((e: any) => e.source === triggerNode?.id);
    const targetNodeIds = outgoingEdges.map((e: any) => e.target);
    const actionNodes = nodes.filter((n: any) => targetNodeIds.includes(n.id));

    const totalAmount = parseFloat(transferAmountStr);

    for (const node of actionNodes) {
      const percentage = parseFloat(node.data?.percentage || '0');
      const actionAmount = ((totalAmount * percentage) / 100).toFixed(6);

      console.log(`\n   ⚡ Executing Node "${node.data?.label}" (Type: ${node.type}, Percentage: ${percentage}% = ${actionAmount} USDC)...`);

      try {
        if (node.type === 'swap') {
          const tokenOut = node.data?.tokenOut || 'EURC';
          const res: any = await executeAppKitSwap({
            userWalletAddress: wallet.address,
            walletId: wallet.circleWalletId,
            amountUsdc: actionAmount,
            tokenOut,
          });

          console.log('      ✅ Swap Result TxHash:', res?.txHash || res?.id);

          stepLogs.push({
            stepId: node.id,
            nodeType: 'swap',
            nodeName: node.data?.label || 'Swap Action',
            status: 'COMPLETE',
            txHash: res?.txHash || res?.id || '0x-swap-complete',
            details: `Swapped ${actionAmount} USDC to ${tokenOut}`,
            timestamp: new Date().toISOString(),
          });
        } else if (node.type === 'bridge') {
          const destinationAddress = node.data?.destinationAddress;
          console.log('      Attempting CCTP Bridge to:', destinationAddress);

          if (!destinationAddress || destinationAddress.length < 32) {
            throw new Error(`Invalid Solana destination address: "${destinationAddress || ''}"`);
          }

          const res: any = await executeAppKitBridge({
            userWalletAddress: wallet.address,
            destinationAddress,
            amountUsdc: actionAmount,
          });

          console.log('      ✅ Bridge Result TxHash:', res?.txHash || res?.id);

          stepLogs.push({
            stepId: node.id,
            nodeType: 'bridge',
            nodeName: node.data?.label || 'Bridge Action',
            status: 'COMPLETE',
            txHash: res?.txHash || res?.id || '0x-bridge-complete',
            details: `Bridged ${actionAmount} USDC to Solana Devnet`,
            timestamp: new Date().toISOString(),
          });
        } else if (node.type === 'send') {
          const destinationAddress = node.data?.destinationAddress;
          console.log('      Attempting Send to EVM address:', destinationAddress);

          const res: any = await executeAppKitSend({
            userWalletAddress: wallet.address,
            destinationAddress,
            amountUsdc: actionAmount,
          });

          console.log('      ✅ Send Result TxHash:', res?.txHash || res?.id);

          stepLogs.push({
            stepId: node.id,
            nodeType: 'send',
            nodeName: node.data?.label || 'Send Action',
            status: 'COMPLETE',
            txHash: res?.txHash || res?.id || '0x-send-complete',
            details: `Sent ${actionAmount} USDC to ${destinationAddress}`,
            timestamp: new Date().toISOString(),
          });
        } else if (node.type === 'hold') {
          console.log('      ✅ Hold Action safe');
          stepLogs.push({
            stepId: node.id,
            nodeType: 'hold',
            nodeName: node.data?.label || 'Keep Remainder',
            status: 'COMPLETE',
            details: `Retained ${percentage}% (${actionAmount} USDC) safely in user wallet on Arc Testnet`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.warn(`      ⚠️ Node execution error caught gracefully:`, err.message);
        stepLogs.push({
          stepId: node.id,
          nodeType: node.type,
          nodeName: node.data?.label || node.type.toUpperCase(),
          status: 'FAILED',
          error: err.message || String(err),
          timestamp: new Date().toISOString(),
        });
      }

      await prisma.execution.update({
        where: { id: execution.id },
        data: { stepLogs: stepLogs as any },
      });
    }

    const hasFailed = stepLogs.some((s) => s.status === 'FAILED');
    await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: hasFailed ? 'FAILED' : 'COMPLETE',
        finishedAt: new Date(),
        stepLogs: stepLogs as any,
      },
    });

    console.log(`\n[4] Execution Finished! Final Status: ${hasFailed ? 'FAILED' : 'COMPLETE'}`);
  }

  await prisma.$disconnect();
}

simulateCircleWebhook();
