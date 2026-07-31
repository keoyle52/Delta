import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      walletAddress: string | null;
      isSimulated?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    walletAddress?: string | null;
    isSimulated?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    walletAddress?: string | null;
    isSimulated?: boolean;
  }
}
