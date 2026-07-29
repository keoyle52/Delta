import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Email OTP authentication is managed via Privy (@privy-io/react-auth).' },
    { status: 410 }
  );
}
