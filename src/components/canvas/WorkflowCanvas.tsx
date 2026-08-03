'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  BackgroundVariant,
  Node,
  Edge,
  OnConnect,
  ReactFlowProvider,
  useReactFlow,
  Connection,
} from '@xyflow/react';

import TriggerNode from './nodes/TriggerNode';
import ConditionNode from './nodes/ConditionNode';
import SwapNode from './nodes/SwapNode';
import BridgeNode from './nodes/BridgeNode';
import SendNode from './nodes/SendNode';
import NotifyNode from './nodes/NotifyNode';
import HoldNode from './nodes/HoldNode';
import CustomLabeledEdge from './edges/CustomLabeledEdge';

import NodePalette from './NodePalette';
import ConfigPanel from './ConfigPanel';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { validateAllocationGraph } from '@/lib/validation/allocation';
import {
  Save,
  AlertTriangle,
  CheckCircle2,
  Play,
  ArrowLeft,
  Undo2,
  Redo2,
  Sparkles,
  LayoutGrid,
  Activity,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface WorkflowCanvasProps {
  workflowId: string;
  initialName: string;
  initialNodes: Node[];
  initialEdges: Edge[];
  isActive: boolean;
}

function InnerWorkflowCanvas({
  workflowId,
  initialName,
  initialNodes,
  initialEdges,
  isActive: initialIsActive,
}: WorkflowCanvasProps) {
  const router = useRouter();
  const reactFlowInstance = useReactFlow();
  const { addToast } = useToast();

  const [name, setName] = useState(initialName);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [isDirty, setIsDirty] = useState(false);

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
            position: { x: 360, y: 60 },
            data: { label: 'Swap EURC', percentage: '50', tokenOut: 'EURC' },
          },
          {
            id: 'node-notify-1',
            type: 'notify',
            position: { x: 360, y: 240 },
            data: { label: 'Notify Alert', template: 'Delta Automation Executed: {{amount}} USDC' },
          },
        ]
  );

  const [edges, setEdges] = useState<Edge[]>(
    initialEdges.length > 0
      ? initialEdges
      : [
          { id: 'edge-1', source: 'node-trigger-1', target: 'node-swap-1', type: 'custom' },
          { id: 'edge-2', source: 'node-trigger-1', target: 'node-notify-1', type: 'custom' },
        ]
  );

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Live Canvas Execution Visualization State
  const [executionState, setExecutionState] = useState<{
    running: boolean;
    activeExecutionId?: string;
    stepStatuses: Record<string, 'RUNNING' | 'COMPLETE' | 'FAILED' | 'SKIPPED'>;
  }>({ running: false, stepStatuses: {} });

  // History Stack for Undo/Redo (30 steps max)
  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isHistoryActionRef = useRef<boolean>(false);

  const saveHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (isHistoryActionRef.current) {
      isHistoryActionRef.current = false;
      return;
    }
    const current = historyRef.current.slice(0, historyIndexRef.current + 1);
    current.push({
      nodes: JSON.parse(JSON.stringify(newNodes)),
      edges: JSON.parse(JSON.stringify(newEdges)),
    });
    if (current.length > 30) current.shift();
    historyRef.current = current;
    historyIndexRef.current = current.length - 1;
  }, []);

  // Save initial state to history once
  useEffect(() => {
    if (historyRef.current.length === 0) {
      saveHistory(nodes, edges);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const targetState = historyRef.current[historyIndexRef.current];
      isHistoryActionRef.current = true;
      setNodes(JSON.parse(JSON.stringify(targetState.nodes)));
      setEdges(JSON.parse(JSON.stringify(targetState.edges)));
      setIsDirty(true);
      addToast('Undo Action', 'info', 'Reverted canvas to previous state');
    }
  }, [addToast]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const targetState = historyRef.current[historyIndexRef.current];
      isHistoryActionRef.current = true;
      setNodes(JSON.parse(JSON.stringify(targetState.nodes)));
      setEdges(JSON.parse(JSON.stringify(targetState.edges)));
      setIsDirty(true);
      addToast('Redo Action', 'info', 'Re-applied canvas change');
    }
  }, [addToast]);

  // Keyboard listener for Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Unsaved changes browser beforeunload listener
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const [showBranchTooltip, setShowBranchTooltip] = useState(false);

  // Graph-aware allocation validation result (evaluates mutually exclusive condition branches independently)
  const allocationResult = useMemo(() => {
    return validateAllocationGraph(nodes, edges);
  }, [nodes, edges]);

  // Register custom node & edge components
  const nodeTypes = useMemo(
    () => ({
      trigger: TriggerNode,
      condition: ConditionNode,
      swap: SwapNode,
      bridge: BridgeNode,
      send: SendNode,
      notify: NotifyNode,
      hold: HoldNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      custom: CustomLabeledEdge,
    }),
    []
  );

  // Connection validation
  const isValidConnection = useCallback(
    (connection: any) => {
      const targetId = connection.target;
      const sourceId = connection.source;
      const targetNode = nodes.find((n) => n.id === targetId);

      if (targetNode?.type === 'trigger') {
        addToast('Invalid Connection', 'warning', 'Trigger nodes cannot accept incoming connections.');
        return false;
      }
      if (sourceId && targetId && sourceId === targetId) {
        addToast('Invalid Connection', 'warning', 'Cannot connect a node to itself.');
        return false;
      }
      return true;
    },
    [nodes, addToast]
  );

  const onNodesChange = useCallback(
    (changes: any) => {
      setNodes((nds) => {
        const nextNodes = applyNodeChanges(changes, nds);
        saveHistory(nextNodes, edges);
        return nextNodes;
      });
      setIsDirty(true);
    },
    [edges, saveHistory]
  );

  const onEdgesChange = useCallback(
    (changes: any) => {
      setEdges((eds) => {
        const nextEdges = applyEdgeChanges(changes, eds);
        saveHistory(nodes, nextEdges);
        return nextEdges;
      });
      setIsDirty(true);
    },
    [nodes, saveHistory]
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      const targetNode = nodes.find((n) => n.id === params.target);
      const targetPercentage = targetNode?.data?.percentage;

      const newEdge: Edge = {
        ...params,
        id: `edge-${params.source}-${params.target}-${Date.now().toString(16)}`,
        type: 'custom',
        animated: true,
        data: { percentage: targetPercentage },
      };

      setEdges((eds) => {
        const nextEdges = addEdge(newEdge, eds);
        saveHistory(nodes, nextEdges);
        return nextEdges;
      });
      setIsDirty(true);
      addToast('Nodes Connected', 'info', `Linked ${params.source} → ${params.target}`);
    },
    [nodes, saveHistory, addToast]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleAddNodeAtPosition = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      // Limit to 1 trigger node
      if (type === 'trigger') {
        const existingTrigger = nodes.find((n) => n.type === 'trigger');
        if (existingTrigger) {
          addToast('Trigger Exists', 'warning', 'Workflows are limited to one USDC Received trigger node.');
          return;
        }
      }

      const newNodeId = `node-${type}-${Date.now().toString(16)}`;
      const nodePos = position || {
        x: Math.floor(Math.random() * 150) + 300,
        y: Math.floor(Math.random() * 150) + 100,
      };

      let nodeData: any = { label: `${type.toUpperCase()} Node` };
      if (type === 'trigger') nodeData = { label: 'USDC Received', minAmount: '1.00' };
      if (type === 'condition') nodeData = { label: 'Condition Gate', field: 'triggerAmount', operator: '>', value: '10' };
      if (type === 'swap') nodeData = { label: 'Swap Token', percentage: '40', tokenOut: 'EURC' };
      if (type === 'bridge') nodeData = { label: 'CCTP Bridge', percentage: '30', destinationChain: 'Base_Sepolia' };
      if (type === 'send') nodeData = { label: 'Send USDC', percentage: '20' };
      if (type === 'notify') nodeData = { label: 'Notify Alert', template: 'Delta Executed {{amount}} USDC' };
      if (type === 'hold') nodeData = { label: 'Keep Remainder', percentage: '10' };

      const newNode: Node = {
        id: newNodeId,
        type,
        position: nodePos,
        data: nodeData,
      };

      setNodes((nds) => {
        const nextNodes = [...nds, newNode];
        saveHistory(nextNodes, edges);
        return nextNodes;
      });
      setIsDirty(true);
      setSelectedNode(newNode);
      addToast('Node Added', 'success', `Added ${nodeData.label} to canvas`);
    },
    [nodes, edges, saveHistory, addToast]
  );

  // Drag and Drop handlers on canvas container
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = reactFlowInstance?.screenToFlowPosition
        ? reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : { x: event.clientX - 300, y: event.clientY - 120 };

      handleAddNodeAtPosition(type, position);
    },
    [reactFlowInstance, handleAddNodeAtPosition]
  );

  const handleUpdateNodeData = useCallback(
    (nodeId: string, newData: any) => {
      setNodes((nds) => {
        const nextNodes = nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...newData } };
          }
          return node;
        });

        // Update connected edges with updated percentage
        if (newData.percentage) {
          setEdges((eds) =>
            eds.map((e) => (e.target === nodeId ? { ...e, data: { ...e.data, percentage: newData.percentage } } : e))
          );
        }

        saveHistory(nextNodes, edges);
        return nextNodes;
      });

      setSelectedNode((prev) => (prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...newData } } : prev));
      setIsDirty(true);
    },
    [edges, saveHistory]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const nextNodes = nds.filter((node) => node.id !== nodeId);
        const nextEdges = edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
        setEdges(nextEdges);
        saveHistory(nextNodes, nextEdges);
        return nextNodes;
      });
      setSelectedNode(null);
      setIsDirty(true);
      addToast('Node Removed', 'info', `Deleted node ${nodeId} from canvas`);
    },
    [edges, saveHistory, addToast]
  );

  // Auto Arrange / Auto-Layout Nodes Hierarchically
  const handleAutoArrange = useCallback(() => {
    const triggerNodes = nodes.filter((n) => n.type === 'trigger');
    const actionNodes = nodes.filter((n) => n.type !== 'trigger');

    let newNodes: Node[] = [];
    if (triggerNodes.length > 0) {
      newNodes.push({
        ...triggerNodes[0],
        position: { x: 60, y: 180 },
      });
    }

    actionNodes.forEach((node, index) => {
      const yOffset = 60 + index * 140;
      newNodes.push({
        ...node,
        position: { x: 380, y: yOffset },
      });
    });

    setNodes(newNodes);
    saveHistory(newNodes, edges);
    setIsDirty(true);
    addToast('Auto Arranged', 'success', 'Hierarchical layout applied to canvas');
  }, [nodes, edges, saveHistory, addToast]);

  // Save Flow to API
  const handleSave = async () => {
    if (!allocationResult.valid) {
      addToast(
        'Allocation Exceeded',
        'error',
        allocationResult.error || 'Branch allocation percentage exceeds 100%. Please adjust node allocations.'
      );
      return;
    }

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
        setIsDirty(false);
        addToast('Workflow Saved', 'success', 'All changes updated successfully on Arc Testnet.');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        const errData = await res.json();
        setSaveStatus('error');
        addToast('Save Failed', 'error', errData.error || 'Failed to save workflow canvas');
      }
    } catch (err: any) {
      console.error(err);
      setSaveStatus('error');
      addToast('Save Error', 'error', err.message || 'Network error saving workflow');
    } finally {
      setSaving(false);
    }
  };

  // Live Execution Test Trigger (Stays on Canvas + Visual Execution Highlights)
  const handleManualTestTrigger = async () => {
    try {
      setExecutionState({ running: true, stepStatuses: {} });
      addToast('Execution Triggered', 'info', 'Simulated 20 USDC deposit dispatched to execution worker...');

      const res = await fetch(`/api/workflows/${workflowId}/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: '20.00' }),
      });
      const data = await res.json();

      if (res.ok && data.id) {
        const executionId = data.id;
        setExecutionState((prev) => ({ ...prev, activeExecutionId: executionId }));

        // Poll execution status for live canvas visual feedback
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const execRes = await fetch(`/api/workflows/${workflowId}/executions`);
            const execLogs = await execRes.json();
            if (Array.isArray(execLogs)) {
              const currentExec = execLogs.find((e: any) => e.id === executionId);
              if (currentExec) {
                const logs = typeof currentExec.stepLogs === 'string' ? JSON.parse(currentExec.stepLogs) : (currentExec.stepLogs || []);
                const statuses: Record<string, any> = {};

                logs.forEach((log: any) => {
                  statuses[log.stepId] = log.status;
                });

                setExecutionState((prev) => ({ ...prev, stepStatuses: statuses }));

                if (currentExec.status === 'COMPLETED' || currentExec.status === 'FAILED' || attempts > 15) {
                  clearInterval(pollInterval);
                  setExecutionState((prev) => ({ ...prev, running: false }));
                  if (currentExec.status === 'COMPLETED') {
                    addToast('Execution Complete', 'success', 'All canvas nodes executed cleanly!');
                  }
                }
              }
            }
          } catch (pollErr) {
            console.error('Polling execution status error:', pollErr);
          }
        }, 1000);
      }
    } catch (err: any) {
      console.error(err);
      setExecutionState({ running: false, stepStatuses: {} });
      addToast('Trigger Failed', 'error', err.message || 'Failed to dispatch test execution');
    }
  };

  // Enriched styled nodes with live execution rings
  const styledNodes = useMemo(() => {
    return nodes.map((node) => {
      const stepStatus = executionState.stepStatuses[node.id];
      let borderClass = '';
      if (stepStatus === 'RUNNING') borderClass = 'ring-4 ring-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse';
      if (stepStatus === 'COMPLETE') borderClass = 'ring-4 ring-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.5)]';
      if (stepStatus === 'FAILED') borderClass = 'ring-4 ring-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.5)]';
      if (stepStatus === 'SKIPPED') borderClass = 'ring-4 ring-slate-600/60 opacity-50 grayscale';

      return {
        ...node,
        className: `${node.className || ''} ${borderClass}`,
      };
    });
  }, [nodes, executionState.stepStatuses]);

  // Enriched styled edges with custom percentage labels
  const styledEdges = useMemo(() => {
    return edges.map((edge) => {
      const targetNode = nodes.find((n) => n.id === edge.target);
      const percentage = targetNode?.data?.percentage;
      return {
        ...edge,
        type: 'custom',
        animated: true,
        data: { percentage },
      };
    });
  }, [edges, nodes]);

  const handleBackClick = () => {
    if (isDirty) {
      if (confirm('You have unsaved canvas changes. Are you sure you want to leave?')) {
        router.push('/workflows');
      }
    } else {
      router.push('/workflows');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full bg-slate-950">
      {/* Canvas Top Bar */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackClick}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors"
            title="Back to workflows"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setIsDirty(true);
            }}
            className="bg-transparent font-bold text-white text-base focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1"
          />

          <button
            onClick={() => {
              setIsActive(!isActive);
              setIsDirty(true);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
              isActive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            {isActive ? 'Active' : 'Paused'}
          </button>

          {/* Allocation Gauge Badge & Branch Details Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBranchTooltip((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border transition-colors cursor-pointer ${
                !allocationResult.valid
                  ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-red-500/20 animate-pulse'
                  : allocationResult.maxTotal === 100
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
              }`}
              title="Click to view branch allocation breakdown"
            >
              {!allocationResult.valid && <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
              <span>
                {allocationResult.hasBranches
                  ? allocationResult.valid
                    ? `Branches OK (${allocationResult.branchTotals.length} validated)`
                    : `Branch exceeded (${allocationResult.maxTotal}% / 100%)`
                  : `Total Allocation: ${allocationResult.maxTotal}% / 100%`}
              </span>
              <Info className="h-3 w-3 opacity-70 hover:opacity-100 ml-0.5" />
            </button>

            {/* Branch Details Popover */}
            {showBranchTooltip && (
              <div className="absolute top-full left-0 mt-2 z-50 min-w-[250px] rounded-xl border border-slate-800 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-semibold text-white">
                  <span>Branch Allocation Breakdown</span>
                  <span className="text-[10px] text-slate-400">Max 100% per branch</span>
                </div>
                <div className="space-y-1.5">
                  {allocationResult.branchTotals.map((b) => (
                    <div key={b.groupKey} className="flex items-center justify-between font-mono">
                      <span className="text-slate-300 truncate max-w-[160px]">{b.groupName}:</span>
                      <span
                        className={`font-bold ${
                          b.total > 100 ? 'text-red-400' : b.total === 100 ? 'text-emerald-400' : 'text-indigo-300'
                        }`}
                      >
                        {b.total}%
                      </span>
                    </div>
                  ))}
                </div>
                {allocationResult.error && (
                  <p className="text-[11px] text-red-400 border-t border-red-500/20 pt-1.5 font-medium leading-tight">
                    {allocationResult.error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Undo / Redo Toolbar */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900 p-0.5">
            <button
              onClick={handleUndo}
              disabled={historyIndexRef.current <= 0}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndexRef.current >= historyRef.current.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-30"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Auto Arrange Layout Button */}
          <button
            onClick={handleAutoArrange}
            className="hidden md:flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
            title="Auto organize canvas nodes into clean columns"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-indigo-400" />
            <span>Auto Arrange</span>
          </button>

          {/* Trigger Test Flow Button */}
          <button
            onClick={handleManualTestTrigger}
            disabled={executionState.running}
            className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-600/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/20 transition-colors disabled:opacity-50"
          >
            <Play className={`h-3.5 w-3.5 fill-indigo-400 text-indigo-400 ${executionState.running ? 'animate-spin' : ''}`} />
            <span>{executionState.running ? 'Executing...' : 'Trigger Test Flow'}</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-semibold text-white shadow-md transition-colors ${
              isDirty ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/20' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving...' : isDirty ? 'Save Changes' : 'Save Flow'}</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        <NodePalette onAddNode={(type) => handleAddNodeAtPosition(type)} />

        <div className="flex-1 h-full w-full bg-slate-950 relative" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={styledNodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={['Delete', 'Backspace']}
            fitView
            className="bg-slate-950"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
            <Controls className="bg-slate-900 border-slate-800 text-white shadow-xl" />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === 'trigger') return '#10B981';
                if (n.type === 'swap') return '#A855F7';
                if (n.type === 'bridge') return '#3B82F6';
                if (n.type === 'send') return '#F59E0B';
                return '#64748B';
              }}
              maskColor="rgba(2, 6, 23, 0.7)"
              className="!bg-slate-900 !border-slate-800 rounded-xl overflow-hidden shadow-2xl"
            />
          </ReactFlow>

          {/* Floating Canvas Controls Help Footer */}
          <div className="absolute bottom-4 left-4 z-10 hidden lg:flex items-center gap-3 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-1.5 text-[11px] font-medium text-slate-400 backdrop-blur-md shadow-lg pointer-events-none">
            <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-indigo-400" /> Drag & Drop from palette</span>
            <span>•</span>
            <span>Ctrl+Z Undo</span>
            <span>•</span>
            <span>Del to delete selected</span>
          </div>
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

export default function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ToastProvider>
      <ReactFlowProvider>
        <InnerWorkflowCanvas {...props} />
      </ReactFlowProvider>
    </ToastProvider>
  );
}
