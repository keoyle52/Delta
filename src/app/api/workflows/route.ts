import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

function validateWorkflowPercentages(nodesInput: any): { valid: boolean; total: number; error?: string } {
  try {
    const nodes = typeof nodesInput === 'string' ? JSON.parse(nodesInput) : (nodesInput || []);
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');

    if (!triggerNode) {
      return { valid: true, total: 0 };
    }

    const actionNodes = nodes.filter((n: any) => n.type !== 'trigger');
    let sumPercentage = 0;

    for (const node of actionNodes) {
      const p = parseFloat(node.data?.percentage || '0');
      if (isNaN(p) || p < 0) {
        return { valid: false, total: 0, error: `Invalid percentage value on node ${node.data?.label || node.id}` };
      }
      sumPercentage += p;
    }

    if (sumPercentage > 100) {
      return {
        valid: false,
        total: sumPercentage,
        error: `Total action allocation is ${sumPercentage}%, which exceeds the 100% maximum limit.`,
      };
    }

    return { valid: true, total: sumPercentage };
  } catch (err: any) {
    return { valid: false, total: 0, error: 'Malformed node JSON structure' };
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const workflows = await prisma.workflow.findMany({
      where: { userId },
      include: {
        _count: {
          select: { executions: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(workflows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await checkRateLimit(req, 'workflows-create', { limit: 20, windowMs: 60 * 1000 });
    if (rateLimitRes) return rateLimitRes;

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { name, nodes, edges, isActive } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Workflow name is required' }, { status: 400 });
    }

    // Strict percentage sum validation <= 100%
    const validation = validateWorkflowPercentages(nodes);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const workflow = await prisma.workflow.create({
      data: {
        userId,
        name,
        isActive: isActive ?? true,
        nodes: nodes || [],
        edges: edges || [],
      },
    });

    return NextResponse.json(workflow, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
