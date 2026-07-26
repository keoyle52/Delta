'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  BackgroundVariant,
  Node,
  Edge,
  OnConnect,
} from '@xyflow/react';

import TriggerNode from './nodes/TriggerNode';
import SwapNode from './nodes/SwapNode';
import BridgeNode from './nodes/BridgeNode';
import SendNode from './nodes/SendNode';
import NotifyNode from './nodes/NotifyNode';
import HoldNode from './nodes/HoldNode';

import NodePalette from './NodePalette';
import ConfigPanel from './ConfigPanel';
import { Save, AlertTriangle, CheckCircle2, Play, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface WorkflowCanvasProps {
  workflowId: string;
  initialName: string;
  initialNodes: Node[];
  initialEdges: Edge[];
  isActive: boolean;
}

export default function WorkflowCanvas({
  workflowId,
  initialName,
  initialNodes,
  initialEdges,
  isActive: initialIsActive,
}: WorkflowCanvasProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [nodes, setNodes] = useState<Node[]>(
    initialNodes.length > 0
      ? initialNodes
      : [
          {
            id: 'node-trigger-1',
            type: 'trigger',
            position: { x: 50, y: 180 },
            data: { label: 'USDC Received', minAmount: '1.00' },
          },
          {
            id: 'node-swap-1',
            type: 'swap',
            position: { x: 340, y: 50 },
            data: { label: 'Swap EURC', percentage: '50', tokenOut: 'EURC' },
          },
          {
            id: 'node-notify-1',
            type: 'notify',
            position: { x: 340, y: 220 },
            data: { label: 'Notify Alert', template: 'Delta Automation Executed: {{amount}} USDC' },
          },
        ]
  );

  const [edges, setEdges] = useState<Edge[]>(
    initialEdges.length > 0
      ? initialEdges
      : [
          { id: 'edge-1', source: 'node-trigger-1', target: 'node-swap-1' },
          { id: 'edge-2', source: 'node-trigger-1', target: 'node-notify-1' },
        ]
  );

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Register custom node components
  const nodeTypes = useMemo(
    () => ({
      trigger: TriggerNode,
      swap: SwapNode,
      bridge: BridgeNode,
      send: SendNode,
      notify: NotifyNode,
      hold: HoldNode,
    }),
    []
  );

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    []
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleAddNode = useCallback(
    (type: string) => {
      const newNodeId = `node-${type}-${Date.now().toString(16)}`;
      const position = {
        x: Math.floor(Math.random() * 200) + 200,
        y: Math.floor(Math.random() * 200) + 100,
      };

      let nodeData: any = { label: `${type.toUpperCase()} Node` };
      if (type === 'trigger') nodeData = { label: 'USDC Received', minAmount: '1.00' };
      if (type === 'swap') nodeData = { label: 'Swap Token', percentage: '50', tokenOut: 'EURC' };
      if (type === 'bridge') nodeData = { label: 'CCTP Bridge', percentage: '30', destinationChain: 'Solana_Devnet' };
      if (type === 'send') nodeData = { label: 'Send USDC', percentage: '20' };
      if (type === 'notify') nodeData = { label: 'Notify Alert', template: 'Delta Executed {{amount}} USDC' };
      if (type === 'hold') nodeData = { label: 'Keep Safe', percentage: '10' };

      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: nodeData,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    []
  );

  const handleUpdateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
    setSelectedNode((prev) => (prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...newData } } : prev));
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNode(null);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          isActive,
          nodes,
          edges,
        }),
      });

      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleManualTestTrigger = async () => {
    try {
      await fetch(`/api/workflows/${workflowId}/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: '20.00' }),
      });
      router.push(`/workflows/${workflowId}/executions`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full bg-slate-950">
      {/* Canvas Top Bar */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/workflows"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent font-bold text-white text-base focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1"
          />

          <button
            onClick={() => setIsActive(!isActive)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
              isActive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            {isActive ? 'Active' : 'Paused'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualTestTrigger}
            className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-600/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/20 transition-colors"
          >
            <Play className="h-3.5 w-3.5 fill-indigo-400 text-indigo-400" />
            Trigger Test Flow
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save Flow'}
          </button>

          {saveStatus === 'success' && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Saved!
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle className="h-4 w-4" /> Save failed
            </span>
          )}
        </div>
      </div>

      {/* Main Canvas Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        <NodePalette onAddNode={handleAddNode} />

        <div className="flex-1 h-full w-full bg-slate-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-slate-950"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
            <Controls className="bg-slate-900 border-slate-800 text-white shadow-xl" />
          </ReactFlow>
        </div>

        <ConfigPanel
          selectedNode={selectedNode}
          onUpdateNode={handleUpdateNodeData}
          onDeleteNode={handleDeleteNode}
        />
      </div>
    </div>
  );
}
