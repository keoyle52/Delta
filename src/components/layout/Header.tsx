'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LayoutDashboard, Workflow, LogOut, BarChart2, Presentation } from 'lucide-react';
import { useNetwork } from '@/context/NetworkContext';

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { network, setNetwork, isMainnet, config } = useNetwork();

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Brand Logo & Wordmark + Built on Arc Badge */}
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-3.5 group">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 border border-slate-700/80 p-1.5 shadow-xl shadow-indigo-500/10 group-hover:scale-105 transition-transform">
                <Image src="/icon.svg" alt="Delta Logo" width={32} height={32} className="h-8 w-8 object-contain" priority />
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-white font-sans">
                delta
              </span>
            </Link>

            {/* Built on Arc Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-300 shadow-inner">
              <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
              Built on Arc
            </div>

            {/* SIMULATION MODE BADGE */}
            {Boolean((session?.user as any)?.isSimulated) && (
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/50 px-3 py-1 text-xs font-extrabold text-amber-300 shadow-inner">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                SIMULATION MODE — Fake Balances
              </div>
            )}
          </div>

          {/* Navigation links */}
          {session?.user && (
            <nav className="flex items-center gap-1 md:gap-2">
              <Link
                href="/dashboard"
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  pathname === '/dashboard'
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>

              <Link
                href="/workflows"
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  pathname.startsWith('/workflows')
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Workflow className="h-4 w-4" />
                Workflows
              </Link>

              <Link
                href="/why-arc"
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  pathname === '/why-arc'
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <BarChart2 className="h-4 w-4" />
                Why Arc
              </Link>

              <Link
                href="/presentation"
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  pathname === '/presentation'
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Presentation className="h-4 w-4" />
                Presentation
              </Link>
            </nav>
          )}

          {/* Right Action Items: Network Segmented Control & Profile */}
          <div className="flex items-center gap-3">
            {/* Interactive Network Selector (Segmented Control) */}
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setNetwork('mainnet')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                  isMainnet
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isMainnet ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'bg-emerald-500/60'
                  }`}
                />
                <span>Arc Mainnet</span>
                <span className={`font-mono text-[10px] ${isMainnet ? 'text-emerald-100' : 'text-slate-500'}`}>#5042</span>
              </button>

              <button
                type="button"
                onClick={() => setNetwork('testnet')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                  !isMainnet
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    !isMainnet ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'bg-amber-500/60'
                  }`}
                />
                <span>Arc Testnet</span>
                <span className={`font-mono text-[10px] ${!isMainnet ? 'text-amber-100' : 'text-slate-500'}`}>#5042002</span>
              </button>
            </div>

            {session?.user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
                <span className="hidden md:inline-block text-xs font-mono text-slate-400 truncate max-w-[130px]">
                  {session.user.email}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Persistent, non-dismissable banner when on Testnet */}
      {!isMainnet && (
        <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-xs font-semibold text-amber-300 flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Testnet — separate wallet, no real funds</span>
        </div>
      )}
    </>
  );
}
