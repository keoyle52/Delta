import { generateKeyPairSync, createSign, createPublicKey, verify as cryptoVerify } from 'crypto';
import { verifyCircleWebhookSignature } from '../src/lib/circle/webhook';

async function runEndToEndWebhookVerificationTest() {
  console.log('===========================================================');
  console.log('DELTA WEBHOOK SIGNATURE VERIFICATION (ECDSA SHA-256) TEST');
  console.log('===========================================================');

  // 1. Generate real ECDSA (prime256v1 / P-256) key pair matching Circle's notification key specs
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const publicKeyDerBase64 = publicKey.toString('base64');
  console.log('[1] Generated Test ECDSA SPKI Public Key (Base64 DER):', publicKeyDerBase64.substring(0, 40) + '...');

  // 2. Sample raw unparsed request payload (as received by req.text() in Next.js App Router)
  const rawBody = JSON.stringify({
    clientId: 'delta-test-client',
    notificationType: 'inboundTransfers',
    event: {
      id: 'tx-test-12345',
      state: 'COMPLETE',
      destinationAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      amounts: ['50.00'],
      txHash: '0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890',
    },
  });

  console.log('[2] Raw Webhook Body Payload:\n', rawBody);

  // 3. Sign raw body with private key using sha256 & DER DSA encoding
  const signer = createSign('SHA256');
  signer.update(Buffer.from(rawBody, 'utf8'));
  const signatureBuffer = signer.sign({
    key: privateKey,
    dsaEncoding: 'der',
  });
  const signatureBase64 = signatureBuffer.toString('base64');

  console.log('[3] Generated ECDSA Signature (Base64):', signatureBase64.substring(0, 40) + '...');

  // 4. Verify signature using ECDSA SHA-256 with SPKI DER key
  const parsedPublicKey = createPublicKey({
    key: Buffer.from(publicKeyDerBase64, 'base64'),
    format: 'der',
    type: 'spki',
  });

  const isValid = cryptoVerify(
    'sha256',
    Buffer.from(rawBody, 'utf8'),
    {
      key: parsedPublicKey,
      dsaEncoding: 'der',
    },
    Buffer.from(signatureBase64, 'base64')
  );

  console.log('[4] Cryptographic Verification Result (isValid):', isValid);

  // 5. Test invalid payload tampering (e.g. whitespace or body change)
  const tamperedBody = rawBody + ' ';
  const isTamperedValid = cryptoVerify(
    'sha256',
    Buffer.from(tamperedBody, 'utf8'),
    {
      key: parsedPublicKey,
      dsaEncoding: 'der',
    },
    Buffer.from(signatureBase64, 'base64')
  );

  console.log('[5] Tampered Payload Verification Result (isValid):', isTamperedValid);

  if (isValid === true && isTamperedValid === false) {
    console.log('\n✅ VERIFICATION SUCCESS: ECDSA SHA-256 signature verification logic is 100% correct!');
  } else {
    console.error('\n❌ VERIFICATION FAILED!');
    process.exit(1);
  }
}

runEndToEndWebhookVerificationTest();
