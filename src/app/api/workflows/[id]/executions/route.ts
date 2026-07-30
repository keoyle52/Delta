import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';
import { getWalletBalances } from '@/lib/arc/rpc';

export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;

    const workflow = await prisma.workflow.findFirst({
      where: { id, userId },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const executions = await prisma.execution.findMany({
      where: { workflowId: id },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    const parsedExecutions = executions.map((exec) => ({
      ...exec,
      stepLogs: typeof exec.stepLogs === 'string' ? JSON.parse(exec.stepLogs) : exec.stepLogs,
    }));

    return NextResponse.json(parsedExecutions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Trigger a test execution of the workflow manually via Inngest Engine
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;
    const body = await req.json().catch(() => ({}));
    let testAmount = body.amount || '1.00';

    const workflow = await prisma.workflow.findFirst({
      where: { id, userId },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const userWithWallet = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!userWithWallet || !userWithWallet.wallet) {
      return NextResponse.json({ error: 'User wallet not provisioned yet' }, { status: 400 });
    }

    const walletAddress = userWithWallet.wallet.address;

    // Balance validation before test execution
    try {
      const realBalances = await getWalletBalances(walletAddress);
      const availableUsdc = parseFloat(realBalances.usdc || '0');
      const reqAmount = parseFloat(testAmount);

      if (availableUsdc <= 0) {
        return NextResponse.json(
          { error: `Insufficient balance on Arc Testnet. Custodial wallet has 0.00 USDC available. Please fund your wallet using Circle Faucet first.` },
          { status: 400 }
        );
      }

      if (reqAmount > availableUsdc) {
        testAmount = availableUsdc.toFixed(2);
        console.warn(`Adjusted test amount from requested to available balance (${testAmount} USDC)`);
      }
    } catch (balanceErr: any) {
      console.warn('Balance check warning:', balanceErr.message);
    }

    const testTxHash = `0x-manual-test-${Date.now().toString(16)}`;
    const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');

    // 1. Create initial Execution record in Neon PostgreSQL
    const execution = await prisma.execution.create({
      data: {
        workflowId: id,
        triggerTxHash: testTxHash,
        triggerAmount: testAmount,
        status: 'RUNNING',
        stepLogs: [
          {
            stepId: triggerNode?.id || 'trigger-1',
            nodeType: 'trigger',
            nodeName: triggerNode?.data?.label || 'USDC Received',
            status: 'COMPLETE',
            txHash: testTxHash,
            details: `Triggered manually with ${testAmount} USDC`,
            timestamp: new Date().toISOString(),
          },
        ],
        startedAt: new Date(),
      },
    });

    // 2. Dispatch workflow execution event to Inngest Durable Execution Engine
    const inngestRes = await inngest.send({
      name: 'workflow.trigger',
      data: {
        executionId: execution.id,
        workflowId: id,
        triggerTxHash: testTxHash,
        triggerAmount: testAmount,
        walletAddress,
        walletId: userWithWallet.wallet.circleWalletId,
      },
    });

    console.log(`✅ Workflow execution ${execution.id} dispatched to Inngest engine. Event IDs: ${JSON.stringify(inngestRes?.ids || [])}`);

    // 3. Return immediate success response (< 300ms) to UI
    return NextResponse.json({
      success: true,
      executionId: execution.id,
      message: `Test execution triggered with ${testAmount} USDC`,
      txHash: testTxHash,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
