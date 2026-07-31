'use client';

import { Handle, Position } from '@xyflow/react';
import { Network } from 'lucide-react';
import { isValidEvmAddress, isValidSolanaAddress } from '@/lib/validation/address';

export default function BridgeNode({ data, selected }: { data: any; selected?: boolean }) {
  const isSolana = (data.destinationChain || 'Solana_Devnet') === 'Solana_Devnet';
  const hasConfigError =
    !data.destinationAddress ||
    !(isSolana ? isValidSolanaAddress(data.destinationAddress) : isValidEvmAddress(data.destinationAddress));

  return (
    <div
      className={`min-w-[220px] rounded-xl border-2 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md transition-all relative ${
        selected
          ? 'border-blue-400 ring-4 ring-blue-500/20 shadow-blue-500/20'
          : 'border-blue-500/60 hover:border-blue-400'
      }`}
    >
      {hasConfigError && (
        <div
          className="absolute -top-2 -right-2 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/50 animate-pulse"
          title="Missing or invalid recipient destination address"
        >
          !
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-slate-900"
      />

      <div className="flex items-center justify-between border-b border-blue-500/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
            <Network className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">CCTP Bridge</span>
        </div>
        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-300">
          {data.percentage || '30'}%
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-white">
          {data.label || `Bridge to ${data.destinationChain || 'Solana_Devnet'}`}
        </h4>
        <p className="text-xs text-slate-400">
          Dest: <span className="font-mono text-blue-300">{data.destinationChain || 'Solana_Devnet'}</span>
        </p>
        {data.destinationAddress && (
          <p className="text-[10px] font-mono text-slate-500 truncate max-w-[190px]">
            {data.destinationAddress}
          </p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-slate-900"
      />
    </div>
  );
}
