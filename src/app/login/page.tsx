'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Zap, Mail, KeyRound, ArrowRight, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('demo@delta.build');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [sendingCode, setSendingCode] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setSendingCode(true);
    setError('');
    setInfoMessage('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStep('code');
        setInfoMessage(`Verification code sent to ${email}`);
      } else {
        setError(data.error || 'Failed to send verification code.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error while sending verification code.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.trim().length < 4) {
      setError('Please enter the verification code sent to your email.');
      return;
    }

    setLoggingIn(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        email: email.toLowerCase().trim(),
        code: code.trim(),
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
      {/* Dynamic background glow shapes */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-600/10 blur-3xl" />

      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-teal-500 p-0.5 shadow-lg shadow-indigo-500/20 mb-2">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
              <Zap className="h-7 w-7 text-indigo-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans">delta</h1>
          <p className="text-sm text-slate-400">
            Passwordless Email Verification & Arc Testnet Wallet Authentication
          </p>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-950/40 px-3 py-1 text-xs font-semibold text-purple-300">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
            Built on Arc Testnet
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-400 text-center">
            {error}
          </div>
        )}

        {infoMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300 text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                A 6-digit verification code will be sent to your email address. Existing users keep their wallet & workflows.
              </p>
            </div>

            <button
              type="submit"
              disabled={sendingCode}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              {sendingCode ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Sending Verification Code...
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Verification Code
                </label>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-xs font-semibold text-indigo-400 hover:underline"
                >
                  Change Email ({email})
                </button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-3 text-lg text-white font-mono tracking-widest focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Enter the 6-digit verification code sent to your inbox.
              </p>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all disabled:opacity-50"
            >
              {loggingIn ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Verifying & Logging In...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verify & Access Account</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
