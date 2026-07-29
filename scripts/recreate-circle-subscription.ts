import * as dotenv from 'dotenv';
dotenv.config();

async function testDeleteSubscription() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const subId = '07dde0fa-b0ff-4e2b-a71f-4bfae48ae0bb';

  console.log('Testing Delete Methods for Circle Notification Subscription:');

  // Method A: DELETE with id query param
  try {
    const resA = await fetch(`https://api.circle.com/v1/notifications/subscriptions?id=${subId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const bodyA = await resA.json();
    console.log('Method A (query param) Status:', resA.status, 'Body:', JSON.stringify(bodyA));
  } catch (e: any) {
    console.log('Method A Error:', e.message);
  }

  // Method B: DELETE with id in path
  try {
    const resB = await fetch(`https://api.circle.com/v1/notifications/subscriptions/${subId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const bodyB = await resB.json();
    console.log('Method B (path param) Status:', resB.status, 'Body:', JSON.stringify(bodyB));
  } catch (e: any) {
    console.log('Method B Error:', e.message);
  }

  // Method C: DELETE with JSON body
  try {
    const resC = await fetch(`https://api.circle.com/v1/notifications/subscriptions`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ id: subId }),
    });
    const bodyC = await resC.json();
    console.log('Method C (JSON body) Status:', resC.status, 'Body:', JSON.stringify(bodyC));
  } catch (e: any) {
    console.log('Method C Error:', e.message);
  }
}

testDeleteSubscription();
