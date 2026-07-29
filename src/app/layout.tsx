import type { Metadata } from 'next';
import NextAuthProvider from '@/components/providers/NextAuthProvider';
import PrivyClientProvider from '@/components/providers/PrivyClientProvider';
import Header from '@/components/layout/Header';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Delta — Visual Flow Automation on Arc',
  description: 'Design visual blockchain money flow workflows powered by Circle Developer-Controlled Wallets and CCTP on Arc Testnet.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen flex flex-col">
        <PrivyClientProvider>
          <NextAuthProvider>
            <Header />
            <main className="flex-1 flex flex-col">{children}</main>
          </NextAuthProvider>
        </PrivyClientProvider>
      </body>
    </html>
  );
}
