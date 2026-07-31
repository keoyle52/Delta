import { isAddress } from 'viem';

/**
 * Validates whether a string is a valid EVM address (with checksum verification support).
 */
export function isValidEvmAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return isAddress(address.trim());
}

/**
 * Validates whether a string is a valid Solana base58 wallet address (32-44 characters).
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  // Base58 character set: 1-9, A-H, J-N, P-Z, a-k, m-z (no 0, O, I, l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(trimmed);
}
