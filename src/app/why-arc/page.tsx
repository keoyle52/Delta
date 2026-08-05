'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  Coins,
  ExternalLink,
  RefreshCw,
  Zap,
  AlertCircle,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import {
  TYPICAL_WAIT_SECONDS,
  TYPICAL_FEE_USD,
} from '@/lib/arc-advantage-constants';

interface StatsResponse {
  byType: {
    bridge: {
      count: number;
      totalTimeSavedSeconds: number;
      totalFeeSavedUsd: number;
      avgActualDurationSeconds: number | null;
      avgActualFeeUsd: number | null;
    };
    swap: {
      count: number;
      totalTimeSavedSeconds: number;
      totalFeeSavedUsd: number;
      avgActualDurationSeconds: number | null;
      avgActualFeeUsd: number | null;
    };
    send: {
      count: number;
      totalTimeSavedSeconds: number;
      totalFeeSavedUsd: number;
      avgActualDurationSeconds: number | null;
      avgActualFeeUsd: number | null;
    };
  };
  totals: {
    totalRealTransactions: number;
    totalTimeSavedSeconds: number;
    totalFeeSavedUsd: number;
  };
  recentTransactions: Array<{
    txHash: string;
    nodeType: 'bridge' | 'swap' | 'send';
    actualDurationSeconds: number | null;
    actualFeeUsd: number | null;
    timeSavedSeconds: number | null;
    feeSavedUsd: number | null;
    workflowName: string;
    completedAt: string;
  }>;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const remSecs = Math.round(seconds % 60);
  if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export default function WhyArcPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stats/arc-advantage');
      if (!res.ok) throw new Error('Failed to load performance metrics');
      const stats = await res.json();
      setData(stats);
    } catch (err: any) {
      setError(err.message || 'Error fetching metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const totalRealTx = data?.totals?.totalRealTransactions || 0;
  const hasTimeData = (data?.totals?.totalTimeSavedSeconds || 0) > 0;
  const hasFeeData = (data?.totals?.totalFeeSavedUsd || 0) > 0;
  const isHistoricalMissingMetrics = totalRealTx > 0 && (!hasTimeData || !hasFeeData);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 pb-20">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-indigo-400" />
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
                Why Arc
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              How this project performs on Arc, based on completed transactions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
            <a
              href="https://docs.arc.network"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-950/40 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/50 transition-colors"
            >
              Docs & Benchmarks <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Historical Data Notice */}
        {isHistoricalMissingMetrics && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-3 text-xs text-indigo-300 flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>
              Some historical transactions predate detailed fee/duration tracking — newer transactions will show full metrics.
            </span>
          </div>
        )}

        {/* 1. Top Summary Banner (3 Stat Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Total Real Transactions */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between space-y-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Real Transactions
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-indigo-400">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
                {loading ? '...' : totalRealTx}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Completed non-simulated workflow execution steps
              </p>
            </div>
            <p className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
              Calculated from completed on-chain transactions. Compared against typical general-purpose L1 confirmation times and gas costs. Source: docs.arc.network.
            </p>
          </div>

          {/* Card 2: Total Time Saved */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 via-slate-900/80 to-slate-900/80 p-6 flex flex-col justify-between space-y-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                Total Time Saved
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-white font-sans tracking-tight">
                {loading ? '...' : hasTimeData ? formatDuration(data!.totals.totalTimeSavedSeconds) : 'N/A'}
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Saved compared to typical general-purpose L1 confirmation times
              </p>
            </div>
            <p className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
              Calculated from completed on-chain transactions. Compared against typical general-purpose L1 confirmation times and gas costs. Source: docs.arc.network.
            </p>
          </div>

          {/* Card 3: Total Fees Saved */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900/80 to-slate-900/80 p-6 flex flex-col justify-between space-y-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                Total Fees Saved
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-white font-sans tracking-tight">
                {loading ? '...' : hasFeeData ? `$${data!.totals.totalFeeSavedUsd.toFixed(2)}` : 'N/A'}
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Saved compared to typical general-purpose L1 gas costs
              </p>
            </div>
            <p className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
              Calculated from completed on-chain transactions. Compared against typical general-purpose L1 confirmation times and gas costs. Source: docs.arc.network.
            </p>
          </div>
        </div>

        {/* 2. Breakdown by Node Type (3 Cards) */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white tracking-tight font-sans">
            Performance Breakdown by Node Type
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Node Type 1: Bridge */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">CCTP Bridge</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {data?.byType?.bridge?.count || 0} completed
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Avg Duration:</span>
                  <span className="font-semibold text-white font-mono">
                    {data?.byType?.bridge?.avgActualDurationSeconds !== null && data?.byType?.bridge?.avgActualDurationSeconds !== undefined
                      ? `${data.byType.bridge.avgActualDurationSeconds}s`
                      : 'N/A'}{' '}
                    <span className="text-slate-500 font-normal">(typical: ~15min)</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Avg Fee:</span>
                  <span className="font-semibold text-white font-mono">
                    {data?.byType?.bridge?.avgActualFeeUsd !== null && data?.byType?.bridge?.avgActualFeeUsd !== undefined
                      ? `$${data.byType.bridge.avgActualFeeUsd.toFixed(4)}`
                      : 'Pending'}{' '}
                    <span className="text-slate-500 font-normal">(typical: ~$3.50)</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 font-bold text-emerald-400">
                  <span>Total Saved:</span>
                  <span className="font-mono">
                    {data?.byType?.bridge?.totalFeeSavedUsd ? `$${data.byType.bridge.totalFeeSavedUsd.toFixed(2)}` : 'N/A'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
                {data?.byType?.bridge?.count
                  ? (data.byType.bridge.avgActualDurationSeconds !== null || data.byType.bridge.avgActualFeeUsd !== null)
                    ? `${data.byType.bridge.count} bridges completed • avg ${data.byType.bridge.avgActualDurationSeconds ?? 'N/A'}s (typical: ~15min) • avg ${data.byType.bridge.avgActualFeeUsd ? `$${data.byType.bridge.avgActualFeeUsd.toFixed(4)}` : 'N/A'} fee (typical: ~$3.50) • $${data.byType.bridge.totalFeeSavedUsd.toFixed(2)} saved`
                    : `${data.byType.bridge.count} bridges completed on-chain — fee/duration metrics available once fee tracking data is present for these transactions.`
                  : '0 bridges completed • typical L1 window ~15min vs sub-second on Arc'}
              </p>
            </div>

            {/* Node Type 2: Swap */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Token Swap</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {data?.byType?.swap?.count || 0} completed
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Avg Duration:</span>
                  <span className="font-semibold text-white font-mono">
                    {data?.byType?.swap?.avgActualDurationSeconds !== null && data?.byType?.swap?.avgActualDurationSeconds !== undefined
                      ? `${data.byType.swap.avgActualDurationSeconds}s`
                      : 'N/A'}{' '}
                    <span className="text-slate-500 font-normal">(typical: ~15s)</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Avg Fee:</span>
                  <span className="font-semibold text-white font-mono">
                    {data?.byType?.swap?.avgActualFeeUsd !== null && data?.byType?.swap?.avgActualFeeUsd !== undefined
                      ? `$${data.byType.swap.avgActualFeeUsd.toFixed(4)}`
                      : 'Pending'}{' '}
                    <span className="text-slate-500 font-normal">(typical: ~$2.00)</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 font-bold text-emerald-400">
                  <span>Total Saved:</span>
                  <span className="font-mono">
                    {data?.byType?.swap?.totalFeeSavedUsd ? `$${data.byType.swap.totalFeeSavedUsd.toFixed(2)}` : 'N/A'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
                {data?.byType?.swap?.count
                  ? (data.byType.swap.avgActualDurationSeconds !== null || data.byType.swap.avgActualFeeUsd !== null)
                    ? `${data.byType.swap.count} swaps completed • avg ${data.byType.swap.avgActualDurationSeconds ?? 'N/A'}s (typical: ~15s) • avg ${data.byType.swap.avgActualFeeUsd ? `$${data.byType.swap.avgActualFeeUsd.toFixed(4)}` : 'N/A'} fee (typical: ~$2.00) • $${data.byType.swap.totalFeeSavedUsd.toFixed(2)} saved`
                    : `${data.byType.swap.count} swaps completed on-chain — fee/duration metrics available once fee tracking data is present for these transactions.`
                  : '0 swaps completed • typical L1 wait ~15s vs sub-second on Arc'}
              </p>
            </div>

            {/* Node Type 3: Send */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Direct Send</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {data?.byType?.send?.count || 0} completed
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Avg Duration:</span>
                  <span className="font-semibold text-white font-mono">
                    {data?.byType?.send?.avgActualDurationSeconds !== null && data?.byType?.send?.avgActualDurationSeconds !== undefined
                      ? `${data.byType.send.avgActualDurationSeconds}s`
                      : 'N/A'}{' '}
                    <span className="text-slate-500 font-normal">(typical: ~60s)</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Avg Fee:</span>
                  <span className="font-semibold text-white font-mono">
                    {data?.byType?.send?.avgActualFeeUsd !== null && data?.byType?.send?.avgActualFeeUsd !== undefined
                      ? `$${data.byType.send.avgActualFeeUsd.toFixed(4)}`
                      : 'Pending'}{' '}
                    <span className="text-slate-500 font-normal">(typical: ~$1.00)</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 font-bold text-emerald-400">
                  <span>Total Saved:</span>
                  <span className="font-mono">
                    {data?.byType?.send?.totalFeeSavedUsd ? `$${data.byType.send.totalFeeSavedUsd.toFixed(2)}` : 'N/A'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
                {data?.byType?.send?.count
                  ? (data.byType.send.avgActualDurationSeconds !== null || data.byType.send.avgActualFeeUsd !== null)
                    ? `${data.byType.send.count} sends completed • avg ${data.byType.send.avgActualDurationSeconds ?? 'N/A'}s (typical: ~60s) • avg ${data.byType.send.avgActualFeeUsd ? `$${data.byType.send.avgActualFeeUsd.toFixed(4)}` : 'N/A'} fee (typical: ~$1.00) • $${data.byType.send.totalFeeSavedUsd.toFixed(2)} saved`
                    : `${data.byType.send.count} sends completed on-chain — fee/duration metrics available once fee tracking data is present for these transactions.`
                  : '0 sends completed • typical L1 wait ~60s vs sub-second on Arc'}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Transparency Table & No Data Fallback */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight font-sans">
              Recent On-Chain Transactions ({data?.recentTransactions?.length || 0})
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Live data verified via Arc Explorer
            </span>
          </div>

          {!data?.recentTransactions || data.recentTransactions.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
                <Zap className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  No live transactions yet — run a real workflow to see how this project performs on Arc
                </h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                  Arc targets sub-second finality with USDC-native gas fees across all workflow node actions.
                </p>
              </div>
              <div className="pt-2">
                <a
                  href="https://docs.arc.network"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Source: docs.arc.network <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Transaction Hash</th>
                    <th className="px-4 py-3.5">Node Type</th>
                    <th className="px-4 py-3.5">Workflow</th>
                    <th className="px-4 py-3.5">Duration</th>
                    <th className="px-4 py-3.5">Actual Fee</th>
                    <th className="px-4 py-3.5 text-right">Time Saved</th>
                    <th className="px-4 py-3.5 text-right">Fee Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                  {data.recentTransactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        <a
                          href={`https://testnet.arcscan.app/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5"
                        >
                          <span>{tx.txHash.slice(0, 10)}...{tx.txHash.slice(-6)}</span>
                          <ArrowUpRight className="h-3 w-3 shrink-0" />
                        </a>
                      </td>
                      <td className="px-4 py-3 capitalize">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            tx.nodeType === 'bridge'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : tx.nodeType === 'swap'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                          }`}
                        >
                          {tx.nodeType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-sans">{tx.workflowName}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {tx.actualDurationSeconds !== null ? `${tx.actualDurationSeconds}s` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {tx.actualFeeUsd !== null ? `$${tx.actualFeeUsd.toFixed(4)}` : 'Pending'}
                      </td>
                      <td className="px-4 py-3 text-right text-indigo-300 font-semibold">
                        {tx.timeSavedSeconds !== null ? formatDuration(tx.timeSavedSeconds) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                        {tx.feeSavedUsd !== null ? `$${tx.feeSavedUsd.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
