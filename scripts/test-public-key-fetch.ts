import * as dotenv from 'dotenv';
dotenv.config();

async function testPublicKeyFetch() {
  const apiKey = process.env.CIRCLE_API_KEY || '';
  const keyId = process.argv[2] || 'a1b2c3d4-e5f6-7890-1234-567890abcdef';

  console.log('===========================================================');
  console.log('CIRCLE V2 NOTIFICATION PUBLIC KEY FETCH TEST');
  console.log('===========================================================');
  console.log(`[1] Target Key ID: ${keyId}`);
  console.log(`[2] API Key Configured: ${apiKey ? 'YES (' + apiKey.substring(0, 16) + '...)' : 'NO'}`);

  try {
    const res = await fetch(`https://api.circle.com/v2/notifications/publicKey/${keyId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    console.log('[3] HTTP Response Status:', res.status);
    const bodyText = await res.text();
    console.log('[4] Raw Response Body:\n', bodyText);
  } catch (err: any) {
    console.error('Fetch Error:', err.message || err);
  }
}

testPublicKeyFetch();
