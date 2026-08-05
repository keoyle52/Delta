/**
 * Arc Performance Benchmarks & Comparison Standards
 *
 * Arc delivers sub-second finality with USDC-native gas fees.
 * Constants below define conservative benchmarks for typical general-purpose Layer-1 networks
 * and Circle CCTP attestation windows for cost and speed comparison.
 *
 * Primary Reference: Arc Official Documentation (https://docs.arc.network)
 */

// Published Arc target base fee in USD ($0.01 per transaction)
export const ARC_TARGET_FEE_USD = 0.01;

// Typical wait time comparison, per node type (seconds) — general-purpose L1 confirmation/attestation windows
export const TYPICAL_WAIT_SECONDS: Record<string, number> = {
  bridge: 900,  // ~15 min standard cross-chain attestation window — Circle CCTP documentation
  swap: 15,     // typical multi-confirmation DEX swap wait on a general-purpose L1
  send: 60,     // typical simple transfer confirmation wait on a general-purpose L1
};

// Typical gas cost comparison, per node type (USD) — conservative, general-purpose L1 estimates
export const TYPICAL_FEE_USD: Record<string, number> = {
  bridge: 3.50,
  swap: 2.00,
  send: 1.00,
};

// General multi-step fallbacks
export const TYPICAL_L1_MULTISTEP_FEE_USD = 4.50;
export const TYPICAL_CROSSCHAIN_WAIT_SECONDS = 900;

