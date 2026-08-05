# Circle Arc API Compliance Audit

**Date**: July 28, 2026  
**Auditor**: Self-audit / internal review  
**Target Repository**: `Delta` (github.com/keoyle52/Delta)  
**Target Environment**: Arc Public Testnet (`#5042002`)  

---

## Executive Summary

A full end-to-end API compliance audit was conducted for all Circle App Kit (`@circle-fin/app-kit`), Circle Developer-Controlled Wallets (`@circle-fin/developer-controlled-wallets`), and Arc Testnet integrations across the Delta repository. Every API invocation site was validated against current official Arc/Circle documentation.

**Overall Audit Result**: `100% PASS`

---

## Call Site Audit Matrix

| Call Site File & Location | API Call / Feature | Official Reference Doc | Status | Audit Findings & Notes |
| :--- | :--- | :--- | :---: | :--- |
| [`src/lib/circle/app-kit.ts#L13`](../src/lib/circle/app-kit.ts#L13) | `new AppKit()` | [sdk-reference.md](https://docs.arc.io/app-kit/references/sdk-reference.md) | `PASS` | Instantiates AppKit with default configuration. |
| [`src/lib/circle/app-kit.ts#L24`](../src/lib/circle/app-kit.ts#L24) | `createCircleWalletsAdapter()` | [adapter-setups](https://docs.arc.io/app-kit/tutorials/adapter-setups) | `PASS` | Requires `apiKey` and `entitySecret`. |
| [`src/lib/circle/app-kit.ts#L53`](../src/lib/circle/app-kit.ts#L53) | `kit.swap()` | [swap.md](https://docs.arc.io/app-kit/swap.md) | `PASS` | Parameters match `from` (`Arc_Testnet`), `tokenIn`, `tokenOut`, `amountIn`, `config.kitKey`. |
| [`src/lib/circle/app-kit.ts#L91`](../src/lib/circle/app-kit.ts#L91) | `kit.getSupportedChains('bridge')` | [supported-blockchains.md](https://docs.arc.io/app-kit/references/supported-blockchains.md) | `PASS` | Returns supported bridge definitions and verifies forwarder capability. |
| [`src/lib/circle/app-kit.ts#L99`](../src/lib/circle/app-kit.ts#L99) | `kit.bridge()` | [bridge.md](https://docs.arc.io/app-kit/bridge.md) | `PASS` | Dynamic `destinationChain` and `useForwarder: true` + `recipientAddress` parameters match SDK schema. |
| [`src/lib/circle/app-kit.ts#L138`](../src/lib/circle/app-kit.ts#L138) | `kit.send()` | [send.md](https://docs.arc.io/app-kit/send.md) | `PASS` | Transfers USDC/EURC on `Arc_Testnet` with valid parameters. |
| [`src/lib/circle/wallets.ts#L20`](../src/lib/circle/wallets.ts#L20) | `createWalletSet()` | Circle Developer-Controlled Wallets API | `PASS` | Single app-wide wallet set provisioned with `name`. |
| [`src/lib/circle/wallets.ts#L40`](../src/lib/circle/wallets.ts#L40) | `createWallets()` | Circle Developer-Controlled Wallets API | `PASS` | Creates custodial wallet on `"ARC-TESTNET"` blockchain. |
| [`scripts/register-entity-secret-sdk.ts`](../scripts/register-entity-secret-sdk.ts) | `registerEntitySecretCiphertext()` | Circle Developer Onboarding Flow | `PASS` | Registers 32-byte hex entity secret with RSA public key encryption and outputs recovery file. |

---

## Detailed Compliance Verifications

### 1. Chain Identifiers (`BridgeChain` Enum Compliance)
- **Source Chain**: `"Arc_Testnet"` (PascalCase with underscore). Matches `@circle-fin/app-kit` `BridgeChain.Arc_Testnet`.
- **Destination Chains**: `"Solana_Devnet"`, `"Arbitrum_Sepolia"`, `"Avalanche_Fuji"`, `"Base_Sepolia"`, `"Ethereum_Sepolia"`, `"Optimism_Sepolia"`, `"Polygon_Amoy_Testnet"`, `"Sei_Testnet"`, `"Sonic_Testnet"`, `"Unichain_Sepolia"`, `"World_Chain_Sepolia"`.
- All identifiers match official exception table in `supported-blockchains.md`.

### 2. Forwarder Mode & Recipient Address Pattern
- Uses `to: { chain: destinationChain, recipientAddress: destinationAddress, useForwarder: true }`.
- Verified against [use-forwarding-service](https://docs.arc.io/app-kit/tutorials/bridge/use-forwarding-service) (allows direct bridging without requiring destination wallet adapter).

### 3. Step-by-Step Execution Durability
- `inngest.createFunction()` logs initial `RUNNING` status immediately to database before async operation.
- CCTP bridge steps (`burn`, `mint`) transition state from `RUNNING` $\rightarrow$ `PARTIAL` (Burn confirmed, attestation pending) $\rightarrow$ `COMPLETE` (Mint confirmed).

### 4. Authentication & Wallet Provisioning Split
- **Authentication**: Handled via Privy (`@privy-io/react-auth` & `@privy-io/server-auth`), launch partner on Arc testnet.
- **Arc Custodial Wallets**: Idempotent provisioning on `ARC-TESTNET` via Circle Developer-Controlled Wallets API (`getOrCreateUserWallet()`).
