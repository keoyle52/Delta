import * as dotenv from 'dotenv';
dotenv.config();

async function checkStatus() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const res = await fetch('https://api.circle.com/v1/notifications/subscriptions', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json();
  console.log('Circle Subscription Current Status:');
  console.log(JSON.stringify(data, null, 2));
}

checkStatus();
