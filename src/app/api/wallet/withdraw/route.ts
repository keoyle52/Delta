import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendArcTransfer } from '@/lib/circle/wallets';
import { executeAppKitSend } from '@/lib/circle/app-kit';
import { isValidEvmAddress } from '@/lib/validation/address';
import { checkRateLimit } from '@/lib/rate-limit';
import { NetworkSchema, getNetworkConfig } from '@/config/network';
import { z } from 'zod';

const WithdrawSchema = z.object({
  destinationAddress: z.string().min(1),
  amount: z.string().min(1),
  token: z.enum(['USDC', 'EURC']).default('USDC'),
  network: NetworkSchema.default('mainnet'),
});

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await checkRateLimit(req, 'wallet-withdraw', { limit: 5, windowMs: 60 * 1000 });
    if (rateLimitRes) return rateLimitRes;

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (Boolean((session.user as any).isSimulated)) {
      return NextResponse.json(
        { error: 'Withdrawals are disabled in Simulation Mode (these are simulated funds).' },
        { status: 403 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json().catch(() => ({}));

    // 1. Strict Schema Validation
    const parseResult = WithdrawSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid withdrawal parameters', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { destinationAddress, amount, token, network } = parseResult.data;

    // 2. Validate Address & Reject address(0) (reverts on Arc)
    if (!isValidEvmAddress(destinationAddress) || destinationAddress.toLowerCase() === ZERO_ADDRESS) {
      return NextResponse.json(
        { error: 'Invalid destination address. Please provide a valid, non-zero EVM address (0x...). Sends to address(0) revert on Arc.' },
        { status: 400 }
      );
    }

    const withdrawAmountNum = parseFloat(amount);
    if (isNaN(withdrawAmountNum) || withdrawAmountNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid withdrawal amount. Amount must be greater than 0.' },
        { status: 400 }
      );
    }

    // 3. Scoped Wallet Lookup by (userId, network)
    const wallet = await prisma.wallet.findUnique({
      where: {
        userId_network: {
          userId,
          network,
        },
      },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: `User custodial wallet for ${network} is not provisioned yet.` },
        { status: 400 }
      );
    }

    // Reject self-transfer
    if (destinationAddress.toLowerCase() === wallet.address.toLowerCase()) {
      return NextResponse.json(
        { error: 'Cannot withdraw to the same custodial wallet address (no-op self-transfer).' },
        { status: 400 }
      );
    }

    // Mismatch guard: verify wallet.network === requested network
    if (wallet.network !== network) {
      console.error(`[SECURITY EVENT] Network mismatch: request network=${network}, wallet network=${wallet.network}`);
      return NextResponse.json(
        { error: 'Security Conflict: Wallet network does not match request network.' },
        { status: 409 }
      );
    }

    const config = getNetworkConfig(network);
    const amountStr = withdrawAmountNum.toFixed(6);
    const targetToken = token as 'USDC' | 'EURC';

    let txHash = '';
    try {
      const res: any = await executeAppKitSend({
        userWalletAddress: wallet.address,
        destinationAddress,
        amountUsdc: amountStr,
        token: targetToken,
        network,
      });
      txHash = res?.txHash || res?.id || '';
    } catch (appKitErr: any) {
      console.warn(`App Kit ${targetToken} send fallback to Developer-Controlled Wallet API on ${network}:`, appKitErr.message);
      const fallbackTxId = await sendArcTransfer({
        walletId: wallet.circleWalletId,
        destinationAddress,
        amountUsdc: amountStr,
        tokenId: targetToken === 'EURC' ? (network === 'mainnet' ? undefined : process.env.CIRCLE_EURC_TOKEN_ID) : undefined,
        network,
      });
      txHash = fallbackTxId || '';
    }

    return NextResponse.json({
      success: true,
      message: `Successfully transferred ${amountStr} ${targetToken} to ${destinationAddress} on ${network}`,
      txHash: txHash || '0x-withdraw-complete',
      explorerUrl: txHash ? `${config.explorerBaseUrl}/tx/${txHash}` : null,
    });
  } catch (error: any) {
    console.error('Withdrawal error:', error);
    return NextResponse.json(
      { error: `Withdrawal failed: ${error.message || error}` },
      { status: 500 }
    );
  }
}
