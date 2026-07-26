import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Encrypt Entity Secret with a downloaded/pasted Circle Public Key PEM file
 */
function encryptWithPem() {
  const entitySecretHex = process.env.CIRCLE_ENTITY_SECRET || '99641183b6d3d5dd2f09295d48560fc9d071e73944fc2fb205ade1018ae1fae9';
  const pemFilePath = process.argv[2] || path.join(__dirname, '../public_key.pem');

  console.log('===========================================================');
  console.log('CIRCLE PEM ENTITY SECRET CIPHERTEXT GENERATOR');
  console.log('===========================================================');
  console.log('[1] Raw Entity Secret (Hex):', entitySecretHex);

  if (!fs.existsSync(pemFilePath)) {
    console.error(`\n❌ ERROR: Public key PEM file not found at: ${pemFilePath}`);
    console.log('\nPlease save your downloaded Circle Public Key PEM to:');
    console.log('c:\\Users\\Berat\\Desktop\\Delta\\public_key.pem');
    console.log('\nThen run: npx tsx scripts/encrypt-with-pem.ts');
    process.exit(1);
  }

  const publicKeyPem = fs.readFileSync(pemFilePath, 'utf8');
  console.log('[2] Loaded Public Key PEM from:', pemFilePath);

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
  console.log('GENERATED CIPHERTEXT (PASTE THIS INTO CIRCLE CONSOLE):');
  console.log('===========================================================');
  console.log(ciphertextBase64);
  console.log('===========================================================\n');
}

encryptWithPem();
