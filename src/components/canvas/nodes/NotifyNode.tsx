'use client';

import { Handle, Position } from '@xyflow/react';
import { Bell } from 'lucide-react';

export default function NotifyNode({ data, selected }: { data: any; selected?: boolean }) {
  return (
    <div
      className={`min-w-[220px] rounded-xl border-2 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md transition-all ${
        selected
          ? 'border-yellow-400 ring-4 ring-yellow-500/20 shadow-yellow-500/20'
          : 'border-yellow-500/60 hover:border-yellow-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-yellow-400 !w-3 !h-3 !border-2 !border-slate-900"
      />

      <div className="flex items-center justify-between border-b border-yellow-500/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-500/20 text-yellow-400">
            <Bell className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">Notify</span>
        </div>
        <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-bold text-yellow-300">
          Alert
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-white">{data.label || 'Discord Notification'}</h4>
        <p className="text-[10px] text-slate-400 truncate max-w-[190px]">
          {data.webhookUrl ? 'Webhook configured' : 'Webhook URL needed'}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-yellow-400 !w-3 !h-3 !border-2 !border-slate-900"
      />
    </div>
  );
}
