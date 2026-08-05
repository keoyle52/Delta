'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LayoutDashboard, Workflow, LogOut, BarChart2 } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
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
          </nav>
        )}

        {/* Right Action Items: Network badge & Profile */}
        <div className="flex items-center gap-3">
          {/* Arc Testnet Network Status indicator */}
          <div className="hidden sm:flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span>Arc Testnet</span>
            <span className="text-slate-500 font-mono text-[10px]">#5042002</span>
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
  );
}
