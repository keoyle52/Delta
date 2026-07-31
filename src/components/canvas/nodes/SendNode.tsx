'use client';

import { Handle, Position } from '@xyflow/react';
import { Send, AlertTriangle } from 'lucide-react';
import { isValidEvmAddress } from '@/lib/validation/address';

export default function SendNode({ data, selected }: { data: any; selected?: boolean }) {
  const hasConfigError = !data.destinationAddress || !isValidEvmAddress(data.destinationAddress);

  return (
    <div
      className={`min-w-[220px] rounded-xl border-2 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md transition-all relative ${
        selected
          ? 'border-amber-400 ring-4 ring-amber-500/20 shadow-amber-500/20'
          : 'border-amber-500/60 hover:border-amber-400'
      }`}
    >
      {hasConfigError && (
        <div
          className="absolute -top-2 -right-2 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/50 animate-pulse"
          title="Missing or invalid recipient EVM address"
        >
          !
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-amber-400 !w-3 !h-3 !border-2 !border-slate-900"
      />

      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Send className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Send</span>
        </div>
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
          {data.percentage || '20'}%
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-white">{data.label || 'Send USDC'}</h4>
        <p className="text-[10px] font-mono text-slate-400 truncate max-w-[190px]">
          {data.destinationAddress ? data.destinationAddress : 'EVM Address required'}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-amber-400 !w-3 !h-3 !border-2 !border-slate-900"
      />
    </div>
  );
}
