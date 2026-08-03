import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateAllocationGraph } from '@/lib/validation/allocation';



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

    // Graph-aware branch allocation validation (max 100% per branch)
    const validation = validateAllocationGraph(nodes, edges);
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
