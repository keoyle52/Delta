'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Network, NetworkConfig, getNetworkConfig } from '@/config/network';

interface NetworkContextType {
  network: Network;
  setNetwork: (nextNetwork: Network) => Promise<void>;
  isMainnet: boolean;
  config: NetworkConfig;
  isLoading: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>('mainnet');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial network preference from server on mount
  useEffect(() => {
    let isMounted = true;
    async function loadNetworkPreference() {
      try {
        const res = await fetch('/api/user/network');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && (data.network === 'mainnet' || data.network === 'testnet')) {
            setNetworkState(data.network);
          }
        }
      } catch (err) {
        console.warn('Could not load user network preference, defaulting to mainnet:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadNetworkPreference();
    return () => {
      isMounted = false;
    };
  }, []);

  const setNetwork = async (nextNetwork: Network) => {
    if (nextNetwork === network) return;
    setNetworkState(nextNetwork);

    try {
      await fetch('/api/user/network', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network: nextNetwork }),
      });
    } catch (err) {
      console.error('Failed to persist user network selection to server:', err);
    }
  };

  const config = getNetworkConfig(network);
  const isMainnet = network === 'mainnet';

  return (
    <NetworkContext.Provider
      value={{
        network,
        setNetwork,
        isMainnet,
        config,
        isLoading,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
