import { createPublicKey, verify as cryptoVerify } from 'crypto';
import axios from 'axios';
import { logger } from '@/lib/logger';
import { getServerCircleCredentials, Network } from '@/config/network';

// In-memory cache for Circle public keys (Key ID -> { publicKeyPem/Der, expiresAt })
interface CachedKey {
  publicKeyDerBase64: string;
  expiresAt: number;
}

const publicKeyCache = new Map<string, CachedKey>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

/**
 * Dynamically fetches Circle's v2 Public Key by keyId with in-memory caching per network environment.
 * URL: https://api.circle.com/v2/notifications/publicKey/${keyId}
 */
export async function getCirclePublicKeyDer(keyId: string, network: Network = 'mainnet'): Promise<string> {
  const cacheKey = `${network}:${keyId}`;
  const cached = publicKeyCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    logger.debug(`[WEBHOOK ${network.toUpperCase()}] Using cached public key for keyId:`, keyId);
    return cached.publicKeyDerBase64;
  }

  const credentials = getServerCircleCredentials(network);

  try {
    const url = `https://api.circle.com/v2/notifications/publicKey/${keyId}`;
    logger.debug(`[WEBHOOK ${network.toUpperCase()}] Fetching Public Key from Circle v2 API: ${url}`);

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        Accept: 'application/json',
      },
      timeout: 5000,
    });

    logger.debug(`[WEBHOOK ${network.toUpperCase()}] Public Key Fetch Response Status:`, response.status);

    const publicKeyBase64 = response.data?.data?.publicKey || response.data?.publicKey;

    if (!publicKeyBase64 || typeof publicKeyBase64 !== 'string') {
      throw new Error(`Invalid or missing publicKey in response from Circle v2 API for keyId: ${keyId}`);
    }

    // Cache key for 1 hour
    publicKeyCache.set(cacheKey, {
      publicKeyDerBase64: publicKeyBase64,
      expiresAt: now + CACHE_TTL_MS,
    });

    return publicKeyBase64;
  } catch (error: any) {
    console.error(`[DEBUG WEBHOOK ${network.toUpperCase()}] Failed to fetch Circle notification public key (v2) for keyId ${keyId}:`, error.message || error);
    throw new Error(`Unable to fetch Circle v2 public key for keyId: ${keyId} on ${network}`);
  }
}

/**
 * Validates incoming Circle Webhook signature (X-Circle-Signature)
 * using dynamic ECDSA + SHA-256 signature verification on the RAW unparsed request body.
 */
export async function verifyCircleWebhookSignature({
  rawRequestBody,
  signatureHeader,
  keyIdHeader,
  network = 'mainnet',
}: {
  rawRequestBody: string;
  signatureHeader: string | null;
  keyIdHeader: string | null;
  network?: Network;
}): Promise<{ isValid: boolean; reason?: string }> {
  if (!signatureHeader || !keyIdHeader) {
    return { isValid: false, reason: 'Missing X-Circle-Signature or X-Circle-Key-Id header' };
  }

  if (!rawRequestBody || rawRequestBody.trim() === '') {
    return { isValid: false, reason: 'Empty raw request body' };
  }

  try {
    // 1. Fetch DER-encoded public key from Circle v2 API using network credentials
    const publicKeyBase64 = await getCirclePublicKeyDer(keyIdHeader, network);

    // 2. Parse DER SPKI key
    const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
    const publicKey = createPublicKey({
      key: publicKeyDer,
      format: 'der',
      type: 'spki',
    });

    // 3. Verify signature using ECDSA SHA-256 with DER DSA encoding on the raw unparsed request string
    const signatureBuffer = Buffer.from(signatureHeader, 'base64');
    const isValid = cryptoVerify(
      'sha256',
      Buffer.from(rawRequestBody, 'utf8'),
      {
        key: publicKey,
        dsaEncoding: 'der',
      },
      signatureBuffer
    );

    return { isValid };
  } catch (error: any) {
    return { isValid: false, reason: `ECDSA signature verification error on ${network}: ${error.message || error}` };
  }
}
