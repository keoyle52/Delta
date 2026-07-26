import { generateKeyPairSync, createPublicKey } from 'crypto';

function testBufferEncodingAndPublicKey() {
  console.log('Testing Buffer.from and createPublicKey runtime execution...');

  // Generate an EC key pair
  const { publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
  });

  const publicKeyBase64 = publicKey.toString('base64');
  console.log('PublicKey Base64:', publicKeyBase64.substring(0, 30) + '...');

  // Test Buffer.from with 'base64' (NOT 'der')
  const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
  console.log('Buffer.from(base64) byte length:', publicKeyDer.length);

  // Test createPublicKey with format: 'der'
  const keyObj = createPublicKey({
    key: publicKeyDer,
    format: 'der',
    type: 'spki',
  });

  console.log('createPublicKey successful! Key type:', keyObj.type, 'AsymmetricKeyType:', keyObj.asymmetricKeyType);
  console.log('✅ Buffer encoding and Key creation test PASSED with 0 errors!');
}

testBufferEncodingAndPublicKey();
