import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateAllocationGraph } from '@/lib/validation/allocation';

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

    return NextResponse.json({
      ...workflow,
      nodes: typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : workflow.nodes,
      edges: typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : workflow.edges,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitRes = await checkRateLimit(req, 'workflows-update', { limit: 20, windowMs: 60 * 1000 });
    if (rateLimitRes) return rateLimitRes;

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;
    const body = await req.json();

    const existing = await prisma.workflow.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const nodesInput = body.nodes ?? existing.nodes;
    const edgesInput = body.edges ?? existing.edges;

    // Graph-aware branch allocation validation (max 100% per branch)
    const validation = validateAllocationGraph(nodesInput, edgesInput);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        isActive: body.isActive ?? existing.isActive,
        nodes: nodesInput,
        edges: edgesInput,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;

    await prisma.workflow.deleteMany({
      where: { id, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
