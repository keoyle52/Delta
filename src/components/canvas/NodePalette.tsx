'use client';

import { ArrowDownLeft, RefreshCw, Network, Send, Bell, ShieldCheck } from 'lucide-react';

interface NodePaletteProps {
  onAddNode: (type: string) => void;
}

export default function NodePalette({ onAddNode }: NodePaletteProps) {
  const nodeTemplates = [
    {
      type: 'trigger',
      label: 'USDC Received',
      icon: ArrowDownLeft,
      color: 'border-emerald-500/40 hover:border-emerald-400 bg-emerald-950/20 text-emerald-300',
      desc: 'Starts flow when USDC hits wallet',
    },
    {
      type: 'swap',
      label: 'Swap Token',
      icon: RefreshCw,
      color: 'border-purple-500/40 hover:border-purple-400 bg-purple-950/20 text-purple-300',
      desc: 'Swap USDC to EURC/USDC on Arc',
    },
    {
      type: 'bridge',
      label: 'CCTP Bridge',
      icon: Network,
      color: 'border-blue-500/40 hover:border-blue-400 bg-blue-950/20 text-blue-300',
      desc: 'Bridge USDC to Solana Devnet',
    },
    {
      type: 'send',
      label: 'Send USDC',
      icon: Send,
      color: 'border-amber-500/40 hover:border-amber-400 bg-amber-950/20 text-amber-300',
      desc: 'Direct USDC send to EVM address',
    },
    {
      type: 'notify',
      label: 'Notification',
      icon: Bell,
      color: 'border-yellow-500/40 hover:border-yellow-400 bg-yellow-950/20 text-yellow-300',
      desc: 'Webhook or Discord alert',
    },
    {
      type: 'hold',
      label: 'Keep Remainder',
      icon: ShieldCheck,
      color: 'border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 text-cyan-300',
      desc: 'Retain remaining percentage',
    },
  ];

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950/90 p-4 flex flex-col gap-4 overflow-y-auto select-none">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
          Node Palette
        </h3>
        <p className="text-xs text-slate-500">
          Click or drag nodes into canvas
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {nodeTemplates.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              onClick={() => onAddNode(item.type)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all hover:scale-[1.02] cursor-grab active:cursor-grabbing ${item.color}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900/80 pointer-events-none">
                <Icon className="h-4 w-4" />
              </div>
              <div className="pointer-events-none">
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="text-[11px] text-slate-400 leading-tight">{item.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
