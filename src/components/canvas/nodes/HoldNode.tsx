'use client';

import { Handle, Position } from '@xyflow/react';
import { ShieldCheck } from 'lucide-react';

export default function HoldNode({ data, selected }: { data: any; selected?: boolean }) {
  return (
    <div
      className={`min-w-[220px] rounded-xl border-2 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md transition-all ${
        selected
          ? 'border-cyan-400 ring-4 ring-cyan-500/20 shadow-cyan-500/20'
          : 'border-cyan-500/60 hover:border-cyan-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-cyan-400 !w-3 !h-3 !border-2 !border-slate-900"
      />

      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Hold</span>
        </div>
        <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-300">
          {data.percentage || '10'}%
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-white">{data.label || 'Keep Remainder'}</h4>
        <p className="text-xs text-slate-400">
          Safely stored in Arc Wallet
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-cyan-400 !w-3 !h-3 !border-2 !border-slate-900"
      />
    </div>
  );
}
