# Security Policy

Delta is a non-custodial and developer-controlled financial application operating on **Arc Mainnet** (Chain ID: `5042002`), facilitating real native USDC and EURC transactions, swaps, and cross-chain transfers via Circle CCTP. Because Delta handles real funds, security is our highest priority.

---

## Supported Scope

The following components are within the security scope:

| Component | Status | Scope / Description |
| :--- | :--- | :--- |
| **Delta Web Application** | Supported | Production deployment at [delta-omega-black.vercel.app](https://delta-omega-black.vercel.app) |
| **API Endpoints** | Supported | All Next.js route handlers under `/api/*` |
| **Arc Mainnet Integration** | Supported | RPC integration (`https://rpc.arc.network`), Chain ID `5042002`, gas settings (18 decimals native USDC) |
| **Circle App Kit & Wallets** | Supported | Developer-controlled and user-controlled wallet integrations via Circle SDK |
| **Smart Contract Interaction** | Supported | CCTP TokenMessenger, USDC, and EURC contract calls on Arc Mainnet |

### Out of Scope
- Testnet environments (Arc Testnet `5042001`) unless the issue directly impacts Mainnet security.
- Vulnerabilities in third-party RPC providers, Infura/Alchemy nodes, or external blockchain networks outside Delta's control.
- Denial of Service (DoS) attacks targeting third-party cloud infrastructure (e.g., Vercel, Neon, Circle API) without a Delta-specific exploit.
- Social engineering, phishing attacks targeting end-users, or attacks requiring physical access to a user's device.

---

## Reporting a Vulnerability

If you discover a security vulnerability within Delta, please report it responsibly:

1. **GitHub Private Vulnerability Reporting (Preferred)**:
   Navigate to [Security Advisories](https://github.com/keoyle52/delta/security/advisories/new) on the repository and submit a confidential advisory report.
2. **Direct Contact**:
   Contact the repository maintainer directly:
   - GitHub: [@keoyle52](https://github.com/keoyle52)
   - Email: `berat@delta.app`

> [!WARNING]
> **Do NOT submit security vulnerabilities via public GitHub issues or public pull requests.**

### What to Include in Your Report
- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions to reproduce the issue (proof-of-concept script, curl commands, or transaction payloads).
- Affected files, endpoints, or contracts.
- Any suggested remediation or mitigation.

---

## Response Timeline & SLAs

- **Initial Acknowledgment**: Within **72 hours** of receiving your report.
- **Triage & Impact Assessment**: Within **5 business days**.
- **Remediation & Patch Deployment**: Depending on severity, critical vulnerabilities will be patched immediately upon verification.
- **Public Disclosure**: Coordinated disclosure will occur only after the fix has been successfully deployed and verified on Arc Mainnet.

---

## Existing Security Controls

Delta implements defensive controls across all layers of the application:

1. **Network Isolation & Chain Verification**:
   - Strict chain ID validation (`5042002` for Arc Mainnet).
   - Dynamic network configuration (`src/config/network.ts`) ensuring production environments never route funds or transactions to testnet endpoints or contract addresses.
2. **Transaction Idempotency**:
   - Every financial transaction and wallet execution utilizes cryptographic idempotency keys (`src/lib/idempotency.ts`) to prevent replay attacks and duplicate transfers.
3. **Rate Limiting & Abuse Protection**:
   - Rate limiting enforced on all sensitive API routes (e.g., transfer initiation, balance queries, webhook endpoints) to protect against brute-force and resource-exhaustion attacks (`src/lib/rate-limit.ts`).
4. **Webhook Signature Verification**:
   - All incoming webhooks from Circle are cryptographically validated against Circle's public keys before processing (`src/app/api/webhooks/circle/route.ts`). Requests with invalid or missing signatures are rejected immediately.
5. **Key Management & Non-Custodial Architecture**:
   - Delta servers never store user private keys or seed phrases.
   - Authentication and transaction signing leverage Privy embedded wallets and Circle Developer-Controlled Wallets running in secure hardware enclaves.
6. **Automated Security Scanning**:
   - Continuous dependency auditing via `npm audit` and `osv-scanner`.
   - Secret scanning via `gitleaks` and `trufflehog`.
   - Static application security testing (SAST) via GitHub CodeQL.
