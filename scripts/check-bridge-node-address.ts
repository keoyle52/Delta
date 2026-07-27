import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function checkBridgeAddress() {
  console.log('===========================================================');
  console.log('CHECKING WORKFLOW BRIDGE NODE DESTINATION ADDRESS');
  console.log('===========================================================');

  const workflows = await prisma.workflow.findMany();

  for (const wf of workflows) {
    const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : (wf.nodes || []);
    const bridgeNodes = nodes.filter((n: any) => n.type === 'bridge');

    for (const node of bridgeNodes) {
      console.log(`📌 Workflow ID: ${wf.id} ("${wf.name}")`);
      console.log(`   Bridge Node ID: ${node.id}`);
      console.log(`   destinationChain: "${node.data?.destinationChain}"`);
      console.log(`   destinationAddress: "${node.data?.destinationAddress}"`);
      
      const isEvmFormat = node.data?.destinationAddress?.startsWith('0x');
      const isSolanaLength = node.data?.destinationAddress?.length >= 32 && node.data?.destinationAddress?.length <= 44;
      
      console.log(`   is EVM (0x...)? ${isEvmFormat}`);
      console.log(`   is valid Solana length? ${isSolanaLength}`);
      if (isEvmFormat) {
        console.log(`   🚨 ERROR: EVM address "0x..." configured for Solana Devnet bridge! This is invalid.`);
      }
    }
  }

  await prisma.$disconnect();
}

checkBridgeAddress();
