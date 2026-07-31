import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

const handler = NextAuth(authOptions);

export async function GET(req: NextRequest, ctx: any) {
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: any) {
  const rateLimitRes = await checkRateLimit(req, 'auth', { limit: 15, windowMs: 60 * 1000 });
  if (rateLimitRes) return rateLimitRes;
  return handler(req, ctx);
}
