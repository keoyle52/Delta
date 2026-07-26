import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';
import { executeAppKitSwap, executeAppKitBridge, executeAppKitSend } from '@/lib/circle/app-kit';
import { getWalletBalances } from '@/lib/arc/rpc';
import { sendExecutionNotificationEmail } from '@/lib/email';

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
 * Trigger a test execution of the workflow manually
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;
    const userEmail = session.user.email || '';
    const body = await req.json().catch(() => ({}));
    let testAmount = body.amount || '20.00';

    const userWithWallet = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!userWithWallet || !userWithWallet.wallet) {
      return NextResponse.json({ error: 'User wallet not provisioned yet' }, { status: 400 });
    }

    const walletAddress = userWithWallet.wallet.address;

    // FIX C: Balance validation before test execution
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

    // 1. Send event to Inngest for logging/durability tracking (non-blocking)
    try {
      await inngest.send({
        name: 'workflow.trigger',
        data: {
          workflowId: id,
          triggerTxHash: testTxHash,
          triggerAmount: testAmount,
          walletAddress,
          walletId: userWithWallet.wallet.circleWalletId,
        },
      });
      console.log('✅ Event sent to Inngest (informational, not blocking)');
    } catch (inngestErr: any) {
      console.warn('Inngest send failed (informational, not blocking):', inngestErr.message);
    }

    // 2. ALWAYS execute workflow directly to guarantee instant execution & DB logs
    executeWorkflowDirectly({
      workflowId: id,
      triggerTxHash: testTxHash,
      triggerAmount: testAmount,
      walletAddress,
      walletId: userWithWallet.wallet.circleWalletId,
      userEmail,
    }).catch((err) => console.error('Direct manual workflow execution error:', err));

    return NextResponse.json({
      success: true,
      message: `Test execution triggered with ${testAmount} USDC`,
      txHash: testTxHash,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * BFS Traversal to find all action nodes transitively reachable from the trigger node
 */
function getReachableActionNodes(triggerNodeId: string, nodes: any[], edges: any[]) {
  const visited = new Set<string>();
  const queue = [triggerNodeId];
  const orderedActionNodes: any[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const outgoing = edges.filter((e: any) => e.source === currentId);
    for (const edge of outgoing) {
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        const node = nodes.find((n: any) => n.id === edge.target);
        if (node && node.type !== 'trigger') {
          orderedActionNodes.push(node);
          queue.push(node.id);
        }
      }
    }
  }
  return orderedActionNodes;
}

/**
 * Direct workflow execution runner
 */
async function executeWorkflowDirectly({
  workflowId,
  triggerTxHash,
  triggerAmount,
  walletAddress,
  walletId,
  userEmail,
}: {
  workflowId: string;
  triggerTxHash: string;
  triggerAmount: string;
  walletAddress: string;
  walletId: string;
  userEmail?: string;
}) {
  const execution = await prisma.execution.create({
    data: {
      workflowId,
      triggerTxHash,
      triggerAmount,
      status: 'RUNNING',
      stepLogs: [],
      startedAt: new Date(),
    },
  });

  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) return;

  const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
  const edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : (workflow.edges || []);
  const triggerNode = nodes.find((n: any) => n.type === 'trigger');
  if (!triggerNode) return;

  const stepLogs: any[] = [
    {
      stepId: triggerNode.id,
      nodeType: 'trigger',
      nodeName: triggerNode.data?.label || 'USDC Received',
      status: 'COMPLETE',
      txHash: triggerTxHash,
      details: `Triggered manually with ${triggerAmount} USDC`,
      timestamp: new Date().toISOString(),
    },
  ];

  const updateExecutionLogs = async () => {
    await prisma.execution.update({
      where: { id: execution.id },
      data: { stepLogs: stepLogs as any },
    });
  };

  await updateExecutionLogs();

  // Transitive graph traversal (BFS) to execute all chained downstream nodes
  const actionNodes = getReachableActionNodes(triggerNode.id, nodes, edges);
  const totalAmount = parseFloat(triggerAmount);
  let hasNotifyNode = false;

  for (const node of actionNodes) {
    const percentage = parseFloat(node.data?.percentage || '0');
    const actionAmount = ((totalAmount * percentage) / 100).toFixed(6);

    try {
      if (node.type === 'swap') {
        const tokenOut = node.data?.tokenOut || 'EURC';
        const res: any = await executeAppKitSwap({
          userWalletAddress: walletAddress,
          walletId,
          amountUsdc: actionAmount,
          tokenOut,
        });

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
        if (!destinationAddress || destinationAddress.length < 32) {
          throw new Error(`Invalid Solana destination address: "${destinationAddress || ''}"`);
        }

        const res: any = await executeAppKitBridge({
          userWalletAddress: walletAddress,
          destinationAddress,
          amountUsdc: actionAmount,
        });

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
        if (!destinationAddress || !destinationAddress.startsWith('0x')) {
          throw new Error(`Invalid EVM destination address: "${destinationAddress || ''}"`);
        }

        const res: any = await executeAppKitSend({
          userWalletAddress: walletAddress,
          destinationAddress,
          amountUsdc: actionAmount,
        });

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
        stepLogs.push({
          stepId: node.id,
          nodeType: 'hold',
          nodeName: node.data?.label || 'Keep Remainder',
          status: 'COMPLETE',
          details: `Retained ${percentage}% (${actionAmount} USDC) safely in user wallet on Arc Testnet`,
          timestamp: new Date().toISOString(),
        });
      } else if (node.type === 'notify') {
        hasNotifyNode = true;
        stepLogs.push({
          stepId: node.id,
          nodeType: 'notify',
          nodeName: node.data?.label || 'Log Notification',
          status: 'COMPLETE',
          details: `Email notification triggered for ${node.data?.template || workflow.name}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      stepLogs.push({
        stepId: node.id,
        nodeType: node.type,
        nodeName: node.data?.label || node.type.toUpperCase(),
        status: 'FAILED',
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      });
    }

    await updateExecutionLogs();
  }

  const hasFailed = stepLogs.some((s) => s.status === 'FAILED');
  const finalStatus = hasFailed ? 'FAILED' : 'COMPLETE';

  await prisma.execution.update({
    where: { id: execution.id },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
      stepLogs: stepLogs as any,
    },
  });

  // ONLY send Resend Execution Alert Email if the workflow explicitly contains a 'notify' node
  if (hasNotifyNode && userEmail) {
    try {
      await sendExecutionNotificationEmail({
        to: userEmail,
        workflowName: workflow.name,
        status: finalStatus,
        triggerAmount,
        stepLogs,
      });
    } catch (emailErr: any) {
      console.warn('Resend notification dispatch notice:', emailErr.message);
    }
  }
}
