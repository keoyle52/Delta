'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Activity,
  Play,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Terminal,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export default function ExecutionsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const workflowId = resolvedParams.id;

  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workflows/${workflowId}/executions`);
      if (res.ok) {
        const data = await res.json();
        setExecutions(data);
      }
    } catch (err) {
      console.error('Failed to fetch executions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
    const interval = setInterval(fetchExecutions, 5000);
    return () => clearInterval(interval);
  }, [workflowId]);

  const handleTestTrigger = async () => {
    try {
      setTriggering(true);
      await fetch(`/api/workflows/${workflowId}/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: '50.00' }),
      });
      await fetchExecutions();
    } catch (err) {
      console.error(err);
    } finally {
      setTriggering(false);
    }
  };

  const getExplorerLink = (nodeType: string, txHash?: string) => {
    if (!txHash || txHash.startsWith('0x-manual') || txHash.startsWith('0x-webhook')) return null;
    if (txHash.startsWith('0x')) {
      return `https://testnet.arcscan.app/tx/${txHash}`;
    }
    return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
  };

  return (
    <div className="mx-auto max-w-7xl w-full p-6 sm:p-8 space-y-8">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/workflows/${workflowId}/edit`}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
              <Activity className="h-3.5 w-3.5" />
              Real-time Execution History
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white font-sans">
              Workflow Executions & Audit Logs
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchExecutions}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Poll Logs
          </button>
          <button
            onClick={handleTestTrigger}
            disabled={triggering}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50"
          >
            {triggering ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-white" />
            )}
            <span>Trigger Test Flow</span>
          </button>
        </div>
      </div>

      {loading && executions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-xs text-slate-400 font-mono">Loading execution audit trail...</p>
        </div>
      ) : executions.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-4">
          <Terminal className="h-12 w-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No execution logs found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Trigger a test execution or send inbound USDC to your Arc custodial wallet address to run this workflow.
          </p>
          <button
            onClick={handleTestTrigger}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            <Play className="h-4 w-4" />
            Trigger First Execution
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {executions.map((exec) => {
            const isComplete = exec.status === 'COMPLETE';
            const isFailed = exec.status === 'FAILED';
            const isPartial = exec.status === 'PARTIAL';
            const isRunning = exec.status === 'RUNNING';

            return (
              <div
                key={exec.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-6 backdrop-blur-xl shadow-xl"
              >
                {/* Header line of execution run */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                        isComplete
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isPartial
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : isFailed
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      }`}
                    >
                      {isComplete && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                      {isPartial && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                      {isFailed && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                      {isRunning && <Clock className="h-3.5 w-3.5 text-yellow-400 animate-spin" />}
                      {exec.status}
                    </span>

                    <span className="text-xs font-mono text-slate-400">
                      ID: <span className="text-slate-200 font-semibold">{exec.id.slice(0, 10)}</span>
                    </span>

                    <span className="text-xs font-mono text-slate-400">
                      Trigger Amount:{' '}
                      <span className="text-emerald-400 font-bold">{exec.triggerAmount} USDC</span>
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 font-mono">
                    Started: {new Date(exec.startedAt).toLocaleTimeString()}
                  </div>
                </div>

                {/* Timeline Step Logs */}
                <div className="space-y-4 relative pl-4 border-l-2 border-slate-800">
                  {(exec.stepLogs || []).map((step: any, idx: number) => {
                    const stepComplete = step.status === 'COMPLETE';
                    const stepPartial = step.status === 'PARTIAL';
                    const stepFailed = step.status === 'FAILED';
                    const stepSkipped = step.status === 'SKIPPED';
                    const explorerUrl = getExplorerLink(step.nodeType, step.txHash);

                    return (
                      <div key={idx} className="relative group space-y-1.5">
                        {/* Timeline Bullet */}
                        <div
                          className={`absolute -left-[23px] top-1 h-3.5 w-3.5 rounded-full border-2 border-slate-900 ${
                            stepComplete
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                              : stepPartial
                              ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                              : stepFailed
                              ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                              : stepSkipped
                              ? 'bg-slate-600'
                              : 'bg-yellow-400 animate-pulse'
                          }`}
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {step.nodeName || step.nodeType?.toUpperCase()}
                            </span>
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                              {step.nodeType}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                stepComplete
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : stepPartial
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : stepFailed
                                  ? 'bg-red-500/10 text-red-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>

                          {explorerUrl && (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              <span>View Explorer</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>

                        {step.details && (
                          <p className="text-xs text-slate-300 font-mono bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/60">
                            {step.details}
                          </p>
                        )}

                        {step.error && (
                          <p className="text-xs text-red-400 font-mono bg-red-950/30 rounded-lg p-2.5 border border-red-500/30">
                            Error: {step.error}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
