# Delta — Visual Flow Automation on Arc Testnet

![Built on Arc](https://img.shields.io/badge/Built%20on-Arc%20Testnet%20(%235042002)-6366f1?style=for-the-badge)

Delta is a visual node-based money-flow automation platform built for the **Circle Arc Hackathon**. Users can design, test, and run automated payment workflows (Swaps, CCTP Bridges to Solana, EVM Sends, Notifications) on **Arc Testnet (#5042002)** using **Circle Developer-Controlled Wallets** and **Circle App Kit**.

---

## ⚡ Core Features

- **Circle Custodial Developer-Controlled Wallets**: Automatic user wallet provisioning on **Arc Testnet (`"ARC-TESTNET"`)** bound to a single application-wide Wallet Set.
- **Circle App Kit Integration**: Execute token swaps (`USDC` $\rightarrow$ `EURC`), cross-chain CCTP bridges (`Arc_Testnet` $\rightarrow$ `Solana_Devnet`), and EVM USDC transfers.
- **Arc Multi-Node Provider RPC Fallback**: Built using `viem` fallback transport across official Arc node provider partners (**Arc Public RPC**, **Blockdaemon**, **dRPC**).
- **Durable Background Execution**: Sequential workflow automation steps managed via **Inngest** with real-time log tracking.
- **Cryptographic Webhook Verification**: Runtime Circle Webhook signature verification using **ECDSA + SHA-256** and dynamic public key caching.
- **Visual Flow Editor (`@xyflow/react`)**: Node palette supporting Trigger (USDC Received), Swap, Bridge, Send, Notify, and Hold nodes with strict $\le 100\%$ allocation validation.

---

## 🚀 Getting Started & Setup

### 1. Installation
```bash
git clone https://github.com/keoyle52/Delta.git
cd Delta
npm install
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

### 4. Register Circle Entity Secret & Generate Wallet Set
Run the one-time setup scripts:
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
