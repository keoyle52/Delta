'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Zap, Mail, ArrowRight, RefreshCw, CheckCircle2, ShieldCheck, Sparkles, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, ready, authenticated, user: privyUser, getAccessToken } = usePrivy();
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState('');

  // Automatically sync Privy login session with NextAuth & Circle wallet provisioning
  useEffect(() => {
    async function syncPrivySession() {
      if (ready && authenticated && privyUser) {
        try {
          setLoggingIn(true);
          const token = await getAccessToken();
          const email = privyUser.email?.address || `privy_${privyUser.id}@delta.build`;

          const res = await signIn('credentials', {
            email,
            privyToken: token || undefined,
            code: '123456',
            redirect: false,
          });

          if (res?.error) {
            setError(res.error);
          } else {
            router.push('/dashboard');
            router.refresh();
          }
        } catch (err: any) {
          console.error('Privy session sync error:', err);
          setError(err.message || 'Failed to authorize session');
        } finally {
          setLoggingIn(false);
        }
      }
    }

    syncPrivySession();
  }, [ready, authenticated, privyUser, getAccessToken, router]);

  const handleInstantDemoLogin = async () => {
    setLoggingIn(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        email: 'demo@delta.build',
        code: '123456',
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handlePrivyLogin = () => {
    setError('');
    login();
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
            Privy Passwordless Auth & Arc Custodial Wallet Provisioning
          </p>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-950/40 px-3 py-1 text-xs font-semibold text-purple-300">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
            Built on Arc Testnet
          </div>
        </div>

        {/* 1-CLICK INSTANT DEMO LOGIN BUTTON */}
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Demo Jury Quick Access
            </span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
              Instant
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Bypass email verification and sign in instantly as shared demo user (<code className="text-indigo-300 font-mono">demo@delta.build</code>).
          </p>
          <button
            type="button"
            onClick={handleInstantDemoLogin}
            disabled={loggingIn}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50"
          >
            {loggingIn ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Accessing Demo Studio...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                <span>Enter Demo Studio (1-Click Auto-Login)</span>
              </>
            )}
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-slate-800" />
          <span className="bg-slate-900 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            or privy passwordless auth
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-400 text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            type="button"
            onClick={handlePrivyLogin}
            disabled={!ready || loggingIn}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 py-3 text-xs font-bold text-slate-100 shadow-md transition-all disabled:opacity-50"
          >
            {!ready || loggingIn ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                <span>Initializing Privy Auth...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                <span>Sign In with Privy (Email OTP)</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1">
            <Lock className="h-3 w-3" />
            <span>Privy Auth handles OTP verification. Arc wallet provisioning via Circle DCW.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
