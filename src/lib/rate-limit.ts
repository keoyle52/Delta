import { NextRequest, NextResponse } from 'next/server';

interface RateLimitOptions {
  limit: number;
  windowMs: number; // e.g. 60000 for 1 minute
}

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitStore>();

// Cleanup stale entries periodically to prevent memory leaks
if (typeof globalThis !== 'undefined') {
  const CLEANUP_INTERVAL = 5 * 60 * 1000;
  // Use unref where available in Node.js
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (now > record.resetTime) {
        memoryStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  if (timer.unref) timer.unref();
}

/**
 * Extracts a client identifier (IP address) from request headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Lightweight in-memory rate limiting middleware for Next.js API Routes.
 * Returns null if request is allowed, or a 429 NextResponse if rate limit is exceeded.
 */
export async function checkRateLimit(
  req: NextRequest,
  prefix: string,
  options: RateLimitOptions = { limit: 10, windowMs: 60 * 1000 }
): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const key = `${prefix}:${ip}`;
  const now = Date.now();

  const record = memoryStore.get(key);

  if (!record || now > record.resetTime) {
    memoryStore.set(key, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return null;
  }

  if (record.count >= options.limit) {
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
    return NextResponse.json(
      {
        error: 'Too many requests. Please slow down and try again later.',
        retryAfterSeconds: retryAfterSec,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(options.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(record.resetTime / 1000)),
        },
      }
    );
  }

  record.count += 1;
  return null;
}
