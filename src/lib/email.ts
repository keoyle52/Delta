/**
 * Resend Email Dispatcher
 */

export async function sendResendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  // Standard free tier Resend domain must be onboarding@resend.dev unless custom domain is verified
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  if (!apiKey || apiKey.trim() === '') {
    console.warn('RESEND_API_KEY is not configured; skipping email dispatch.');
    return null;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();
    if (res.ok && data.id) {
      console.log(`✉️ Resend Email Successfully Delivered to ${to}: ID=${data.id}`);
    } else {
      console.warn(`⚠️ Resend Email Warning for ${to}:`, JSON.stringify(data));
    }
    return data;
  } catch (err: any) {
    console.error('Failed to send Resend email:', err.message || err);
    return null;
  }
}

/**
 * Send OTP Verification Code Email for Passwordless Login
 */
export async function sendOtpEmail({ to, code }: { to: string; code: string }) {
  console.log(`🔑 [SECURITY OTP LOG] Verification Code for ${to} is: ${code}`);

  const subject = `[Delta] Your Login Verification Code: ${code}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #090d16; color: #f8fafc; padding: 40px 20px; border-radius: 16px; max-width: 500px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 24px; font-weight: 800;">Delta Automation</h1>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Arc Testnet Visual Node Automation</p>
      </div>

      <div style="background-color: #1e293b; border: 1px solid #334155; padding: 24px; border-radius: 12px; text-align: center;">
        <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 16px;">Use the verification code below to sign in to your Delta account:</p>
        <div style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #38bdf8; background-color: #0f172a; padding: 16px; border-radius: 8px; border: 1px border-indigo-500;">
          ${code}
        </div>
        <p style="color: #64748b; font-size: 12px; margin-top: 16px;">This code will expire in 10 minutes. Do not share it with anyone.</p>
      </div>

      <div style="text-align: center; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px;">
        <p style="color: #64748b; font-size: 11px;">Built on Arc Testnet (#5042002) • Circle App Kit Integration</p>
      </div>
    </div>
  `;

  return await sendResendEmail({ to, subject, html });
}

/**
 * Send Execution Status Notification Email when Workflow Runs
 */
export async function sendExecutionNotificationEmail({
  to,
  workflowName,
  status,
  triggerAmount,
  stepLogs,
}: {
  to: string;
  workflowName: string;
  status: 'COMPLETE' | 'FAILED';
  triggerAmount: string;
  stepLogs: any[];
}) {
  const isSuccess = status === 'COMPLETE';
  const statusColor = isSuccess ? '#10b981' : '#ef4444';
  const statusBadge = isSuccess ? '✅ SUCCESSFUL' : '⚠️ FAILED';

  const subject = `[Delta Alert] Workflow "${workflowName}" ${statusBadge}`;

  const stepsHtml = stepLogs
    .map(
      (log) => `
      <tr style="border-bottom: 1px solid #334155;">
        <td style="padding: 10px; font-size: 13px; font-weight: 600; color: #f1f5f9;">${log.nodeName || log.nodeType}</td>
        <td style="padding: 10px; font-size: 12px; color: ${log.status === 'COMPLETE' ? '#34d399' : '#f87171'}; font-weight: bold;">${log.status}</td>
        <td style="padding: 10px; font-size: 12px; color: #94a3b8; font-family: monospace;">${log.details || log.error || '-'}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #090d16; color: #f8fafc; padding: 40px 20px; border-radius: 16px; max-width: 600px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; pb-16px; margin-bottom: 24px;">
        <h2 style="color: #6366f1; margin: 0; font-size: 20px; font-weight: 800;">Delta Execution Report</h2>
        <span style="background-color: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase;">
          ${statusBadge}
        </span>
      </div>

      <div style="background-color: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #94a3b8; font-size: 12px; padding: 4px 0;">Workflow Name:</td>
            <td style="color: #ffffff; font-size: 14px; font-weight: bold; text-align: right;">${workflowName}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8; font-size: 12px; padding: 4px 0;">Trigger Amount:</td>
            <td style="color: #38bdf8; font-size: 14px; font-weight: bold; font-family: monospace; text-align: right;">${triggerAmount} USDC</td>
          </tr>
        </table>
      </div>

      <h4 style="color: #cbd5e1; font-size: 14px; margin-bottom: 12px;">Step Execution Summary:</h4>
      <table style="width: 100%; border-collapse: collapse; background-color: #0f172a; border-radius: 8px; overflow: hidden; border: 1px solid #1e293b;">
        <thead>
          <tr style="background-color: #1e293b; text-align: left;">
            <th style="padding: 8px 10px; font-size: 11px; color: #94a3b8;">Node</th>
            <th style="padding: 8px 10px; font-size: 11px; color: #94a3b8;">Status</th>
            <th style="padding: 8px 10px; font-size: 11px; color: #94a3b8;">Details</th>
          </tr>
        </thead>
        <tbody>
          ${stepsHtml}
        </tbody>
      </table>

      <div style="text-align: center; margin-top: 32px; pt-16px; border-top: 1px solid #1e293b;">
        <p style="color: #64748b; font-size: 11px;">Powered by Circle App Kit & Arc Testnet (#5042002)</p>
      </div>
    </div>
  `;

  return await sendResendEmail({ to, subject, html });
}
