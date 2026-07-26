'use client';

import { Handle, Position } from '@xyflow/react';
import { RefreshCw } from 'lucide-react';

export default function SwapNode({ data, selected }: { data: any; selected?: boolean }) {
  return (
    <div
      className={`min-w-[220px] rounded-xl border-2 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md transition-all ${
        selected
          ? 'border-purple-400 ring-4 ring-purple-500/20 shadow-purple-500/20'
          : 'border-purple-500/60 hover:border-purple-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-purple-400 !w-3 !h-3 !border-2 !border-slate-900"
      />

      <div className="flex items-center justify-between border-b border-purple-500/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
            <RefreshCw className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Swap</span>
        </div>
        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-bold text-purple-300">
          {data.percentage || '40'}%
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-white">{data.label || 'Swap to EURC'}</h4>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>USDC</span>
          <span>→</span>
          <span className="font-mono font-semibold text-purple-300">{data.tokenOut || 'EURC'}</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-purple-400 !w-3 !h-3 !border-2 !border-slate-900"
      />
    </div>
  );
}
