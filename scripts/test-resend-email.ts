import * as dotenv from 'dotenv';
dotenv.config();

async function testResendCustom() {
  const apiKey = process.env.RESEND_API_KEY;
  console.log('Testing with custom from address...');

  const res1 = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Delta <onboarding@shuselipel.resend.app>',
      to: ['keoyle52@gmail.com'],
      subject: '[Delta Test] Custom Domain Test',
      html: '<p>Testing Resend Custom Domain</p>',
    }),
  });

  const data1 = await res1.json();
  console.log('Result 1 (shuselipel.resend.app):', JSON.stringify(data1, null, 2));

  const res2 = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: ['keoyle52@gmail.com'],
      subject: '[Delta Test] onboarding@resend.dev Test',
      html: '<p>Testing Resend default domain</p>',
    }),
  });

  const data2 = await res2.json();
  console.log('Result 2 (resend.dev):', JSON.stringify(data2, null, 2));
}

testResendCustom();
