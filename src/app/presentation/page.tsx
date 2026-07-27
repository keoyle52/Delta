'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Globe,
  Layers,
  Activity,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

export default function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(1);
  const totalSlides = 5;

  const nextSlide = () => setCurrentSlide((prev) => Math.min(totalSlides, prev + 1));
  const prevSlide = () => setCurrentSlide((prev) => Math.max(1, prev - 1));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12 relative overflow-hidden font-sans">
      {/* Dynamic Background Glow Effects */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-600/10 blur-3xl" />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-4 relative z-10">
        <Link href="/" className="flex items-center gap-3">
          {/* Logo SVG Render */}
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
                <Zap className="h-5 w-5 text-indigo-400" />
              </div>
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">delta</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Arc Testnet (#5042002) • Circle App Kit</span>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
          >
            <span>Launch App</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Slide Presentation Container */}
      <main className="flex-1 flex items-center justify-center max-w-5xl mx-auto w-full py-8 relative z-10">
        {/* SLIDE 1 */}
        {currentSlide === 1 && (
          <div className="w-full text-center space-y-8 animate-fadeIn">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/40 text-xs font-bold text-indigo-300 uppercase tracking-widest mx-auto">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>Hackathon Official Pitch Deck</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white font-sans">
                delta{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-teal-400 bg-clip-text text-transparent">
                  (FlowMX)
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto font-medium leading-relaxed">
                Autonomous Visual Workflow Automation Engine Built on Arc Testnet & Circle App Kit
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto pt-6 text-left">
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
                <div className="text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
                  1. Capture Deposit
                </div>
                <p className="text-xs text-slate-400">
                  Captures incoming USDC deposits on Arc Testnet in real time via Circle Webhooks.
                </p>
              </div>
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
                <div className="text-purple-400 font-bold text-xs uppercase tracking-wider mb-1">
                  2. Automate Pipeline
                </div>
                <p className="text-xs text-slate-400">
                  Executes instant token swaps (USDC → EURC) & cross-chain CCTP bridges to Solana.
                </p>
              </div>
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
                <div className="text-teal-400 font-bold text-xs uppercase tracking-wider mb-1">
                  3. Verify On-Chain
                </div>
                <p className="text-xs text-slate-400">
                  Live on-chain audit trail linking directly to ArcScan & Solana Devnet Explorer.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 2 */}
        {currentSlide === 2 && (
          <div className="w-full space-y-8 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                Problem & Solution
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Why Web3 Needs Delta</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 rounded-2xl border border-red-500/20 bg-red-950/10 space-y-4">
                <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                  <span>❌</span> Web3 Pain Points
                </h3>
                <ul className="space-y-3 text-xs text-slate-300 list-disc list-inside leading-relaxed">
                  <li>
                    <strong className="text-white">Manual Friction:</strong> Swapping tokens, bridging cross-chain, and splitting revenues requires 5+ manual transactions.
                  </li>
                  <li>
                    <strong className="text-white">No Event Triggers:</strong> Traditional Web3 wallets cannot react to incoming deposits automatically.
                  </li>
                  <li>
                    <strong className="text-white">Fragmented Liquidity:</strong> Managing balances between EVM testnets and Solana is slow and complex.
                  </li>
                </ul>
              </div>

              <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 space-y-4">
                <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                  <span>✅</span> The Delta Solution
                </h3>
                <ul className="space-y-3 text-xs text-slate-300 list-disc list-inside leading-relaxed">
                  <li>
                    <strong className="text-white">Visual Canvas Engine:</strong> Drag-and-drop node pipelines (Trigger → Swap → Bridge → Send → Alert).
                  </li>
                  <li>
                    <strong className="text-white">Circle App Kit Integration:</strong> Automated CCTP bridging to Solana Devnet and instant DEX swaps.
                  </li>
                  <li>
                    <strong className="text-white">Production Safety:</strong> Strict token filtering, txHash deduplication, and 120s cooldown guards.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 3 */}
        {currentSlide === 3 && (
          <div className="w-full space-y-8 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                Technical Architecture
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-white">End-to-End System Flow</h2>
            </div>

            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-4 text-center font-mono text-xs text-slate-300 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="p-3 rounded-xl bg-slate-950 border border-indigo-500/30 text-indigo-300 font-bold">
                  1. Inbound USDC Deposit
                </span>
                <span>➔</span>
                <span className="p-3 rounded-xl bg-slate-950 border border-purple-500/30 text-purple-300 font-bold">
                  2. Circle Webhook (ECDSA v2)
                </span>
                <span>➔</span>
                <span className="p-3 rounded-xl bg-slate-950 border border-teal-500/30 text-teal-300 font-bold">
                  3. BFS Graph Engine
                </span>
                <span>➔</span>
                <span className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 text-amber-300 font-bold">
                  4. App Kit Swap / CCTP Bridge
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-slate-500 font-bold uppercase mb-1">Blockchain</div>
                <div className="text-white font-semibold">Arc Testnet (#5042002)</div>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-slate-500 font-bold uppercase mb-1">Wallets</div>
                <div className="text-white font-semibold">Circle Custodial (EOA)</div>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-slate-500 font-bold uppercase mb-1">Bridge</div>
                <div className="text-white font-semibold">CCTP Solana Devnet</div>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="text-slate-500 font-bold uppercase mb-1">Alerts</div>
                <div className="text-white font-semibold">Resend Email SDK</div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 4 */}
        {currentSlide === 4 && (
          <div className="w-full space-y-8 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                Safety & Verification
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Production Safety & Auditability</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Deduplication</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every transaction hash (`txHash`) is tracked in Neon DB to prevent duplicate event executions.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                  <Activity className="h-4 w-4" />
                  <span>Loop Protection</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Strict token filtering ignores EURC & adapter transfers, backed by a 120s workflow cooldown guard.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
                <div className="flex items-center gap-2 text-teal-400 font-bold text-sm">
                  <ExternalLink className="h-4 w-4" />
                  <span>On-Chain Audit Trail</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Zero mock hashes. Every step links directly to live **ArcScan** & **Solana Explorer** receipts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 5 */}
        {currentSlide === 5 && (
          <div className="w-full text-center space-y-8 animate-fadeIn">
            <div className="space-y-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                Future Vision
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-white">What's Next for Delta</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
              <div className="p-6 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 space-y-1">
                <div className="text-indigo-400 font-bold text-xs">Phase 1: Multi-Token Triggers</div>
                <p className="text-xs text-slate-400">Expand inbound triggers to EURC, cirBTC, and USDT tokens.</p>
              </div>
              <div className="p-6 rounded-2xl border border-purple-500/20 bg-purple-950/20 space-y-1">
                <div className="text-purple-400 font-bold text-xs">Phase 2: AI Rebalancing</div>
                <p className="text-xs text-slate-400">
                  Integrate LLM subagents to dynamically calculate optimal swap/bridge proportions based on yield rates.
                </p>
              </div>
              <div className="p-6 rounded-2xl border border-teal-500/20 bg-teal-950/20 space-y-1">
                <div className="text-teal-400 font-bold text-xs">Phase 3: Treasury Payroll</div>
                <p className="text-xs text-slate-400">
                  Automated Web3 organization payroll splitter with multi-sig approval workflows.
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-center gap-4">
              <a
                href="https://github.com/keoyle52/Delta"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-bold text-white text-xs hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/25"
              >
                <span>View Code Repository on GitHub</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      <footer className="flex items-center justify-between border-t border-slate-800/80 pt-4 relative z-10">
        <button
          onClick={prevSlide}
          disabled={currentSlide === 1}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Previous</span>
        </button>

        <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx + 1)}
              className={`h-2 rounded-full transition-all ${
                currentSlide === idx + 1 ? 'w-6 bg-indigo-500' : 'w-2 bg-slate-800 hover:bg-slate-700'
              }`}
            />
          ))}
          <span className="ml-2">Slide {currentSlide} of {totalSlides}</span>
        </div>

        <button
          onClick={nextSlide}
          disabled={currentSlide === totalSlides}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-30 transition-colors"
        >
          <span>Next</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </footer>
    </div>
  );
}
