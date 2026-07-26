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
            data: { label: 'USDC Received', minAmount: '20' },
          },
          {
            id: 'node-swap-1',
            type: 'swap',
            position: { x: 340, y: 50 },
            data: { label: 'Swap EURC', percentage: '40', tokenOut: 'EURC' },
          },
          {
            id: 'node-bridge-1',
            type: 'bridge',
            position: { x: 340, y: 180 },
            data: {
              label: 'Bridge Solana',
              percentage: '30',
              destinationChain: 'Solana_Devnet',
              destinationAddress: '7xKXtg2CW87d97TXJvhW9T2S3L4K',
            },
          },
          {
            id: 'node-send-1',
            type: 'send',
            position: { x: 340, y: 310 },
            data: {
              label: 'Send USDC',
              percentage: '20',
              destinationAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
            },
          },
          {
            id: 'node-hold-1',
            type: 'hold',
            position: { x: 340, y: 440 },
            data: { label: 'Keep Remainder', percentage: '10' },
          },
        ]
  );

  const [edges, setEdges] = useState<Edge[]>(
    initialEdges.length > 0
      ? initialEdges
      : [
          { id: 'e1-2', source: 'node-trigger-1', target: 'node-swap-1', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
          { id: 'e1-3', source: 'node-trigger-1', target: 'node-bridge-1', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
          { id: 'e1-4', source: 'node-trigger-1', target: 'node-send-1', animated: true, style: { stroke: '#f59e0b', strokeWidth: 2 } },
          { id: 'e1-5', source: 'node-trigger-1', target: 'node-hold-1', animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
        ]
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Custom node types registration
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

  // Calculate allocation percentage sum across action nodes
  const totalPercentage = useMemo(() => {
    return nodes
      .filter((n) => n.type !== 'trigger')
      .reduce((sum, node) => {
        const val = parseFloat((node.data as any)?.percentage || '0');
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
  }, [nodes]);

  const isValidPercentage = totalPercentage <= 100;

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }, eds)),
    []
  );

  const handleNodeClick = (_: any, node: Node) => {
    setSelectedNodeId(node.id);
  };

  const handleAddNode = (type: string) => {
    const id = `node-${type}-${Date.now().toString(36)}`;
    const newNode: Node = {
      id,
      type,
      position: { x: 300 + Math.random() * 50, y: 150 + Math.random() * 50 },
      data: {
        label: `${type.toUpperCase()} Step`,
        percentage: type !== 'trigger' && type !== 'notify' ? '10' : undefined,
        minAmount: type === 'trigger' ? '20' : undefined,
        tokenOut: type === 'swap' ? 'EURC' : undefined,
        destinationChain: type === 'bridge' ? 'Solana_Devnet' : undefined,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);

    // Auto connect from trigger node if exists
    const triggerNode = nodes.find((n) => n.type === 'trigger');
    if (triggerNode && type !== 'trigger') {
      const newEdge: Edge = {
        id: `e-${triggerNode.id}-${id}`,
        source: triggerNode.id,
        target: id,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
      };
      setEdges((eds) => [...eds, newEdge]);
    }
  };

  const handleUpdateNode = (nodeId: string, updatedData: any) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: updatedData } : n))
    );
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  const handleSave = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isValidPercentage) {
      setErrorMsg(`Total percentage allocation is ${totalPercentage}%, which exceeds 100%. Adjust action node percentages before saving.`);
      return;
    }

    setIsSaving(true);
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save workflow');
      }

      setSuccessMsg('Workflow automation canvas saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestTrigger = async () => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: '50.00' }),
      });
      if (res.ok) {
        router.push(`/workflows/${workflowId}/executions`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-slate-950 text-slate-100">
      {/* Canvas Header Controls Bar */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href="/workflows"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1 text-sm font-semibold text-white focus:border-indigo-500 focus:outline-none"
          />

          <button
            onClick={() => setIsActive(!isActive)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            {isActive ? 'Active' : 'Paused'}
          </button>
        </div>

        {/* Validation indicator & Actions */}
        <div className="flex items-center gap-4">
          {/* Percentage Sum Allocation Indicator */}
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-1 text-xs font-mono font-semibold ${
              isValidPercentage
                ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
                : 'border-red-500/50 bg-red-950/40 text-red-300'
            }`}
          >
            {isValidPercentage ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-400" />
            )}
            <span>Allocation: {totalPercentage}% / 100%</span>
          </div>

          <Link
            href={`/workflows/${workflowId}/executions`}
            className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Execution Logs
          </Link>

          <button
            onClick={handleTestTrigger}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-colors"
          >
            <Play className="h-3.5 w-3.5" />
            Test Execution
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !isValidPercentage}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold text-white shadow-md transition-colors ${
              isValidPercentage
                ? 'bg-indigo-600 hover:bg-indigo-500'
                : 'bg-slate-700 cursor-not-allowed opacity-60'
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save Canvas'}
          </button>
        </div>
      </div>

      {/* Banner Error / Success Messages */}
      {errorMsg && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-6 py-2 text-xs font-semibold text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-6 py-2 text-xs font-semibold text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Canvas Body: Node Palette + React Flow + Config Panel */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette onAddNode={handleAddNode} />

        <div className="flex-1 relative bg-slate-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
            <Controls />
          </ReactFlow>
        </div>

        <ConfigPanel
          selectedNode={selectedNode}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
        />
      </div>
    </div>
  );
}
