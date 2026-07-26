'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Workflow as WorkflowIcon, Trash2, Edit3, Activity, RefreshCw } from 'lucide-react';

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

  const handleCreateNew = async () => {
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Flow ${workflows.length + 1} - USDC Splitter`,
          nodes: [],
          edges: [],
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
          onClick={handleCreateNew}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
        >
          <Plus className="h-4 w-4" />
          Create New Canvas Flow
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center space-y-4">
          <WorkflowIcon className="h-12 w-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No flows created yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Design your visual node flow on Arc Testnet to automate inbound USDC deposits.
          </p>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Workflow Canvas
          </button>
        </div>
      ) : (
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
      )}
    </div>
  );
}
