import * as dotenv from 'dotenv';
dotenv.config();

async function registerCircleWebhook() {
  console.log('===========================================================');
  console.log('REGISTERING CIRCLE WEBHOOK SUBSCRIPTION FOR PRODUCTION DOMAIN');
  console.log('===========================================================');

  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    console.error('❌ CIRCLE_API_KEY missing in .env');
    process.exit(1);
  }

  const endpointUrl = 'https://delta-omega-black.vercel.app/api/webhooks/circle';
  console.log('[1] Target Production Webhook Endpoint:', endpointUrl);

  try {
    const res = await fetch('https://api.circle.com/v1/notifications/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        endpoint: endpointUrl,
      }),
    });

    const body = await res.json();
    console.log('   Response Status:', res.status);
    console.log('   Response Body:', JSON.stringify(body, null, 2));

    if (res.status === 200 || res.status === 201) {
      console.log('✅ WEBHOOK SUBSCRIPTION REGISTERED SUCCESSFULLY!');
    }
  } catch (err: any) {
    console.error('❌ Error registering Circle Webhook Subscription:', err.message);
  }

  console.log('===========================================================');
}

registerCircleWebhook();
