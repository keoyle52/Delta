import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomUUID } from 'crypto';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest/client';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSimulated = Boolean((session.user as any).isSimulated);
    if (!isSimulated) {
      return NextResponse.json(
        { error: 'Deposit simulation is restricted to simulation mode sessions.' },
        { status: 403 }
      );
    }

    const userId = (session.user as any).id;
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Simulated wallet not found in database.' }, { status: 404 });
    }

    const currentBal = parseFloat(wallet.simulatedUsdcBalance || '0');
    const newBal = currentBal + 20.0;
    const newBalStr = newBal.toFixed(2);

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        simulatedUsdcBalance: newBalStr,
      },
    });

    // Check for active workflows to trigger simulated execution
    const userWorkflows = await prisma.workflow.findMany({
      where: { userId, isActive: true },
    });

    let triggeredCount = 0;
    const txHash = `0xsim-deposit-${randomUUID().slice(0, 12)}`;

    for (const workflow of userWorkflows) {
      const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
      const triggerNode = nodes.find((n: any) => n.type === 'trigger');

      const execution = await prisma.execution.create({
        data: {
          workflowId: workflow.id,
          triggerTxHash: txHash,
          triggerAmount: '20.00',
          status: 'RUNNING',
          stepLogs: [
            {
              stepId: triggerNode?.id || 'trigger-1',
              nodeType: 'trigger',
              nodeName: triggerNode?.data?.label || 'USDC Received',
              status: 'COMPLETE',
              txHash,
              details: 'Triggered by simulated deposit of 20.00 USDC',
              timestamp: new Date().toISOString(),
              simulated: true,
            },
          ],
          startedAt: new Date(),
        },
      });

      await inngest.send({
        name: 'workflow.trigger',
        data: {
          executionId: execution.id,
          workflowId: workflow.id,
          triggerTxHash: txHash,
          triggerAmount: '20.00',
          walletAddress: wallet.address,
          walletId: wallet.circleWalletId,
          isSimulated: true,
        },
      });

      triggeredCount++;
    }

    return NextResponse.json({
      success: true,
      message: 'Simulated 20 USDC deposit credited successfully.',
      newBalance: newBalStr,
      triggeredWorkflows: triggeredCount,
    });
  } catch (error: any) {
    console.error('Simulate deposit error:', error);
    return NextResponse.json(
      { error: `Deposit simulation failed: ${error.message || error}` },
      { status: 500 }
    );
  }
}
