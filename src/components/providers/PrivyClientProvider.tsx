'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';

export default function PrivyClientProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !appId || !appId.startsWith('c')) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email'],
        appearance: {
          theme: 'dark',
          accentColor: '#6366f1',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'off' },
          solana: { createOnLogin: 'off' },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
