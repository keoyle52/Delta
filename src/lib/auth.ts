import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { createArcUserWallet } from '@/lib/circle/wallets';

/**
 * Idempotently fetches existing user wallet or provisions a single new custodial wallet on Arc Testnet
 */
export async function getOrCreateUserWallet(userId: string) {
  // 1. Check if user already has a provisioned wallet
  const existingWallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (existingWallet) {
    return existingWallet;
  }

  // 2. Provision new Developer-Controlled Custodial Wallet on Arc Testnet
  const newWallet = await createArcUserWallet(userId);

  // 3. Handle potential duplicate address / walletId in DB
  const existingAddressWallet = await prisma.wallet.findFirst({
    where: {
      OR: [
        { address: newWallet.address },
        { circleWalletId: newWallet.circleWalletId },
      ],
    },
  });

  if (existingAddressWallet) {
    return await prisma.wallet.update({
      where: { id: existingAddressWallet.id },
      data: { userId },
    });
  }

  return await prisma.wallet.create({
    data: {
      userId,
      circleWalletId: newWallet.circleWalletId,
      circleWalletSetId: newWallet.circleWalletSetId,
      address: newWallet.address,
      blockchain: newWallet.blockchain,
    },
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email Verification Code',
      credentials: {
        email: { label: 'Email', type: 'email' },
        code: { label: 'Verification Code', type: 'text' },
      },
      async authorize(credentials) {
        const email = (credentials?.email || 'demo@delta.build').toLowerCase().trim();
        const inputCode = (credentials?.code || '123456').trim();

        // 1. Master code bypass for instant zero-friction demo mode
        const isMasterCode = inputCode === '123456' || inputCode === 'demo' || !credentials?.code;
        const storedCodeRecord = await prisma.verificationCode.findUnique({
          where: { email },
        });

        const isValidCode =
          isMasterCode ||
          Boolean(
            storedCodeRecord &&
              storedCodeRecord.code === inputCode &&
              storedCodeRecord.expiresAt > new Date()
          );

        if (!isValidCode) {
          throw new Error('Invalid or expired verification code. Access denied.');
        }

        // Clean up stored OTP code if used
        if (storedCodeRecord) {
          await prisma.verificationCode.delete({ where: { email } }).catch(() => {});
        }

        // 2. Find existing user OR auto-register new user
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: { email },
          });
        }

        // 3. Provision / link Circle custodial wallet on Arc Testnet idempotently
        let userWallet: any = null;
        try {
          userWallet = await getOrCreateUserWallet(user.id);
        } catch (walletErr: any) {
          console.warn('Wallet provisioning warning during login:', walletErr.message);
        }

        return {
          id: user.id,
          email: user.email,
          walletAddress: userWallet?.address || null,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.walletAddress = (user as any).walletAddress;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          walletAddress: token.walletAddress as string | null,
        } as any;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
