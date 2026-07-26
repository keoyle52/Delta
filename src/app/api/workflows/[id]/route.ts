import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function validateWorkflowPercentages(nodesInput: any): { valid: boolean; total: number; error?: string } {
  try {
    const nodes = typeof nodesInput === 'string' ? JSON.parse(nodesInput) : (nodesInput || []);
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');
    if (!triggerNode) return { valid: true, total: 0 };

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
        error: `Total action percentage allocation is ${sumPercentage}%, which exceeds 100%.`,
      };
    }

    return { valid: true, total: sumPercentage };
  } catch (err) {
    return { valid: false, total: 0, error: 'Malformed node structure' };
  }
}

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

    // Validate percentage sum
    const validation = validateWorkflowPercentages(nodesInput);
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
