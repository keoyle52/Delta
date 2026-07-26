'use client';

import { Handle, Position } from '@xyflow/react';
import { ArrowDownLeft, Zap } from 'lucide-react';

export default function TriggerNode({ data, selected }: { data: any; selected?: boolean }) {
  return (
    <div
      className={`min-w-[220px] rounded-xl border-2 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md transition-all ${
        selected
          ? 'border-emerald-400 ring-4 ring-emerald-500/20 shadow-emerald-500/20'
          : 'border-emerald-500/60 hover:border-emerald-400'
      }`}
    >
      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <ArrowDownLeft className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Trigger</span>
        </div>
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-white">{data.label || 'USDC Received'}</h4>
        <p className="text-xs text-slate-400">
          Condition: <span className="font-mono text-emerald-300">≥ {data.minAmount || '20'} USDC</span>
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-emerald-400 !w-3 !h-3 !border-2 !border-slate-900"
      />
    </div>
  );
}
