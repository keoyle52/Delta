import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

async function rotateEntitySecretConsole() {
  console.log('===========================================================');
  console.log('CIRCLE ENTITY SECRET ROTATION & CIPHERTEXT GENERATOR');
  console.log('===========================================================');

  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.error('❌ ERROR: CIRCLE_API_KEY missing in .env');
    process.exit(1);
  }

  // 1. Generate brand new random 32-byte (64 hex char) Entity Secret
  const newEntitySecretHex = crypto.randomBytes(32).toString('hex');

  console.log('✅ Generated Fresh Random 32-Byte Entity Secret (Hex):');
  console.log('   ', newEntitySecretHex);

  // 2. Fetch Circle's Public Key from API
  console.log('\n[1] Fetching Circle Public Key from API...');
  let publicKeyPem = '';
  try {
    const res = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Circle API returned status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    publicKeyPem = data?.data?.publicKey || data?.publicKey || '';
  } catch (err: any) {
    console.error('❌ Error fetching public key:', err.message);
    process.exit(1);
  }

  if (!publicKeyPem) {
    console.error('❌ Could not obtain Circle Public Key PEM');
    process.exit(1);
  }

  console.log('✅ Circle Public Key retrieved successfully!');

  // 3. Encrypt Entity Secret with RSA-OAEP (SHA-256)
  const entitySecretBuffer = Buffer.from(newEntitySecretHex, 'hex');
  const encryptedBuffer = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    entitySecretBuffer
  );

  const ciphertextBase64 = encryptedBuffer.toString('base64');

  // 4. Save recovery backup file to ./recovery/ (gitignored)
  const recoveryDir = path.join(__dirname, '../recovery');
  if (!fs.existsSync(recoveryDir)) {
    fs.mkdirSync(recoveryDir, { recursive: true });
  }

  const recoveryFile = path.join(recoveryDir, `rotated-entity-secret-${Date.now()}.json`);
  fs.writeFileSync(
    recoveryFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        entitySecretHex: newEntitySecretHex,
        ciphertextBase64,
        note: 'Keep this file secure and private. Gitignored.',
      },
      null,
      2
    )
  );

  console.log(`\n✅ Recovery backup file saved to: ${recoveryFile}`);

  // 5. Update local .env file
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (/^CIRCLE_ENTITY_SECRET=/m.test(envContent)) {
      envContent = envContent.replace(/^CIRCLE_ENTITY_SECRET=.*$/m, `CIRCLE_ENTITY_SECRET="${newEntitySecretHex}"`);
    } else {
      envContent += `\nCIRCLE_ENTITY_SECRET="${newEntitySecretHex}"\n`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated local .env with new CIRCLE_ENTITY_SECRET!');
  }

  console.log('\n===========================================================');
  console.log('1. RAW ENTITY SECRET (SET THIS FOR CIRCLE_ENTITY_SECRET IN VERCEL):');
  console.log('===========================================================');
  console.log(newEntitySecretHex);
  console.log('===========================================================');

  console.log('\n===========================================================');
  console.log('2. PASTE THIS CIPHERTEXT INTO CIRCLE DEVELOPER CONSOLE:');
  console.log('===========================================================');
  console.log(ciphertextBase64);
  console.log('===========================================================\n');
}

rotateEntitySecretConsole();
