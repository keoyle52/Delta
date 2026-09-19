import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NetworkSchema } from '@/config/network';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const UpdateNetworkSchema = z.object({
  network: NetworkSchema,
});

export async function GET(req: NextRequest) {
  try {
    const rateLimitRes = await checkRateLimit(req, 'user-network-get', { limit: 60, windowMs: 60 * 1000 });
    if (rateLimitRes) return rateLimitRes;

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeNetwork: true },
    });

    return NextResponse.json({
      network: (user?.activeNetwork as 'mainnet' | 'testnet') || 'mainnet',
    });
  } catch (error: any) {
    console.error('Error fetching user active network:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user active network' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const rateLimitRes = await checkRateLimit(req, 'user-network-patch', { limit: 20, windowMs: 60 * 1000 });
    if (rateLimitRes) return rateLimitRes;

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json().catch(() => ({}));
    const parseResult = UpdateNetworkSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid network parameter. Must be "mainnet" or "testnet".', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { network } = parseResult.data;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { activeNetwork: network },
      select: { activeNetwork: true },
    });

    return NextResponse.json({
      success: true,
      network: updatedUser.activeNetwork,
    });
  } catch (error: any) {
    console.error('Error updating user active network:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user active network' },
      { status: 500 }
    );
  }
}
