import * as dotenv from 'dotenv';
dotenv.config();

async function checkInngestEnvAndSync() {
  console.log('===========================================================');
  console.log('CHECKING INNGEST ENVIRONMENT & PRODUCTION SYNC STATUS');
  console.log('===========================================================');

  const signingKey = process.env.INNGEST_SIGNING_KEY;
  const eventKey = process.env.INNGEST_EVENT_KEY;

  console.log('[1] Local Environment Variables:');
  console.log('   INNGEST_SIGNING_KEY:', signingKey ? `${signingKey.substring(0, 15)}... (len: ${signingKey.length})` : '❌ NOT SET');
  console.log('   INNGEST_EVENT_KEY:', eventKey ? `${eventKey.substring(0, 15)}... (len: ${eventKey.length})` : '❌ NOT SET');

  const prodDomain = 'https://delta-omega-black.vercel.app';
  console.log(`\n[2] Triggering Inngest Endpoint Sync PUT Request to: ${prodDomain}/api/inngest ...`);

  try {
    const res = await fetch(`${prodDomain}/api/inngest`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const body = await res.text();
    console.log('   Response Status:', res.status);
    console.log('   Response Body:', body);
  } catch (err: any) {
    console.error('   ❌ Error contacting Inngest endpoint:', err.message);
  }

  // Also query GET on /api/inngest
  console.log(`\n[3] Triggering Inngest Endpoint GET Request to: ${prodDomain}/api/inngest ...`);
  try {
    const resGet = await fetch(`${prodDomain}/api/inngest`, {
      method: 'GET',
    });
    const bodyGet = await resGet.text();
    console.log('   Response Status:', resGet.status);
    console.log('   Response Body:', bodyGet);
  } catch (err: any) {
    console.error('   ❌ Error querying GET /api/inngest:', err.message);
  }

  console.log('===========================================================');
}

checkInngestEnvAndSync();
