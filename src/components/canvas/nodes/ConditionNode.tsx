'use client';

import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

export default function ConditionNode({ data, selected }: { data: any; selected?: boolean }) {
  const operator = data.operator || '>';
  const value = data.value || '10';

  return (
    <div
      className={`min-w-[220px] rounded-xl border-2 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md transition-all relative ${
        selected
          ? 'border-amber-400 ring-4 ring-amber-500/20 shadow-amber-500/20'
          : 'border-amber-500/60 hover:border-amber-400'
      }`}
    >
      {/* Target handle on Left */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-amber-400 !w-3 !h-3 !border-2 !border-slate-900"
      />

      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <GitBranch className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Condition Gate</span>
        </div>
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold font-mono text-amber-300">
          IF / ELSE
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-white">{data.label || 'Condition Gate'}</h4>
        <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2 text-xs font-mono text-amber-300">
          IF deposit <span className="font-bold text-white">{operator}</span> {value} USDC
        </div>
      </div>

      {/* Source Handles on Right: "true" (Green, Top) and "false" (Red, Bottom) */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-6 translate-x-1.5 pointer-events-none">
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-extrabold uppercase text-emerald-400 bg-slate-950/90 px-1 rounded border border-emerald-500/30 mr-1">
            True
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-extrabold uppercase text-red-400 bg-slate-950/90 px-1 rounded border border-red-500/30 mr-1">
            False
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '35%' }}
        className="!bg-emerald-400 !w-3.5 !h-3.5 !border-2 !border-slate-900 pointer-events-auto"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '75%' }}
        className="!bg-red-400 !w-3.5 !h-3.5 !border-2 !border-slate-900 pointer-events-auto"
      />
    </div>
  );
}
