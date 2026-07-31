import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getOrCreateUserWallet } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWalletBalances } from '@/lib/arc/rpc';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const isSimulated = Boolean((session.user as any).isSimulated);

    let wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (isSimulated) {
      const simUsdc = wallet?.simulatedUsdcBalance || '0';
      const simEurc = wallet?.simulatedEurcBalance || '0';
      return NextResponse.json({
        walletId: wallet?.circleWalletId || 'sim-wallet',
        address: wallet?.address || '0x0000000000000000000000000000000000000000',
        blockchain: 'ARC-TESTNET (SIMULATED)',
        usdc: simUsdc,
        formattedUsdc: parseFloat(simUsdc).toFixed(2),
        eurc: simEurc,
        formattedEurc: parseFloat(simEurc).toFixed(2),
        nativeGasUsdc: simUsdc,
        isSimulated: true,
      });
    }

    // Auto-provision custodial wallet on demand if not present in DB
    if (!wallet) {
      try {
        wallet = await getOrCreateUserWallet(userId);
      } catch (provisionErr: any) {
        console.error('On-demand wallet provisioning error:', provisionErr.message || provisionErr);
        return NextResponse.json({
          address: null,
          usdc: '0.00',
          eurc: '0.00',
          nativeGasUsdc: '0.00',
          message: 'Wallet provisioning in progress or skipped',
        });
      }
    }

    // Call Arc Testnet RPC for live balances
    const balances = await getWalletBalances(wallet.address);

    return NextResponse.json({
      walletId: wallet.circleWalletId,
      address: wallet.address,
      blockchain: wallet.blockchain,
      ...balances,
      isSimulated: false,
    });
  } catch (error: any) {
    console.error('Wallet balance API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch balances' }, { status: 500 });
  }
}
