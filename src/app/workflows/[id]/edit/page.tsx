'use client';

import { useState, useEffect, use } from 'react';
import WorkflowCanvas from '@/components/canvas/WorkflowCanvas';
import { RefreshCw } from 'lucide-react';

export default function EditWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const workflowId = resolvedParams.id;

  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadWorkflow() {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        const data = await res.json();
        if (res.ok) {
          setWorkflow(data);
        } else {
          setError(data.error || 'Failed to load workflow');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadWorkflow();
  }, [workflowId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-950">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-red-400 bg-slate-950">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 space-y-2 max-w-md">
          <h3 className="text-lg font-bold">Error Loading Workflow</h3>
          <p className="text-xs text-red-300">{error || 'Workflow not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <WorkflowCanvas
      workflowId={workflow.id}
      initialName={workflow.name}
      initialNodes={workflow.nodes || []}
      initialEdges={workflow.edges || []}
      isActive={workflow.isActive}
    />
  );
}
