import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

async function testWebhookPayloads() {
  console.log('===========================================================');
  console.log('TESTING UPDATED CIRCLE WEBHOOK FILTERING LOGIC');
  console.log('===========================================================');

  const testPayloads = [
    {
      name: 'Circle DCW Transfer Update Payload (transfers.update)',
      payload: {
        notificationType: 'transfers.update',
        notification: {
          id: '5f991d8c-a5d2-5a6c-b66a-719fb8ea98ae',
          walletId: 'b7c220f4-716f-5fcd-9f70-c3cc7ff54e3a',
          destinationAddress: '0xb191b3ae39685d69c69aabd35bf9f36d1ef60fd1',
          sourceAddress: '0x9999999999999999999999999999999999999999',
          amounts: ['10.00'],
          tokenSymbol: 'USDC',
          status: 'COMPLETE',
          transactionType: 'INBOUND',
        },
      },
    },
    {
      name: 'Circle Core Transactions Inbound Payload (transactions.inbound)',
      payload: {
        notificationType: 'transactions.inbound',
        notification: {
          id: '0x-sample-tx-hash-12345',
          walletId: 'b7c220f4-716f-5fcd-9f70-c3cc7ff54e3a',
          destinationAddress: '0xb191b3ae39685d69c69aabd35bf9f36d1ef60fd1',
          sourceAddress: '0x9999999999999999999999999999999999999999',
          amounts: ['10.00'],
          tokenSymbol: 'USDC',
          state: 'COMPLETE',
          type: 'INBOUND',
        },
      },
    },
    {
      name: 'Circle Outbound Transfer Payload (Should be IGNORED)',
      payload: {
        notificationType: 'transfers.update',
        notification: {
          id: '0x-sample-tx-hash-67890',
          walletId: 'b7c220f4-716f-5fcd-9f70-c3cc7ff54e3a',
          destinationAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
          sourceAddress: '0xb191b3ae39685d69c69aabd35bf9f36d1ef60fd1',
          amounts: ['10.00'],
          tokenSymbol: 'USDC',
          status: 'COMPLETE',
          transactionType: 'OUTBOUND',
        },
      },
    },
  ];

  for (const item of testPayloads) {
    console.log(`\n--- Payload Test: "${item.name}" ---`);

    const notificationType = item.payload.notificationType || '';
    const eventData = item.payload.notification || item.payload;
    const rawTxType = (eventData.transactionType || eventData.type || eventData.operation || eventData.direction || '').toUpperCase();

    const isMatchingType =
      notificationType.includes('inbound') ||
      notificationType.includes('transfers') ||
      notificationType.includes('transactions') ||
      rawTxType === 'INBOUND';

    const isOutbound = rawTxType === 'OUTBOUND' || rawTxType.includes('SWAP') || rawTxType.includes('INTERNAL');

    if (isMatchingType && !isOutbound) {
      console.log('   Result: ✅ MATCHED & PROCESSED AS INBOUND DEPOSIT');
    } else if (isOutbound) {
      console.log('   Result: 🚫 IGNORED AS OUTBOUND TRANSFER (Correct behavior)');
    } else {
      console.log('   Result: ❌ REJECTED/UNMATCHED');
    }
  }

  console.log('===========================================================');
  await prisma.$disconnect();
}

testWebhookPayloads();
