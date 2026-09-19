'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Zap,
  TrendingUp,
  ArrowRight,
  Plus,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Coins,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
} from 'lucide-react';
import { useNetwork } from '@/context/NetworkContext';

interface WalletInfo {
  address: string;
  usdc: string;
  formattedUsdc: string;
  eurc: string;
  formattedEurc: string;
  blockchain: string;
  network?: string;
  chainId?: number;
  activeProviders?: string[];
  isSimulated?: boolean;
}

interface WorkflowItem {
  id: string;
  name: string;
  isActive: boolean;
  network?: string;
  updatedAt: string;
  _count?: {
    executions: number;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { network, isMainnet, config } = useNetwork();

  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [arcAdvantageStats, setArcAdvantageStats] = useState<any>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [copied, setCopied] = useState(false);
  const [simulatingDeposit, setSimulatingDeposit] = useState(false);

  // Withdrawal Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawToken, setWithdrawToken] = useState<'USDC' | 'EURC'>('USDC');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{
    success: boolean;
    message?: string;
    txHash?: string;
    explorerUrl?: string | null;
    error?: string;
  } | null>(null);

  const handleSimulateDeposit = async () => {
    try {
      setSimulatingDeposit(true);
      const res = await fetch('/api/wallet/simulate-deposit', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchWalletAndBalances();
      } else {
        alert(data.error || 'Failed to simulate deposit');
      }
    } catch (err: any) {
      alert(err.message || 'Deposit simulation failed');
    } finally {
      setSimulatingDeposit(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchWalletAndBalances = async () => {
    setLoadingBalances(true);
    try {
      const res = await fetch(`/api/wallet/balance?network=${network}`);
      const data = await res.json();
      if (res.ok) {
        setWalletInfo(data);
      }

      const wfRes = await fetch(`/api/workflows?network=${network}`);
      const wfData = await wfRes.json();
      if (wfRes.ok) {
        setWorkflows(wfData);
      }

      const arcRes = await fetch('/api/stats/arc-advantage');
      const arcData = await arcRes.json();
      if (arcRes.ok) {
        setArcAdvantageStats(arcData);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoadingBalances(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchWalletAndBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omitted to prevent re-render fetch loops; balance refresh is strictly keyed to session and network changes
  }, [session, network]);

  const copyAddress = () => {
    if (walletInfo?.address) {
      navigator.clipboard.writeText(walletInfo.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'USDC Auto-Splitter Flow',
          nodes: [],
          edges: [],
          network,
        }),
      });

      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/workflows/${data.id}/edit`);
      }
    } catch (err) {
      console.error('Failed to create workflow:', err);
    }
  };

  const handleExecuteWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawing(true);
    setWithdrawResult(null);

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationAddress: withdrawAddress.trim(),
          amount: withdrawAmount.trim(),
          token: withdrawToken,
          network,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setWithdrawResult({
          success: true,
          message: data.message,
          txHash: data.txHash,
          explorerUrl: data.explorerUrl,
        });
        fetchWalletAndBalances();
      } else {
        setWithdrawResult({
          success: false,
          error: data.error || 'Withdrawal failed',
        });
      }
    } catch (err: any) {
      setWithdrawResult({
        success: false,
        error: err.message || 'Withdrawal network error',
      });
    } finally {
      setWithdrawing(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-950">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const currentMax = withdrawToken === 'USDC' ? walletInfo?.usdc || '0' : walletInfo?.eurc || '0';

  return (
    <div className="mx-auto max-w-7xl w-full p-6 sm:p-8 space-y-8">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5" />
              Control Center
            </div>
            {/* Built on Arc Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-950/40 px-2.5 py-0.5 text-[10px] font-semibold text-purple-300">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
              Built on Arc
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans">
            Arc Automation Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Real-time Circle Developer-Controlled Custodial Wallet on {isMainnet ? 'Arc Mainnet (#5042)' : 'Arc Testnet (#5042002)'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {Boolean((session?.user as any)?.isSimulated) && (
            <button
              onClick={handleSimulateDeposit}
              disabled={simulatingDeposit}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
            >
              <Zap className={`h-4 w-4 fill-slate-950 ${simulatingDeposit ? 'animate-spin' : ''}`} />
              <span>Simulate 20 USDC Deposit</span>
            </button>
          )}

          <button
            onClick={() => {
              setWithdrawResult(null);
              setShowWithdrawModal(true);
            }}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-600/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/20 transition-colors shadow-md"
          >
            <ArrowUpRight className="h-4 w-4" />
            Withdraw Funds
          </button>

          <button
            onClick={fetchWalletAndBalances}
            disabled={loadingBalances}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loadingBalances ? 'animate-spin' : ''}`} />
            Refresh Balances
          </button>

          <button
            onClick={handleCreateWorkflow}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            New Canvas Workflow
          </button>
        </div>
      </div>

      {/* SIMULATION MODE NOTIFICATION BANNER */}
      {Boolean((session?.user as any)?.isSimulated) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-200">
          <div className="flex items-center gap-2.5 text-xs font-medium">
            <Zap className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>Simulation Mode Active:</strong> Operating with isolated test balances. No real custodial wallets or Arc platform funds are used.
            </span>
          </div>
          <button
            onClick={handleSimulateDeposit}
            disabled={simulatingDeposit}
            className="shrink-0 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            + Add Fake 20 USDC
          </button>
        </div>
      )}

      {/* Wallet Info & Arc Balances Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Wallet Address & Faucet / Deposit Card */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6 flex flex-col justify-between backdrop-blur-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <Wallet className="h-4 w-4" />
                Custodial Wallet Address
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                isMainnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {isMainnet ? 'ARC MAINNET' : 'ARC TESTNET'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2">
              <p className="text-xs text-slate-500 font-medium">
                {isMainnet ? 'Arc Mainnet Address' : 'Arc Testnet Address'}
              </p>
              <div className="flex items-center justify-between gap-2 font-mono text-xs text-slate-200 break-all">
                <span>{walletInfo?.address || 'Loading address...'}</span>
                <button
                  onClick={copyAddress}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors"
                  title="Copy address"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Action Links */}
          <div className="space-y-2.5 pt-4 border-t border-slate-800/80">
            <button
              onClick={() => {
                setWithdrawResult(null);
                setShowWithdrawModal(true);
              }}
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-emerald-500/30 bg-emerald-600/10 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/20 transition-colors"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Withdraw USDC / EURC to External Wallet</span>
            </button>

            {!isMainnet ? (
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-indigo-500/30 bg-indigo-600/10 py-2.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/20 transition-colors"
              >
                <span>Get Testnet USDC on Circle Faucet</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-center text-xs text-slate-400">
                Deposit USDC to this address to fund automated money movement on Arc Mainnet
              </div>
            )}
          </div>
        </div>

        {/* Real-time Balances Cards (Unified 6-decimal USDC + EURC, no native gas card) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* USDC Balance Card */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">USDC Balance</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Coins className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 space-y-1">
              <div className="text-3xl font-bold font-mono text-white">
                {loadingBalances ? '...' : walletInfo?.formattedUsdc || '0.00'}
              </div>
              <p className="text-xs text-slate-400">USDC (6 Decimals) — Gas & Settlement</p>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-300">
              <span>Sub-second deterministic finality</span>
              <button
                onClick={() => {
                  setWithdrawToken('USDC');
                  setWithdrawResult(null);
                  setShowWithdrawModal(true);
                }}
                className="font-bold underline hover:text-emerald-200"
              >
                Withdraw
              </button>
            </div>
          </div>

          {/* EURC Balance Card */}
          <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">EURC Balance</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                <Coins className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 space-y-1">
              <div className="text-3xl font-bold font-mono text-white">
                {loadingBalances ? '...' : walletInfo?.formattedEurc || '0.00'}
              </div>
              <p className="text-xs text-slate-400">Circle Euro Stablecoin (6 Decimals)</p>
            </div>

            <div className="mt-4 pt-3 border-t border-purple-500/20 flex items-center justify-between text-[11px] text-purple-300">
              <span>{isMainnet ? 'Arc Mainnet EURC' : 'Arc Testnet EURC'}</span>
              <button
                onClick={() => {
                  setWithdrawToken('EURC');
                  setWithdrawResult(null);
                  setShowWithdrawModal(true);
                }}
                className="font-bold underline hover:text-purple-200"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Arc Advantage Metrics Link Banner */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-sans">Why Arc Performance Metrics</h3>
            <p className="text-xs text-slate-400">
              How this project performs on Arc, based on completed transactions.
            </p>
          </div>
        </div>
        <Link
          href="/why-arc"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 transition-colors shrink-0"
        >
          <span>See Why Arc</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Workflows Overview Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-white font-sans">
            Active Workflows ({workflows.filter((w) => w.isActive).length})
          </h2>
          <Link
            href="/workflows"
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            <span>View All Workflows</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {workflows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-400 mb-4">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white">No Workflows Configured on {isMainnet ? 'Arc Mainnet' : 'Arc Testnet'}</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              Build your first visual node flow to automate money movement when USDC arrives on {isMainnet ? 'Arc Mainnet' : 'Arc Testnet'}.
            </p>
            <button
              onClick={handleCreateWorkflow}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              Create First Workflow
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        wf.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {wf.isActive ? 'Active Listener' : 'Paused'}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {new Date(wf.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                    {wf.name}
                  </h4>
                </div>

                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono text-[11px]">
                    {wf._count?.executions || 0} executions
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/workflows/${wf.id}/executions`}
                      className="text-slate-400 hover:text-white transition-colors"
                      title="View Run History"
                    >
                      History
                    </Link>
                    <Link
                      href={`/workflows/${wf.id}/edit`}
                      className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Edit Canvas →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WITHDRAWAL MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Withdraw Custodial Funds</h3>
                  <p className="text-xs text-slate-400">Transfer from Arc Custodial Wallet to external address</p>
                </div>
              </div>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteWithdrawal} className="space-y-4">
              {/* Token Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Select Asset
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawToken('USDC')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-colors ${
                      withdrawToken === 'USDC'
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Coins className="h-4 w-4" />
                    <span>USDC ({walletInfo?.formattedUsdc || '0.00'})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawToken('EURC')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-colors ${
                      withdrawToken === 'EURC'
                        ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Coins className="h-4 w-4" />
                    <span>EURC ({walletInfo?.formattedEurc || '0.00'})</span>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider">
                    Amount ({withdrawToken})
                  </label>
                  <span className="text-slate-500 font-mono">
                    Available: {currentMax} {withdrawToken}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.000001"
                    min="0.000001"
                    max={currentMax}
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(currentMax)}
                    className="absolute right-2.5 top-2.5 rounded-lg border border-indigo-500/30 bg-indigo-500/20 px-2.5 py-1 text-[10px] font-bold text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Destination Address Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Recipient EVM Address (0x...)
                </label>
                <input
                  type="text"
                  placeholder="0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500">
                  Target EVM address on Arc {isMainnet ? 'Mainnet (#5042)' : 'Testnet (#5042002)'}
                </p>
              </div>

              {/* Result Notice */}
              {withdrawResult && (
                <div className="pt-2">
                  {withdrawResult.success ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2 text-xs text-emerald-300">
                      <div className="flex items-center gap-2 font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        {withdrawResult.message}
                      </div>
                      {withdrawResult.explorerUrl && (
                        <a
                          href={withdrawResult.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono underline hover:text-white"
                        >
                          View Tx on {isMainnet ? 'Arc Explorer' : 'ArcScan'} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 flex items-center gap-2 text-xs text-red-300">
                      <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                      <span>{withdrawResult.error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 rounded-xl border border-slate-800 py-3 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={withdrawing}
                  className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  {withdrawing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Confirm Withdrawal</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
