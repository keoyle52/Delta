import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateAllocationGraph } from '@/lib/validation/allocation';
import { NetworkSchema, Network } from '@/config/network';
import { z } from 'zod';

const CreateWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  nodes: z.any(),
  edges: z.any(),
  isActive: z.boolean().optional(),
  network: NetworkSchema.default('mainnet'),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const rawNetwork = searchParams.get('network');

    let network: Network | undefined;
    if (rawNetwork) {
      const parsed = NetworkSchema.safeParse(rawNetwork);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid network parameter. Must be "mainnet" or "testnet".' },
          { status: 400 }
        );
      }
      network = parsed.data;
    }

    const workflows = await prisma.workflow.findMany({
      where: {
        userId,
        ...(network ? { network } : {}),
      },
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
    const body = await req.json().catch(() => ({}));

    const parseResult = CreateWorkflowSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, nodes, edges, isActive, network } = parseResult.data;

    // Graph-aware branch allocation validation (max 100% per branch)
    const validation = validateAllocationGraph(nodes, edges);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const workflow = await prisma.workflow.create({
      data: {
        userId,
        name,
        network,
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
