import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getOrCreateUserWallet } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWalletBalances } from '@/lib/arc/rpc';
import { NetworkSchema, Network, getNetworkConfig } from '@/config/network';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const rateLimitRes = await checkRateLimit(req, 'wallet-balance', { limit: 60, windowMs: 60 * 1000 });
    if (rateLimitRes) return rateLimitRes;

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const isSimulated = Boolean((session.user as any).isSimulated);

    // 1. Strict server-side network resolution & validation
    const { searchParams } = new URL(req.url);
    const rawNetworkParam = searchParams.get('network');

    let network: Network;
    if (rawNetworkParam) {
      const parsed = NetworkSchema.safeParse(rawNetworkParam);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid network parameter. Must be "mainnet" or "testnet".' },
          { status: 400 }
        );
      }
      network = parsed.data;
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { activeNetwork: true },
      });
      network = (user?.activeNetwork as Network) || 'mainnet';
    }

    const config = getNetworkConfig(network);

    // 2. Fetch scoped wallet for this (userId, network)
    let wallet = await prisma.wallet.findUnique({
      where: {
        userId_network: {
          userId,
          network,
        },
      },
    });

    if (isSimulated) {
      const simUsdc = wallet?.simulatedUsdcBalance || '100.00';
      const simEurc = wallet?.simulatedEurcBalance || '50.00';
      return NextResponse.json({
        walletId: wallet?.circleWalletId || `sim-${network}-wallet`,
        address: wallet?.address || '0x0000000000000000000000000000000000000000',
        blockchain: wallet?.blockchain || `${config.circleChainCode} (SIMULATED)`,
        network,
        usdc: simUsdc,
        formattedUsdc: parseFloat(simUsdc).toFixed(2),
        eurc: simEurc,
        formattedEurc: parseFloat(simEurc).toFixed(2),
        isSimulated: true,
        chainId: config.chainId,
      });
    }

    // 3. Lazy wallet provisioning for active network on first use
    if (!wallet) {
      try {
        wallet = await getOrCreateUserWallet(userId, network);
      } catch (provisionErr: any) {
        console.error(`On-demand wallet provisioning error (${network}):`, provisionErr.message || provisionErr);
        return NextResponse.json({
          address: null,
          usdc: '0.00',
          eurc: '0.00',
          network,
          message: `Wallet provisioning for ${network} in progress or deferred: ${provisionErr.message}`,
        });
      }
    }

    // 4. Query Arc RPC for live balances on the resolved network
    const balances = await getWalletBalances(wallet.address, network);

    return NextResponse.json({
      walletId: wallet.circleWalletId,
      address: wallet.address,
      blockchain: wallet.blockchain,
      network: wallet.network,
      usdc: balances.usdc,
      formattedUsdc: balances.formattedUsdc,
      eurc: balances.eurc,
      formattedEurc: balances.formattedEurc,
      chainId: balances.chainId,
      activeProviders: balances.activeProviders,
      isSimulated: false,
    });
  } catch (error: any) {
    console.error('Wallet balance API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch balances' }, { status: 500 });
  }
}
