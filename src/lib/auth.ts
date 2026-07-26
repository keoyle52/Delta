import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
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
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required.');
        }

        const email = credentials.email.toLowerCase().trim();

        // 1. Find user in database
        let user = await prisma.user.findUnique({
          where: { email },
        });

        // 2. Auto-register user if not present (Demo Mode)
        if (!user) {
          const hashedPassword = await bcrypt.hash(credentials.password, 10);
          user = await prisma.user.create({
            data: {
              email,
              password: hashedPassword,
            },
          });
        } else {
          const isValidPassword = await bcrypt.compare(credentials.password, user.password || '');
          if (!isValidPassword) {
            throw new Error('Invalid credentials provided.');
          }
        }

        // 3. Provision / link Circle custodial wallet on Arc Testnet
        let userWallet: any = null;
        try {
          userWallet = await getOrCreateUserWallet(user.id);
        } catch (walletErr: any) {
          console.warn('Wallet provisioning warning:', walletErr.message);
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
