# Delta — Visual Programmable Money Workflows on Arc

[![Built on Arc](https://img.shields.io/badge/Built%20on-Arc%20Mainnet%20(%235042)%20%26%20Testnet%20(%235042002)-6366f1?style=for-the-badge)](https://docs.arc.io)
[![Circle Microgrants](https://img.shields.io/badge/Circle-Arc%20Microgrants%20Submission-00D26A?style=for-the-badge)](https://circle.com)
[![Circle SDK](https://img.shields.io/badge/Circle%20SDK-Developer--Controlled%20Wallets%20%2B%20App%20Kit-2775CA?style=for-the-badge)](https://developers.circle.com)
[![USDC Native Gas](https://img.shields.io/badge/Gas%20Token-Native%20USDC-blue?style=for-the-badge)](https://docs.arc.io/arc/concepts/stable-fee-design.md)

Delta is a visual node-based programmable money workflow platform migrated to **Arc Mainnet (#5042)** with full dual-network support (**Arc Mainnet** and **Arc Testnet #5042002**) for the **Circle Arc Microgrants**.

Users can visually design, simulate, and execute automated financial workflows—including token swaps (USDC $\leftrightarrow$ EURC), cross-chain CCTP forwarder bridges to Solana, Base, and Ethereum, and direct EVM transfers—powered by **Circle Developer-Controlled Wallets**, **Circle App Kit**, and **Inngest**.

---

## Why Arc? The Programmable Money Advantage

Arc is purpose-built for programmable money, eliminating the friction and unpredictability of traditional EVM blockchains:

1. **Native USDC Gas Token**: All transaction fees on Arc are denominated and paid directly in **USDC**. Users and smart agents never need to hold volatile foreign gas tokens (e.g., ETH, SOL, MATIC).
2. **Deterministic Sub-Second Finality**: Transactions on Arc settle irreversibly in under 1 second without waiting for multi-block confirmations.
3. **Predictable Stable Gas Fees with 20 Gwei Floor**: Arc Mainnet enforces a 20 Gwei minimum gas fee floor (`minGasFeeFloorGwei = 20n`). A standard transfer (21,000 gas) costs exactly **~$0.00042 USDC**, and complex swaps/bridges cost **~$0.004 USDC**.
4. **Unified 6-Decimal Balance Reads**: On Arc, native gas (18 decimals) and ERC-20 USDC (6 decimals) represent the same underlying balance. Delta reads USDC balances strictly via the 6-decimal ERC-20 contract (`0x3600000000000000000000000000000000000000`), preventing balance double-counting.

---

## Architecture & Multi-Network Design

```
                     ┌────────────────────────────────────────┐
                     │          Delta Web Application         │
                     │  (Next.js App Router, Privy Auth)      │
                     └───────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │       Runtime Network Selector (Context)      │
                 │   Default: Arc Mainnet (#5042)                │
                 │   Toggle:  Arc Testnet (#5042002)             │
                 └───────────────┬───────────────────────┬───────┘
                                 │                       │
                [Mainnet Mode]   │                       │   [Testnet Mode]
                                 ▼                       ▼
      ┌─────────────────────────────┐         ┌─────────────────────────────┐
      │      Arc Mainnet (#5042)    │         │    Arc Testnet (#5042002)   │
      ├─────────────────────────────┤         ├─────────────────────────────┤
      │ • USDC: 0x3600...0000       │         │ • USDC: 0x3600...0000       │
      │ • EURC: 0xbEf5...21c1       │         │ • EURC: 0x89B5...D72a       │
      │ • CCTP Messenger:           │         │ • CCTP Messenger:           │
      │   0x28b5...cf5d             │         │   0x8FE6...2DAA             │
      │ • 20 Gwei Gas Floor         │         │ • 0 Gwei Gas Floor          │
      │ • Chain Code: "ARC"         │         │ • Chain Code: "ARC-TESTNET" │
      │ • 4 Fallback RPC Providers  │         │ • 4 Fallback RPC Providers  │
      └─────────────────────────────┘         └─────────────────────────────┘
                                 ▲                       ▲
                                 │                       │
      ┌──────────────────────────┴───────────────────────┴──────────────────┐
      │                      Neon PostgreSQL Database                       │
      │  • User: activeNetwork ("mainnet" | "testnet")                      │
      │  • Wallet: @@unique([userId, network]), blockchain ("ARC"|"ARC-TESTNET")│
      │  • Workflow: scoped by network                                      │
      │  • Execution: scoped by network with 409 Conflict guards            │
      └─────────────────────────────────────────────────────────────────────┘
```

### 1. Multi-Network Runtime Selector
- A segmented network toggle in the header allows users to switch between **Arc Mainnet (#5042)** and **Arc Testnet (#5042002)**.
- User preference is synchronized with the server via `PATCH /api/user/network` and persisted in the Neon PostgreSQL database.
- A persistent warning banner is prominently displayed whenever Testnet mode is active.

### 2. Isolated Custodial Wallets per Network
- Users receive separate Developer-Controlled Wallets for Mainnet and Testnet, keyed by the compound unique constraint `@@unique([userId, network])`.
- Wallets are lazily provisioned on-demand when switching networks.
- Circle chain code `'ARC'` is used on Mainnet; `'ARC-TESTNET'` is used on Testnet.

### 3. Strict Server Credential Isolation
- Dedicated server-only environment variables:
  - `CIRCLE_MAINNET_API_KEY`, `CIRCLE_MAINNET_ENTITY_SECRET`, `CIRCLE_MAINNET_WALLET_SET_ID`, `CIRCLE_MAINNET_KIT_KEY`
  - `CIRCLE_TESTNET_API_KEY`, `CIRCLE_TESTNET_ENTITY_SECRET`, `CIRCLE_TESTNET_WALLET_SET_ID`, `CIRCLE_TESTNET_KIT_KEY`
- **Security Guard**: `getServerCircleCredentials('mainnet')` throws an immediate security exception if mainnet credentials are not configured. **Silent fallback to testnet is strictly prohibited.**

### 4. Cross-Network Conflict Guards (HTTP 409)
- All execution triggers, wallet balances, and withdrawal routes enforce strict network matching.
- If an execution request or wallet query does not match the active network, the server returns `409 Conflict` and aborts.

---

## Circle Technology Stack

| Circle Product | Implementation in Delta |
| :--- | :--- |
| **Developer-Controlled Wallets** | Custodial EOA wallet creation via `@circle-fin/developer-controlled-wallets`. Outbound transfers with UUID idempotency and network-scoped clients. |
| **Circle App Kit** | Unified liquidity operations via `@circle-fin/app-kit`: <br>• `kit.swap`: Same-chain token swaps on Arc (USDC $\leftrightarrow$ EURC).<br>• `kit.bridge`: CCTP forwarder bridges from Arc to Solana, Base, Ethereum, etc.<br>• `kit.send`: Direct token transfers with automatic fallback to DCW API. |
| **CCTP v2** | Cross-Chain Transfer Protocol with forwarder-based destination minting (`useForwarder: true`). Mainnet contracts: `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` (TokenMessenger) and `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` (MessageTransmitter). |
| **Webhooks** | Real-time inbound deposit detection via `/api/webhooks/circle`. Verified using ECDSA SHA-256 signatures and per-network cached public keys (`${network}:${keyId}`). |

---

## Security Hardening & Edge-Case Protections

1. **Address(0) Rejection**: Rejection of `0x0000000000000000000000000000000000000000` before submitting to Arc RPC (sends to `address(0)` revert on Arc).
2. **Gas Reserve Guard**: The workflow engine checks that the user wallet retains at least **0.05 USDC** before executing swaps or bridges to prevent out-of-gas failures.
3. **Anti-Loop Webhook Protection**: Inbound EURC transfers and transfers originating from the user's own custodial wallet are discarded to prevent infinite swap/trigger loops.
4. **Rate Limiting**: In-memory rate limiting applied across sensitive routes:
   - `/api/wallet/withdraw`: 5 requests/minute
   - `/api/workflows/[id]/executions`: 10 requests/minute
   - `/api/workflows`: 20 requests/minute
   - `/api/user/network`: 20-60 requests/minute
   - `/api/wallet/balance`: 60 requests/minute
5. **Multi-RPC Fallback Resilience**: Viem public clients configured with 4 distinct RPC providers per network (Arc Public, Blockdaemon, dRPC, QuickNode).
6. **Simulation Mode Security**: Withdrawals are strictly disabled for simulation accounts (HTTP 403).

---

## Getting Started & Local Development

### 1. Clone & Install
```bash
git clone https://github.com/keoyle52/delta.git
cd delta
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and provide your credentials:
```bash
cp .env.example .env
```

### 3. Database Synchronization
```bash
npx prisma db push
```

### 4. Run Development Servers
Local development requires running two terminal windows:
```bash
# Terminal 1: Next.js App Router Server
npm run dev

# Terminal 2: Inngest Background Worker
npm run inngest:dev
```

---

## Verification & Test Scripts

Delta includes standalone verification scripts covering every phase of the migration:

```bash
# Phase 3: USDC Gas & 20 Gwei floor verification
npx tsx scripts/verify-phase3-gas-decimals.ts

# Phase 4: Circle Developer-Controlled Wallets & credential security
npx tsx scripts/verify-phase4-circle-wallets.ts

# Phase 5: Circle App Kit & CCTP forwarder verification
npx tsx scripts/verify-phase5-app-kit.ts

# Phase 6: Webhook signature verification & loop prevention
npx tsx scripts/verify-phase6-webhooks.ts

# Phase 7: Rate limits, 409 conflict guards & address(0) rejection
npx tsx scripts/verify-phase7-security-ratelimits.ts
```

---

## Production Deployment to Vercel

1. **Deploy to Vercel**: Connect your GitHub repository to Vercel.
2. **Configure Environment Variables**:
   - Set `DATABASE_URL` to your Neon PostgreSQL connection string.
   - Set `NEXTAUTH_SECRET` (`openssl rand -hex 32`) and `NEXTAUTH_URL`.
   - Set `NEXT_PUBLIC_PRIVY_APP_ID` and `PRIVY_APP_SECRET`.
   - Set `CIRCLE_MAINNET_*` credentials for live production transactions.
   - Set `CIRCLE_TESTNET_*` credentials for testnet users.
   - Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` from your Inngest Cloud dashboard.
3. **Register Circle Webhook**:
   - In the Circle Developer Console, register your production webhook URL:
     `https://your-domain.vercel.app/api/webhooks/circle`
   - Select notification types: `transfers.inbound`, `transfers.outbound`, `wallets.created`.
