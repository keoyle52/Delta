import * as dotenv from 'dotenv';
dotenv.config();

async function checkCircleSubscriptions() {
  console.log('===========================================================');
  console.log('CIRCLE DEVELOPER CONSOLE WEBHOOK SUBSCRIPTION CHECK');
  console.log('===========================================================');

  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    console.error('❌ CIRCLE_API_KEY missing in .env');
    process.exit(1);
  }

  const endpoints = [
    'https://api.circle.com/v1/w3s/developer/subscriptions',
    'https://api.circle.com/v1/notifications/subscriptions',
    'https://api.circle.com/v1/w3s/subscriptions',
  ];

  for (const ep of endpoints) {
    console.log(`\nTesting Endpoint: ${ep}`);
    try {
      const res = await fetch(ep, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const body = await res.json();
      console.log('   Response Status:', res.status);
      console.log('   Response Body:', JSON.stringify(body, null, 2));
    } catch (err: any) {
      console.error('   ❌ Error:', err.message);
    }
  }

  console.log('===========================================================');
}

checkCircleSubscriptions();
