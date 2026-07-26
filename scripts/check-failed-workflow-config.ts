import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function checkWorkflowConfigs() {
  console.log('===========================================================');
  console.log('NEON POSTGRES WORKFLOW NODES & PERCENTAGE CONFIG AUDIT');
  console.log('===========================================================');

  const workflows = await prisma.workflow.findMany({
    include: {
      user: {
        include: { wallet: true },
      },
    },
  });

  console.log(`[1] Total Workflows in DB: ${workflows.length}`);

  for (const wf of workflows) {
    console.log(`\n📌 Workflow ID: ${wf.id}`);
    console.log(`   Name: "${wf.name}"`);
    console.log(`   User Email: ${wf.user.email}`);
    console.log(`   Wallet Address: ${wf.user.wallet?.address || 'NONE'}`);
    console.log(`   isActive: ${wf.isActive}`);

    const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : (wf.nodes || []);
    console.log(`   Nodes Count: ${nodes.length}`);
    console.log('   Full Nodes JSON:', JSON.stringify(nodes, null, 2));

    for (const node of nodes) {
      if (node.type === 'swap') {
        console.log(`   🔍 SWAP NODE CONFIG:`);
        console.log(`      ID: ${node.id}`);
        console.log(`      percentage: "${node.data?.percentage}"`);
        console.log(`      tokenOut: "${node.data?.tokenOut}"`);
      }
    }
  }

  await prisma.$disconnect();
}

checkWorkflowConfigs();
