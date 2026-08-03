'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Zap, ArrowRight, RefreshCw, ShieldCheck, Lock, PlayCircle } from 'lucide-react';

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

  const handleSimulatedLogin = async () => {
    setLoggingIn(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        mode: 'simulate',
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start simulation session.');
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
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-teal-500 p-0.5 shadow-lg shadow-indigo-500/20 mb-2">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950 p-2">
              <img src="/icon.svg" alt="Delta Logo" className="h-full w-full object-contain" />
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

          {/* Arc proof badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/60 px-4 py-1.5 text-[11px] font-semibold text-slate-300 backdrop-blur-sm mt-2">
            <span>⚡ Sub-second finality</span>
            <span className="text-slate-600">•</span>
            <span>💵 ~$0.01 target gas fee</span>
            <span className="text-slate-600">—</span>
            <span className="text-indigo-400 font-bold">powered by Arc</span>
          </div>
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
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 py-3.5 text-xs font-bold text-slate-100 shadow-md transition-all disabled:opacity-50"
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

          <div className="pt-4 border-t border-slate-800/80 text-center">
            <button
              type="button"
              onClick={handleSimulatedLogin}
              disabled={loggingIn}
              className="text-xs text-slate-400 hover:text-indigo-400 transition-colors font-medium underline underline-offset-4 inline-flex items-center gap-1.5"
            >
              <PlayCircle className="h-3.5 w-3.5 text-amber-400" />
              <span>Try without connecting wallet → Simulation Mode (with fake 20 USDC)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
