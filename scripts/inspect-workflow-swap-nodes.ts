import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function inspectWorkflowSwapNodes() {
  console.log('===========================================================');
  console.log('INSPECTING ALL WORKFLOW SWAP NODE CONFIGURATIONS IN DB');
  console.log('===========================================================');

  const workflows = await prisma.workflow.findMany({
    include: { user: true },
  });

  for (const wf of workflows) {
    console.log(`\n📌 Workflow ID: ${wf.id} | Name: "${wf.name}" | User: ${wf.user.email}`);
    const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : (wf.nodes || []);
    const swapNodes = nodes.filter((n: any) => n.type === 'swap');

    console.log(`   Swap Nodes Count: ${swapNodes.length}`);
    for (const sn of swapNodes) {
      console.log(`      └─ Node ID: ${sn.id} | Data:`, JSON.stringify(sn.data, null, 2));
    }
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

inspectWorkflowSwapNodes();
