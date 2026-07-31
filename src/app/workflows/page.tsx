'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Workflow as WorkflowIcon, Trash2, Edit3, Activity, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workflows');
      const data = await res.json();
      if (res.ok) {
        setWorkflows(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleCreateFromTemplate = async (templateObj?: any) => {
    try {
      const name = templateObj ? templateObj.name : `Flow ${workflows.length + 1} - USDC Splitter`;
      const nodes = templateObj ? templateObj.nodes : [];
      const edges = templateObj ? templateObj.edges : [];

      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          nodes,
          edges,
        }),
      });

      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/workflows/${data.id}/edit`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await fetch(`/api/workflows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      fetchWorkflows();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      fetchWorkflows();
    } catch (err) {
      console.error(err);
    }
  };

  const templates = [
    {
      key: 'dca-eurc',
      name: 'Automated DCA into EURC',
      desc: 'Swaps 60% inbound USDC to EURC & retains 40% safe buffer.',
      badge: 'Popular Strategy',
      nodes: [
        { id: 't-1', type: 'trigger', position: { x: 50, y: 180 }, data: { label: 'USDC Received', minAmount: '1.00' } },
        { id: 's-1', type: 'swap', position: { x: 360, y: 80 }, data: { label: 'DCA to EURC', percentage: '60', tokenOut: 'EURC' } },
        { id: 'h-1', type: 'hold', position: { x: 360, y: 260 }, data: { label: 'Retain Buffer', percentage: '40' } },
      ],
      edges: [
        { id: 'e-1', source: 't-1', target: 's-1', type: 'custom' },
        { id: 'e-2', source: 't-1', target: 'h-1', type: 'custom' },
      ],
    },
    {
      key: 'bridge-notify',
      name: 'Cross-Chain CCTP & Webhook Alert',
      desc: 'Bridges 70% USDC to Solana Devnet & sends webhook alert.',
      badge: 'CCTP Cross-Chain',
      nodes: [
        { id: 't-1', type: 'trigger', position: { x: 50, y: 180 }, data: { label: 'USDC Received', minAmount: '1.00' } },
        { id: 'b-1', type: 'bridge', position: { x: 360, y: 80 }, data: { label: 'Solana CCTP Bridge', percentage: '70', destinationChain: 'Solana_Devnet' } },
        { id: 'n-1', type: 'notify', position: { x: 360, y: 260 }, data: { label: 'Discord Alert', template: 'CCTP Bridge Executed: {{amount}} USDC' } },
      ],
      edges: [
        { id: 'e-1', source: 't-1', target: 'b-1', type: 'custom' },
        { id: 'e-2', source: 't-1', target: 'n-1', type: 'custom' },
      ],
    },
    {
      key: 'multi-split',
      name: 'Multi-Split Treasury Strategy',
      desc: 'Splits USDC 40% Swap EURC, 30% CCTP Bridge, 30% Send USDC.',
      badge: 'Treasury Split',
      nodes: [
        { id: 't-1', type: 'trigger', position: { x: 50, y: 180 }, data: { label: 'USDC Received', minAmount: '1.00' } },
        { id: 's-1', type: 'swap', position: { x: 360, y: 40 }, data: { label: 'Swap EURC', percentage: '40', tokenOut: 'EURC' } },
        { id: 'b-1', type: 'bridge', position: { x: 360, y: 180 }, data: { label: 'Solana Bridge', percentage: '30', destinationChain: 'Solana_Devnet' } },
        { id: 'sd-1', type: 'send', position: { x: 360, y: 320 }, data: { label: 'Send Partner', percentage: '30' } },
      ],
      edges: [
        { id: 'e-1', source: 't-1', target: 's-1', type: 'custom' },
        { id: 'e-2', source: 't-1', target: 'b-1', type: 'custom' },
        { id: 'e-3', source: 't-1', target: 'sd-1', type: 'custom' },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl w-full p-6 sm:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
            <WorkflowIcon className="h-3.5 w-3.5" />
            Automation Manager
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans">
            Money Flow Workflows
          </h1>
          <p className="text-sm text-slate-400">
            Visual node-based payment automations on Arc Testnet
          </p>
        </div>

        <button
          onClick={() => handleCreateFromTemplate()}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
        >
          <Plus className="h-4 w-4" />
          Create Blank Flow Canvas
        </button>
      </div>

      {/* Preset Workflow Templates Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Sparkles className="h-4 w-4 text-amber-400" />
            1-Click Preset Templates
          </div>
          <span className="text-xs text-slate-500">Select a pre-built canvas template to start immediately</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.key}
              onClick={() => handleCreateFromTemplate(tpl)}
              className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3 hover:border-indigo-500/50 hover:bg-slate-900 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold">
                    {tpl.badge}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">{tpl.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{tpl.desc}</p>
              </div>
              <div className="text-xs font-semibold text-indigo-400 pt-2 border-t border-slate-800/80 flex items-center gap-1">
                <span>Use Template</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center space-y-4">
          <WorkflowIcon className="h-12 w-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No custom flows created yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Design your custom visual node flow on Arc Testnet or launch one of the preset templates above.
          </p>
          <button
            onClick={() => handleCreateFromTemplate()}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Blank Workflow Canvas
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Your Workflows ({workflows.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-5 flex flex-col justify-between hover:border-slate-700 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleToggleActive(wf.id, wf.isActive)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                        wf.isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${wf.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                      {wf.isActive ? 'Active' : 'Paused'}
                    </button>

                    <button
                      onClick={() => handleDelete(wf.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Delete workflow"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-white">{wf.name}</h3>

                  <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                    <div>
                      Executions: <span className="text-slate-200 font-bold">{wf._count?.executions || 0}</span>
                    </div>
                    <div>
                      Updated: <span className="text-slate-200">{new Date(wf.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                  <Link
                    href={`/workflows/${wf.id}/edit`}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 py-2.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 transition-colors"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Canvas
                  </Link>

                  <Link
                    href={`/workflows/${wf.id}/executions`}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Activity className="h-3.5 w-3.5 text-slate-400" />
                    View Logs
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
