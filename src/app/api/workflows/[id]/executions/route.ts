import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getOrCreateUserWallet } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';
import { getWalletBalances } from '@/lib/arc/rpc';
import { Network, NetworkSchema } from '@/config/network';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const rawNetwork = searchParams.get('network');

    const workflow = await prisma.workflow.findFirst({
      where: { id, userId },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (rawNetwork) {
      const parsed = NetworkSchema.safeParse(rawNetwork);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid network parameter' }, { status: 400 });
      }
      if (workflow.network !== parsed.data) {
        console.error(`[SECURITY EVENT] Network mismatch: requested network=${parsed.data}, workflow network=${workflow.network}`);
        return NextResponse.json(
          { error: 'Security Conflict: Workflow network does not match requested network.' },
          { status: 409 }
        );
      }
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
    const rateLimitRes = await checkRateLimit(req, 'workflow-manual-trigger', { limit: 10, windowMs: 60 * 1000 });
    if (rateLimitRes) return rateLimitRes;

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

    const network = (workflow.network as Network) || 'mainnet';

    // Optional request network check for strict 409 conflict
    if (body.network) {
      const parsed = NetworkSchema.safeParse(body.network);
      if (parsed.success && parsed.data !== network) {
        console.error(`[SECURITY EVENT] Execution trigger network mismatch: payload network=${parsed.data}, workflow network=${network}`);
        return NextResponse.json(
          { error: 'Security Conflict: Request network does not match workflow network.' },
          { status: 409 }
        );
      }
    }

    // Scoped wallet lookup by (userId, network)
    let wallet = await prisma.wallet.findUnique({
      where: {
        userId_network: {
          userId,
          network,
        },
      },
    });

    if (!wallet) {
      try {
        wallet = await getOrCreateUserWallet(userId, network);
      } catch (provisionErr: any) {
        return NextResponse.json(
          { error: `User wallet for ${network} could not be provisioned: ${provisionErr.message}` },
          { status: 400 }
        );
      }
    }

    const walletAddress = wallet.address;

    // Balance validation before test execution
    try {
      const realBalances = await getWalletBalances(walletAddress, network);
      const availableUsdc = parseFloat(realBalances.usdc || '0');
      const reqAmount = parseFloat(testAmount);

      if (availableUsdc <= 0) {
        const errorDetail = network === 'mainnet'
          ? 'Insufficient balance on Arc Mainnet. Custodial wallet has 0.00 USDC available. Please deposit USDC to your Arc Mainnet wallet.'
          : 'Insufficient balance on Arc Testnet. Custodial wallet has 0.00 USDC available. Please fund your wallet using Circle Faucet first.';
        return NextResponse.json({ error: errorDetail }, { status: 400 });
      }

      if (reqAmount > availableUsdc) {
        testAmount = availableUsdc.toFixed(2);
        console.warn(`Adjusted test amount from requested to available balance (${testAmount} USDC)`);
      }
    } catch (balanceErr: any) {
      console.warn(`Balance check warning on ${network}:`, balanceErr.message);
    }

    const testTxHash = `0x-manual-test-${Date.now().toString(16)}`;
    const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');

    // 1. Create initial Execution record in Neon PostgreSQL with network
    const execution = await prisma.execution.create({
      data: {
        workflowId: id,
        network,
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
            details: `Triggered manually with ${testAmount} USDC on ${network === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'}`,
            timestamp: new Date().toISOString(),
          },
        ],
        startedAt: new Date(),
      },
    });

    // 2. Dispatch workflow execution event to Inngest Durable Execution Engine with network
    const inngestRes = await inngest.send({
      name: 'workflow.trigger',
      data: {
        executionId: execution.id,
        workflowId: id,
        network,
        triggerTxHash: testTxHash,
        triggerAmount: testAmount,
        walletAddress,
        walletId: wallet.circleWalletId,
      },
    });

    console.log(`✅ Workflow execution ${execution.id} (${network}) dispatched to Inngest engine. Event IDs: ${JSON.stringify(inngestRes?.ids || [])}`);

    // 3. Return immediate success response (< 300ms) to UI
    return NextResponse.json({
      success: true,
      executionId: execution.id,
      network,
      message: `Test execution triggered with ${testAmount} USDC on ${network === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'}`,
      txHash: testTxHash,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
