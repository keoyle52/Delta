import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function fixWorkflowNodePercentages() {
  console.log('===========================================================');
  console.log('AUDITING AND UPDATING WORKFLOW NODE PERCENTAGES IN NEON DB');
  console.log('===========================================================');

  const workflows = await prisma.workflow.findMany();

  for (const wf of workflows) {
    const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : (wf.nodes || []);
    let modified = false;

    for (const node of nodes) {
      if (node.type !== 'trigger') {
        const currentPct = node.data?.percentage;
        if (!currentPct || currentPct === '0' || parseFloat(currentPct) <= 0) {
          node.data = {
            ...node.data,
            percentage: '40',
          };
          modified = true;
          console.log(`📌 Fixed Node ${node.id} (${node.type}) in Workflow "${wf.name}" -> percentage set to "40"`);
        }
      }
    }

    if (modified) {
      await prisma.workflow.update({
        where: { id: wf.id },
        data: {
          nodes: nodes as any,
        },
      });
      console.log(`✅ Workflow ${wf.id} updated in Neon Postgres!`);
    } else {
      console.log(`ℹ️ Workflow ${wf.id} ("${wf.name}") already has valid node percentages.`);
    }
  }

  await prisma.$disconnect();
}

fixWorkflowNodePercentages();
