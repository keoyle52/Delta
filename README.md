# Delta — Visual Flow Automation on Arc Testnet

![Built on Arc](https://img.shields.io/badge/Built%20on-Arc%20Testnet%20(%235042002)-6366f1?style=for-the-badge)

Delta is a visual node-based money-flow automation platform built for the **Circle Arc Hackathon**. Users can design, test, and run automated payment workflows (Swaps, CCTP Bridges to Solana, EVM Sends, Notifications) on **Arc Testnet (#5042002)** using **Circle Developer-Controlled Wallets** and **Circle App Kit**.

---

## ⚡ Core Features

- **Privy Passwordless Authentication**: Seamless email OTP authentication powered by **Privy** (Circle/Arc ecosystem partner with 499 free MAU / 50k signatures / $1M volume free).
- **Circle Custodial Developer-Controlled Wallets**: Automatic user wallet provisioning on **Arc Testnet (`"ARC-TESTNET"`)** bound to a single application-wide Wallet Set.
- **Circle App Kit Multi-Chain Integration**: Token swaps (`USDC` $\rightarrow$ `EURC`), multi-chain CCTP forwarder bridges (`Arc_Testnet` $\rightarrow$ Solana Devnet, Arbitrum Sepolia, Base Sepolia, Ethereum Sepolia, OP Sepolia, Polygon Amoy, etc.), and EVM USDC transfers.
- **Arc Multi-Node Provider RPC Fallback**: Built using `viem` fallback transport across official Arc node provider partners (**Arc Public RPC**, **Blockdaemon**, **dRPC**).
- **Durable Background Execution & Live Audit Trail**: Sequential workflow automation steps managed via **Inngest** with real-time granular log state updates (`RUNNING` $\rightarrow$ `PARTIAL` $\rightarrow$ `COMPLETE`).
- **Cryptographic Webhook Verification**: Runtime Circle Webhook signature verification using **ECDSA + SHA-256** and dynamic public key caching.
- **Visual Flow Editor (`@xyflow/react`)**: Node palette supporting Trigger (USDC Received), Swap, Bridge, Send, Notify, and Hold nodes with strict $\le 100\%$ allocation validation.

---

## 🚀 Getting Started & Setup

### 1. Installation
```bash
git clone https://github.com/keoyle52/Delta.git
cd Delta
npm install --legacy-peer-deps
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

### 3. Database Synchronization (Neon PostgreSQL)
```bash
npx prisma db push
```

### 4. Configure Privy App & Register Circle Entity Secret
1. Create a free app at [dashboard.privy.io](https://dashboard.privy.io) and obtain your `NEXT_PUBLIC_PRIVY_APP_ID` and `PRIVY_APP_SECRET`.
2. Run the one-time Circle setup scripts:
```bash
# Register Entity Secret on Circle Developer Console
npx tsx scripts/register-entity-secret-sdk.ts

# Create single application-wide Wallet Set
npm run setup:wallet-set
```

### 5. Running Locally
Local development requires running two terminal windows concurrently:

```bash
# Terminal 1: Next.js App Router Server
npm run dev

# Terminal 2: Inngest Background Job Runner
npm run inngest:dev
```

---

## 🏛️ Built on Arc Attribution Note

Delta is purpose-built for the **Circle Arc Hackathon**. All native gas fees and transaction settlements on Arc Testnet use **USDC** with sub-second deterministic finality.
