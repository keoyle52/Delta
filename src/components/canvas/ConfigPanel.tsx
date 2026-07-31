'use client';

import { Trash2, Settings, AlertCircle, AlertTriangle } from 'lucide-react';
import { isValidEvmAddress, isValidSolanaAddress } from '@/lib/validation/address';

interface ConfigPanelProps {
  selectedNode: any;
  onUpdateNode: (nodeId: string, updatedData: any) => void;
  onDeleteNode: (nodeId: string) => void;
}

export default function ConfigPanel({ selectedNode, onUpdateNode, onDeleteNode }: ConfigPanelProps) {
  if (!selectedNode) {
    return (
      <aside className="w-72 border-l border-slate-800 bg-slate-950/90 p-5 flex flex-col justify-center items-center text-center text-slate-500">
        <Settings className="h-8 w-8 mb-2 opacity-40 text-slate-400" />
        <p className="text-sm font-medium">Select a node in the canvas to edit its configuration</p>
      </aside>
    );
  }

  const { id, type, data } = selectedNode;

  const handleChange = (key: string, value: any) => {
    onUpdateNode(id, { ...data, [key]: value });
  };

  return (
    <aside className="w-80 border-l border-slate-800 bg-slate-950/90 p-5 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              {type} Configuration
            </span>
            <h3 className="text-base font-semibold text-white">{data.label || type}</h3>
          </div>
          <button
            onClick={() => onDeleteNode(id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            title="Delete node"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Common Label Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Node Title / Label</label>
          <input
            type="text"
            value={data.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* TRIGGER NODE CONFIG */}
        {type === 'trigger' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Minimum Deposit (USDC)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={data.minAmount || '20'}
                onChange={(e) => handleChange('minAmount', e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
              />
              <p className="text-[11px] text-slate-500">Workflow triggers when inbound USDC deposit is ≥ this amount.</p>
            </div>
          </div>
        )}

        {/* SWAP NODE CONFIG */}
        {type === 'swap' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Allocation Percentage (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={data.percentage || '40'}
                onChange={(e) => handleChange('percentage', e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-purple-500 focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Target Token (Arc Testnet)</label>
              <select
                value={data.tokenOut || 'EURC'}
                onChange={(e) => handleChange('tokenOut', e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-purple-500 focus:outline-none"
              >
                <option value="EURC">EURC (Circle Euro Stablecoin)</option>
                <option value="USDC">USDC (Native Arc Gas)</option>
              </select>
            </div>
          </div>
        )}

        {/* BRIDGE NODE CONFIG */}
        {type === 'bridge' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Allocation Percentage (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={data.percentage || '30'}
                onChange={(e) => handleChange('percentage', e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Target Destination Chain</label>
              <select
                value={data.destinationChain || 'Solana_Devnet'}
                onChange={(e) => handleChange('destinationChain', e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="Solana_Devnet">Solana Devnet (Solana_Devnet)</option>
                <option value="Arbitrum_Sepolia">Arbitrum Sepolia (Arbitrum_Sepolia)</option>
                <option value="Avalanche_Fuji">Avalanche Fuji (Avalanche_Fuji)</option>
                <option value="Base_Sepolia">Base Sepolia (Base_Sepolia)</option>
                <option value="Ethereum_Sepolia">Ethereum Sepolia (Ethereum_Sepolia)</option>
                <option value="Optimism_Sepolia">OP Sepolia (Optimism_Sepolia)</option>
                <option value="Polygon_Amoy_Testnet">Polygon PoS Amoy (Polygon_Amoy_Testnet)</option>
                <option value="Sei_Testnet">Sei Testnet (Sei_Testnet)</option>
                <option value="Sonic_Testnet">Sonic Testnet (Sonic_Testnet)</option>
                <option value="Unichain_Sepolia">Unichain Sepolia (Unichain_Sepolia)</option>
                <option value="World_Chain_Sepolia">World Chain Sepolia (World_Chain_Sepolia)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Destination Recipient Address</label>
                {data.destinationAddress && !(
                  (data.destinationChain || 'Solana_Devnet') === 'Solana_Devnet'
                    ? isValidSolanaAddress(data.destinationAddress)
                    : isValidEvmAddress(data.destinationAddress)
                ) && (
                  <span className="text-[10px] text-red-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Invalid Address
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder={
                  (data.destinationChain || 'Solana_Devnet') === 'Solana_Devnet'
                    ? 'e.g. 7xKXtg2CW87d97TXJ...'
                    : 'e.g. 0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
                }
                value={data.destinationAddress || ''}
                onChange={(e) => handleChange('destinationAddress', e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-200 focus:outline-none font-mono text-xs ${
                  data.destinationAddress && !(
                    (data.destinationChain || 'Solana_Devnet') === 'Solana_Devnet'
                      ? isValidSolanaAddress(data.destinationAddress)
                      : isValidEvmAddress(data.destinationAddress)
                  )
                    ? 'border-red-500/80 bg-red-950/20 focus:border-red-500'
                    : 'border-slate-800 bg-slate-900 focus:border-blue-500'
                }`}
              />
              <p className="text-[11px] text-slate-500">
                Circle CCTP forwarder mints to recipient address on target chain (0x address for EVM, base58 for Solana).
              </p>
            </div>
          </div>
        )}

        {/* SEND NODE CONFIG */}
        {type === 'send' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Allocation Percentage (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={data.percentage || '20'}
                onChange={(e) => handleChange('percentage', e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Recipient EVM Address</label>
                {data.destinationAddress && !isValidEvmAddress(data.destinationAddress) && (
                  <span className="text-[10px] text-red-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Invalid EVM Address
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="0x..."
                value={data.destinationAddress || ''}
                onChange={(e) => handleChange('destinationAddress', e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-200 focus:outline-none font-mono text-xs ${
                  data.destinationAddress && !isValidEvmAddress(data.destinationAddress)
                    ? 'border-red-500/80 bg-red-950/20 focus:border-red-500'
                    : 'border-slate-800 bg-slate-900 focus:border-amber-500'
                }`}
              />
            </div>
          </div>
        )}

        {/* NOTIFY NODE CONFIG */}
        {type === 'notify' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Webhook URL (Discord / Telegram)</label>
              <input
                type="url"
                placeholder="https://discord.com/api/webhooks/..."
                value={data.webhookUrl || ''}
                onChange={(e) => handleChange('webhookUrl', e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-yellow-500 focus:outline-none text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Message Template</label>
              <textarea
                rows={3}
                value={data.template || 'Delta Alert: {{amount}} USDC received. Tx: {{txHash}}'}
                onChange={(e) => handleChange('template', e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-yellow-500 focus:outline-none font-mono"
              />
              <p className="text-[11px] text-slate-500">Variables: {'{{amount}}, {{txHash}}, {{step}}'}</p>
            </div>
          </div>
        )}

        {/* HOLD NODE CONFIG */}
        {type === 'hold' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Retained Percentage (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={data.percentage || '10'}
                onChange={(e) => handleChange('percentage', e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
        <span>Changes apply immediately to canvas node</span>
      </div>
    </aside>
  );
}
