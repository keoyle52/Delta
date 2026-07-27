import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').toLowerCase().trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    // 1. Generate 6-digit random numeric verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // 2. Upsert verification code in database
    await prisma.verificationCode.upsert({
      where: { email },
      update: {
        code,
        expiresAt,
      },
      create: {
        email,
        code,
        expiresAt,
      },
    });

    // 3. Send email via Resend
    await sendOtpEmail({ to: email, code });

    console.log(`🔑 Verification Code generated for ${email}: ${code}`);

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${email}`,
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: `Failed to send verification code: ${error.message || error}` }, { status: 500 });
  }
}
