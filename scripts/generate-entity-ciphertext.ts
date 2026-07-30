import crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Circle Entity Secret Ciphertext Generator
 *
 * Encrypts a 32-byte (64 hex char) Entity Secret with Circle's Public Key using RSA-OAEP (SHA-256).
 * Outputs the exact Base64 Ciphertext required by Circle Developer Console.
 */
async function generateEntitySecretCiphertext() {
  const entitySecretHex = process.env.CIRCLE_ENTITY_SECRET || '';
  const apiKey = process.env.CIRCLE_API_KEY || '';

  console.log('===========================================================');
  console.log('CIRCLE ENTITY SECRET CIPHERTEXT GENERATOR');
  console.log('===========================================================');
  console.log('[1] Raw Entity Secret (Hex):', entitySecretHex);

  if (entitySecretHex.length !== 64) {
    console.error('ERROR: Entity Secret must be exactly 64 hex characters (32 bytes).');
    process.exit(1);
  }

  let publicKeyPem = '';

  // Try fetching Circle's Public Key automatically via API
  if (apiKey) {
    try {
      console.log('[2] Fetching Circle Public Key from API...');
      const res = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        publicKeyPem = data?.data?.publicKey || data?.publicKey || '';
      }
    } catch (err: any) {
      console.warn('Could not fetch public key automatically:', err.message);
    }
  }

  // Fallback public key template instruction if API requires manual PEM
  if (!publicKeyPem) {
    console.log('\n-----------------------------------------------------------');
    console.log('INSTRUCTIONS TO ENCRYPT WITH CIRCLE PUBLIC KEY:');
    console.log('-----------------------------------------------------------');
    console.log('1. Go to Circle Developer Console -> Config / Register Entity Secret');
    console.log('2. Download or copy Circle Public Key (PEM format)');
    console.log('3. Run this command with your downloaded public key path:');
    console.log('   npx tsx scripts/generate-entity-ciphertext.ts ./circle-public-key.pem');
    console.log('-----------------------------------------------------------\n');
    return;
  }

  console.log('[3] Circle Public Key retrieved successfully!');

  // Perform RSA-OAEP Encryption with SHA-256
  const entitySecretBuffer = Buffer.from(entitySecretHex, 'hex');
  const encryptedBuffer = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    entitySecretBuffer
  );

  const ciphertextBase64 = encryptedBuffer.toString('base64');

  console.log('\n===========================================================');
  console.log('PASTE THIS ENCRYPTED CIPHERTEXT INTO CIRCLE CONSOLE:');
  console.log('===========================================================');
  console.log(ciphertextBase64);
  console.log('===========================================================\n');
}

generateEntitySecretCiphertext();
