'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Activity,
  ExternalLink,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Play,
  XCircle,
  CheckCircle2,
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
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8 relative overflow-hidden font-sans select-none">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-3 relative z-10 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
              <Zap className="h-4 w-4 text-indigo-400" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">delta</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Arc Testnet (#5042002) • Circle App Kit</span>
          </div>

          <span className="text-xs font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-3 py-1 rounded-full">
            Slide {currentSlide} / {totalSlides}
          </span>
        </div>
      </header>

      {/* Main Slide Screen - Exactly Fits 100vh Without Scrolling */}
      <main className="flex-1 flex items-center justify-center max-w-5xl mx-auto w-full relative z-10 my-auto">
        {/* SLIDE 1 */}
        {currentSlide === 1 && (
          <div className="w-full text-center space-y-6 animate-fadeIn">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-indigo-500/30 bg-indigo-950/40 text-[11px] font-bold text-indigo-300 uppercase tracking-widest mx-auto">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Hackathon Official Pitch Deck</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white font-sans">
                delta{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-teal-400 bg-clip-text text-transparent">
                  (FlowMX)
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-medium leading-relaxed">
                Autonomous Visual Workflow Automation Engine Built on Arc Testnet & Circle App Kit
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl mx-auto pt-4 text-left">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
                <div className="text-indigo-400 font-bold text-[11px] uppercase tracking-wider mb-1">
                  1. Capture Deposit
                </div>
                <p className="text-xs text-slate-400">
                  Captures incoming USDC deposits on Arc Testnet in real time via Circle Webhooks.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
                <div className="text-purple-400 font-bold text-[11px] uppercase tracking-wider mb-1">
                  2. Automate Pipeline
                </div>
                <p className="text-xs text-slate-400">
                  Executes instant token swaps (USDC → EURC) & cross-chain CCTP bridges to Solana.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
                <div className="text-teal-400 font-bold text-[11px] uppercase tracking-wider mb-1">
                  3. Verify Onchain
                </div>
                <p className="text-xs text-slate-400">
                  Live onchain audit trail linking directly to ArcScan & Solana Devnet Explorer.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 2 */}
        {currentSlide === 2 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <div className="text-center space-y-1">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">
                Problem & Solution
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white">Why Web3 Needs Delta</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl border border-red-500/20 bg-red-950/10 space-y-3">
                <h3 className="text-base font-bold text-red-400 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-400" />
                  <span>Web3 Friction Points</span>
                </h3>
                <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside leading-relaxed">
                  <li>
                    <strong className="text-white">Manual Complexity:</strong> Swapping tokens, bridging cross-chain, and splitting revenues requires manual, multi-step transactions across separate interfaces.
                  </li>
                  <li>
                    <strong className="text-white">No Event Triggers:</strong> Traditional Web3 wallets cannot react to incoming deposits automatically.
                  </li>
                  <li>
                    <strong className="text-white">Fragmented Workflows:</strong> Managing balance flows between testnets and destination chains lacks visual orchestration.
                  </li>
                </ul>
              </div>

              <div className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-950/10 space-y-3">
                <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>The Delta Solution</span>
                </h3>
                <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside leading-relaxed">
                  <li>
                    <strong className="text-white">Visual Canvas Engine:</strong> Drag-and-drop node pipelines (Trigger → Swap → Bridge → Send → Alert).
                  </li>
                  <li>
                    <strong className="text-white">Circle App Kit Integration:</strong> Automated CCTP bridging to Solana Devnet and instant DEX swaps.
                  </li>
                  <li>
                    <strong className="text-white">Production Safety & Telemetry:</strong> Strict token filtering, txHash deduplication, and live onchain telemetry.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 3 */}
        {currentSlide === 3 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <div className="text-center space-y-1">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">
                Technical Architecture
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white">End-to-End System Flow</h2>
            </div>

            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/80 space-y-3 text-center font-mono text-xs text-slate-300 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="p-2.5 rounded-lg bg-slate-950 border border-indigo-500/30 text-indigo-300 font-bold">
                  1. Inbound USDC Deposit
                </span>
                <span>➔</span>
                <span className="p-2.5 rounded-lg bg-slate-950 border border-purple-500/30 text-purple-300 font-bold">
                  2. Circle Webhook (ECDSA v2)
                </span>
                <span>➔</span>
                <span className="p-2.5 rounded-lg bg-slate-950 border border-teal-500/30 text-teal-300 font-bold">
                  3. BFS Graph Engine
                </span>
                <span>➔</span>
                <span className="p-2.5 rounded-lg bg-slate-950 border border-amber-500/30 text-amber-300 font-bold">
                  4. App Kit Swap / CCTP Bridge
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                <div className="text-slate-500 font-bold uppercase text-[10px] mb-0.5">Blockchain</div>
                <div className="text-white font-semibold">Arc Testnet (#5042002)</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                <div className="text-slate-500 font-bold uppercase text-[10px] mb-0.5">Wallets</div>
                <div className="text-white font-semibold">Circle Custodial (EOA)</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                <div className="text-slate-500 font-bold uppercase text-[10px] mb-0.5">Bridge</div>
                <div className="text-white font-semibold">CCTP Solana Devnet</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                <div className="text-slate-500 font-bold uppercase text-[10px] mb-0.5">Alerts</div>
                <div className="text-white font-semibold">Resend Email SDK</div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 4 */}
        {currentSlide === 4 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <div className="text-center space-y-1">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">
                Safety & Verification
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white">Production Safety & Auditability</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Deduplication</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every transaction hash (`txHash`) is tracked in database storage to prevent duplicate event executions.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                  <Activity className="h-4 w-4" />
                  <span>Loop Protection</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Strict token filtering ignores internal adapter transfers, backed by a workflow cooldown guard.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                <div className="flex items-center gap-2 text-teal-400 font-bold text-xs">
                  <ExternalLink className="h-4 w-4" />
                  <span>Onchain Audit Trail</span>
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
          <div className="w-full text-center space-y-6 animate-fadeIn">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">
                Future Vision
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white">What's Next for Delta</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto text-left">
              <div className="p-5 rounded-xl border border-indigo-500/20 bg-indigo-950/20 space-y-1">
                <div className="text-indigo-400 font-bold text-xs">Phase 1: Multi-Token Triggers</div>
                <p className="text-xs text-slate-400">Expand inbound triggers to EURC, cirBTC, and USDT tokens.</p>
              </div>
              <div className="p-5 rounded-xl border border-purple-500/20 bg-purple-950/20 space-y-1">
                <div className="text-purple-400 font-bold text-xs">Phase 2: AI Rebalancing</div>
                <p className="text-xs text-slate-400">
                  Integrate LLM subagents to dynamically calculate optimal swap/bridge proportions based on yield rates.
                </p>
              </div>
              <div className="p-5 rounded-xl border border-teal-500/20 bg-teal-950/20 space-y-1">
                <div className="text-teal-400 font-bold text-xs">Phase 3: Treasury Payroll</div>
                <p className="text-xs text-slate-400">
                  Automated Web3 organization payroll splitter with multi-sig approval workflows.
                </p>
              </div>
            </div>

            {/* Direct Launch App Call to Action on Final Slide */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-500 font-bold text-white text-xs hover:from-indigo-500 hover:to-teal-400 transition-all shadow-xl shadow-indigo-500/25 uppercase tracking-wider"
              >
                <Zap className="h-4 w-4" />
                <span>Launch Delta Studio (Interactive Demo)</span>
              </Link>
              <a
                href="https://github.com/keoyle52/Delta"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                <span>View GitHub Repository</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Control Bar - ALWAYS Visible in Viewport Without Scrolling */}
      <footer className="flex items-center justify-between border-t border-slate-800/80 pt-3 relative z-20 shrink-0">
        <button
          onClick={prevSlide}
          disabled={currentSlide === 1}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs font-bold text-slate-200 hover:bg-slate-800 hover:text-white disabled:opacity-30 transition-all shadow-md"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Previous</span>
        </button>

        {/* Center Bullet Dots Indicator */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx + 1)}
              className={`h-2.5 rounded-full transition-all ${
                currentSlide === idx + 1
                  ? 'w-7 bg-gradient-to-r from-indigo-500 to-purple-500'
                  : 'w-2.5 bg-slate-800 hover:bg-slate-700'
              }`}
              title={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        {currentSlide === totalSlides ? (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-500 transition-all"
          >
            <span>Launch App</span>
            <Play className="h-3.5 w-3.5 fill-white" />
          </Link>
        ) : (
          <button
            onClick={nextSlide}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
          >
            <span>Next Slide</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </footer>
    </div>
  );
}
