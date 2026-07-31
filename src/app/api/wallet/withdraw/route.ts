import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendArcTransfer } from '@/lib/circle/wallets';
import { executeAppKitSend } from '@/lib/circle/app-kit';
import { isValidEvmAddress } from '@/lib/validation/address';
import { checkRateLimit } from '@/lib/rate-limit';

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
    const { destinationAddress, amount, token = 'USDC' } = body;

    if (!isValidEvmAddress(destinationAddress)) {
      return NextResponse.json(
        { error: 'Invalid destination address. Please provide a valid EVM address (0x...)' },
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

    const userWithWallet = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!userWithWallet || !userWithWallet.wallet) {
      return NextResponse.json({ error: 'User custodial wallet not provisioned yet' }, { status: 400 });
    }

    const wallet = userWithWallet.wallet;
    const amountStr = withdrawAmountNum.toFixed(6);
    const targetToken = (token === 'EURC' ? 'EURC' : 'USDC') as 'USDC' | 'EURC';

    let txHash = '';
    try {
      const res: any = await executeAppKitSend({
        userWalletAddress: wallet.address,
        destinationAddress,
        amountUsdc: amountStr,
        token: targetToken,
      });
      txHash = res?.txHash || res?.id || '';
    } catch (appKitErr: any) {
      console.warn(`App Kit ${targetToken} send fallback to Developer-Controlled Wallet API:`, appKitErr.message);
      const fallbackTxId = await sendArcTransfer({
        walletId: wallet.circleWalletId,
        destinationAddress,
        amountUsdc: amountStr,
        tokenId: targetToken === 'EURC' ? process.env.CIRCLE_EURC_TOKEN_ID : undefined,
      });
      txHash = fallbackTxId || '';
    }

    return NextResponse.json({
      success: true,
      message: `Successfully transferred ${amountStr} ${targetToken} to ${destinationAddress}`,
      txHash: txHash || '0x-withdraw-complete',
      explorerUrl: txHash ? `https://testnet.arcscan.app/tx/${txHash}` : null,
    });
  } catch (error: any) {
    console.error('Withdrawal error:', error);
    return NextResponse.json(
      { error: `Withdrawal failed: ${error.message || error}` },
      { status: 500 }
    );
  }
}
