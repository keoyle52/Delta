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
      name: 'Privy Email OTP & Demo Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        code: { label: 'Verification Code', type: 'text' },
        privyToken: { label: 'Privy Access Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.email.trim()) {
          throw new Error('Email address is required for authentication.');
        }
        let email = credentials.email.toLowerCase().trim();
        const inputCode = (credentials?.code || '').trim();
        const privyToken = credentials?.privyToken;

        // 1. Verify Privy token if provided via Privy client SDK
        const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
        const appSecret = process.env.PRIVY_APP_SECRET;

        let isVerifiedPrivyUser = false;
        if (privyToken && appId && appSecret) {
          try {
            const { PrivyClient } = await import('@privy-io/server-auth');
            const privy = new PrivyClient(appId, appSecret);
            const verifiedClaims = await privy.verifyAuthToken(privyToken);
            if (verifiedClaims?.userId) {
              const privyUser = await privy.getUser(verifiedClaims.userId);
              if (privyUser?.email?.address) {
                email = privyUser.email.address.toLowerCase().trim();
              }
              isVerifiedPrivyUser = true;
            }
          } catch (privyErr: any) {
            console.warn('Privy token verification warning:', privyErr.message);
          }
        }

        // Strictly restrict 1-Click Jury Demo access to demo accounts ONLY
        const isDemoAccount = email === 'demo@delta.build' || email === 'demo-test-user@delta.app';
        const isDemoBypass = isDemoAccount && (inputCode === '123456' || inputCode === 'demo');

        const isValidAccess = isVerifiedPrivyUser || isDemoBypass;

        if (!isValidAccess) {
          throw new Error('Invalid or unverified login session. Privy token verification required.');
        }

        // 2. Find existing user OR auto-register new user in Prisma
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
