import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateAllocationGraph } from '@/lib/validation/allocation';
import { NetworkSchema, Network } from '@/config/network';

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
        console.error(`[SECURITY EVENT] Network mismatch: request network=${parsed.data}, workflow network=${workflow.network}`);
        return NextResponse.json(
          { error: 'Security Conflict: Workflow network does not match requested network.' },
          { status: 409 }
        );
      }
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
    const body = await req.json().catch(() => ({}));

    const existing = await prisma.workflow.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (body.network) {
      const parsed = NetworkSchema.safeParse(body.network);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid network parameter' }, { status: 400 });
      }
      if (existing.network !== parsed.data) {
        console.error(`[SECURITY EVENT] Network mismatch on update: body network=${parsed.data}, workflow network=${existing.network}`);
        return NextResponse.json(
          { error: 'Security Conflict: Cannot mutate a workflow belonging to another network.' },
          { status: 409 }
        );
      }
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
    const { searchParams } = new URL(req.url);
    const rawNetwork = searchParams.get('network');

    const existing = await prisma.workflow.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (rawNetwork) {
      const parsed = NetworkSchema.safeParse(rawNetwork);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid network parameter' }, { status: 400 });
      }
      if (existing.network !== parsed.data) {
        console.error(`[SECURITY EVENT] Network mismatch on delete: query network=${parsed.data}, workflow network=${existing.network}`);
        return NextResponse.json(
          { error: 'Security Conflict: Cannot delete a workflow belonging to another network.' },
          { status: 409 }
        );
      }
    }

    await prisma.workflow.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
