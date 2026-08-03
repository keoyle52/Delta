/**
 * Arc Platform Performance & Fee Advantage Constants
 * Official source citations from Arc documentation (https://docs.arc.io)
 */

// Source: https://docs.arc.io/arc/references/gas-and-fees.md
export const ARC_TARGET_FEE_USD = 0.01; // "Base fee target ~$0.01 per transaction" under normal load

// Typical multi-step (swap + bridge + send equivalent) cost on a general-purpose L1
// during moderate network congestion. Conservative, publicly documented range used for comparison.
export const TYPICAL_L1_MULTISTEP_FEE_USD = 4.50; // conservative mid-range estimate for 3 chained on-chain actions

// Standard CCTP attestation + finality wait time on most non-Arc EVM chains
// Source: Circle CCTP documentation — standard transfer attestation window
export const TYPICAL_CROSSCHAIN_WAIT_SECONDS = 900; // ~15 minutes, standard (non-Fast) CCTP transfer
