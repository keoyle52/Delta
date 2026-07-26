/**
 * Arc Ecosystem Data Indexer Integration (Envio HyperIndex)
 * Docs: https://docs.arc.io/arc/tools/data-indexers
 */

import axios from 'axios';

export interface IndexedTransfer {
  id: string;
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
  blockNumber: number;
  txHash: string;
  timestamp: string;
}

export interface IndexerStatus {
  isConfigured: boolean;
  statusText: string;
  url?: string;
}

/**
 * Checks Envio Indexer configuration status
 */
export function getIndexerStatus(): IndexerStatus {
  const url = process.env.ENVIO_GRAPHQL_URL;
  if (!url || url.trim() === '' || url.includes('example.com')) {
    return {
      isConfigured: false,
      statusText: 'Envio HyperIndex: Standby (Set ENVIO_GRAPHQL_URL when hosted indexer project is deployed)',
    };
  }
  return {
    isConfigured: true,
    statusText: 'Envio HyperIndex: Active',
    url,
  };
}

/**
 * Fetch indexed token transfer history from Envio HyperIndex GraphQL endpoint
 */
export async function getIndexedWalletTransfers(walletAddress: string): Promise<IndexedTransfer[]> {
  const status = getIndexerStatus();
  if (!status.isConfigured || !walletAddress) return [];

  const query = `
    query GetTransfers($address: String!) {
      transfers(
        where: { _or: [{ from: $address }, { to: $address }] }
        orderBy: timestamp
        orderDirection: desc
        first: 20
      ) {
        id
        from
        to
        amount
        tokenSymbol
        blockNumber
        txHash
        timestamp
      }
    }
  `;

  try {
    const res = await axios.post(
      status.url!,
      {
        query,
        variables: { address: walletAddress.toLowerCase() },
      },
      { timeout: 3000 }
    );

    return res.data?.data?.transfers || [];
  } catch (err: any) {
    console.warn('Envio HyperIndex GraphQL query notice:', err.message || err);
    return [];
  }
}
