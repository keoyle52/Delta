import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWalletBalances } from '@/lib/arc/rpc';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return NextResponse.json({
        address: null,
        usdc: '0.00',
        eurc: '0.00',
        nativeGasUsdc: '0.00',
        message: 'No Circle Wallet provisioned yet',
      });
    }

    // Call Arc Testnet RPC for live balances
    const balances = await getWalletBalances(wallet.address);

    return NextResponse.json({
      walletId: wallet.circleWalletId,
      address: wallet.address,
      blockchain: wallet.blockchain,
      ...balances,
    });
  } catch (error: any) {
    console.error('Wallet balance API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch balances' }, { status: 500 });
  }
}
