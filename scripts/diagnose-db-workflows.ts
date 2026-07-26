import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function diagnoseDatabaseWorkflows() {
  console.log('===========================================================');
  console.log('DELTA NEON DATABASE WORKFLOW & WALLET DIAGNOSTIC');
  console.log('===========================================================');

  try {
    // 1. Fetch Users
    const users = await prisma.user.findMany({
      include: { wallet: true, workflows: true },
    });

    console.log(`[1] Total Users in DB: ${users.length}`);
    for (const u of users) {
      console.log(`   👤 User ID: ${u.id} | Email: ${u.email}`);
      console.log(`      Wallet: ${u.wallet ? u.wallet.address + ' (ID: ' + u.wallet.circleWalletId + ')' : 'NONE'}`);
      console.log(`      Total Workflows: ${u.workflows.length}`);
      for (const wf of u.workflows) {
        console.log(`         📌 Workflow ID: ${wf.id} | Name: "${wf.name}" | Active: ${wf.isActive}`);
        console.log(`            Nodes Count: ${Array.isArray(wf.nodes) ? wf.nodes.length : 'non-array'}`);
      }
    }

    // 2. Fetch Executions
    const executions = await prisma.execution.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    console.log(`\n[2] Total Executions in DB: ${executions.length}`);
    for (const exec of executions) {
      console.log(`   ⚡ Execution ID: ${exec.id} | WorkflowID: ${exec.workflowId} | Status: ${exec.status}`);
      console.log(`      StartedAt: ${exec.startedAt} | TxHash: ${exec.triggerTxHash}`);
    }
  } catch (err: any) {
    console.error('❌ Database Query Error:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseDatabaseWorkflows();
