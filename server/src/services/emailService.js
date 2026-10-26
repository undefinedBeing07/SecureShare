import nodemailer from 'nodemailer';
import { config } from '../config.js';

/**
 * Check if email service is configured (Resend HTTPS API, Brevo HTTPS API, or SMTP)
 */
export function isEmailConfigured() {
  if (process.env.RESEND_API_KEY || process.env.BREVO_API_KEY) {
    return true;
  }
  return Boolean(
    config.smtp.host &&
    config.smtp.user &&
    config.smtp.pass
  );
}

/**
 * Return names of missing environment variables
 */
export function getMissingSmtpVariables() {
  if (process.env.RESEND_API_KEY || process.env.BREVO_API_KEY) {
    return [];
  }
  const missing = [];
  if (!config.smtp.host) missing.push('SMTP_HOST (or RESEND_API_KEY)');
  if (!config.smtp.user) missing.push('SMTP_USER');
  if (!config.smtp.pass) missing.push('SMTP_PASS');
  return missing;
}

let cachedTransporter = null;

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      pool: true, // Reuse SMTP connection pool for fast sub-second delivery
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return cachedTransporter;
}

/**
 * Send 6-digit OTP verification email to user
 */
export async function sendOtpEmail(toEmail, otp) {
  if (!isEmailConfigured()) {
    const missing = getMissingSmtpVariables();
    const error = new Error(
      `Email delivery service is not configured. Missing environment variable(s): ${missing.join(', ')}. Please configure them in server/.env.`
    );
    error.statusCode = 503;
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const mailOptions = {
    from: config.smtp.from || 'Secure Share <no-reply@secureshare.io>',
    to: toEmail,
    subject: 'Verify Your Email — Secure Share',
    text: `Welcome to Secure Share!\n\nYour 6-digit verification code is: ${otp}\n\nThis code will expire in 5 minutes.\nFor your security, do not share this code with anyone.\n\nSecure Share Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email — Secure Share</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 32px 16px;
      color: #0f172a;
    }
    .wrapper {
      max-width: 500px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
      padding: 28px 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .header p {
      color: #ede9fe;
      font-size: 12px;
      margin: 4px 0 0 0;
    }
    .body-content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 12px 0;
    }
    .lead-text {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 24px 0;
    }
    .otp-container {
      background-color: #f5f3ff;
      border: 1.5px dashed #c4b5fd;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 20px 0;
    }
    .otp-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #6d28d9;
      margin: 0;
    }
    .otp-expiry {
      font-size: 12px;
      color: #7c3aed;
      font-weight: 600;
      margin: 8px 0 0 0;
    }
    .security-notice {
      background-color: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 12px;
      line-height: 1.5;
      color: #92400e;
      margin: 24px 0 16px 0;
    }
    .security-notice strong {
      display: block;
      margin-bottom: 2px;
      color: #78350f;
    }
    .footer {
      border-top: 1px solid #f1f5f9;
      background-color: #faf5ff;
      padding: 18px 24px;
      font-size: 11px;
      color: #6b7280;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Secure Share</h1>
      <p>Zero-Trust File Storage & Distribution</p>
    </div>
    <div class="body-content">
      <h2 class="greeting">Verify Your Email Address</h2>
      <p class="lead-text">
        Welcome to Secure Share. To finalize your account registration and activate your zero-trust vault, please enter the one-time verification code below:
      </p>

      <div class="otp-container">
        <div class="otp-code">${otp}</div>
        <p class="otp-expiry">⏱ Valid for 5 minutes only</p>
      </div>

      <div class="security-notice">
        <strong>Security Warning:</strong> Never share this code with anyone. Secure Share support will never ask for your verification code.
      </div>

      <p class="lead-text" style="font-size: 12px; color: #94a3b8; margin: 0;">
        If you did not request this registration, no account has been created and you can safely ignore this email.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Secure Share Enterprise &bull; End-to-End Encrypted Cloud Storage
    </div>
  </div>
</body>
</html>`,
  };

  // Option 1: Send via Resend HTTPS API (bypasses Render SMTP port block)
  if (process.env.RESEND_API_KEY) {
    const rawFrom = process.env.EMAIL_FROM || 'Secure Share <onboarding@resend.dev>';
    const from = rawFrom.includes('onboarding@resend.dev') || !rawFrom.includes('@')
      ? 'Secure Share <onboarding@resend.dev>'
      : rawFrom;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: [toEmail],
          subject: mailOptions.subject,
          html: mailOptions.html,
          text: mailOptions.text
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`Resend email failed (${res.status}): ${errJson.message || res.statusText}`);
      }

      const resData = await res.json();
      console.log(`[Email] OTP successfully sent to ${toEmail} via Resend HTTPS API (id: ${resData.id})`);
      return resData;
    } catch (err) {
      console.error('[Email Error] Resend HTTPS delivery error:', err);
      throw err;
    }
  }

  // Option 2: Send via Brevo HTTPS API (bypasses Render SMTP port block)
  if (process.env.BREVO_API_KEY) {
    const senderEmail = config.smtp.user || 'shauryaraghuvanshi04@gmail.com';
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY.trim(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Secure Share', email: senderEmail },
          to: [{ email: toEmail }],
          subject: mailOptions.subject,
          htmlContent: mailOptions.html,
          textContent: mailOptions.text
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`Brevo email failed (${res.status}): ${errJson.message || res.statusText}`);
      }

      const resData = await res.json();
      console.log(`[Email] OTP successfully sent to ${toEmail} via Brevo HTTPS API`);
      return resData;
    } catch (err) {
      console.error('[Email Error] Brevo HTTPS delivery error:', err);
      throw err;
    }
  }

  // Option 3: Standard Nodemailer SMTP (works on local dev & paid cloud tiers)
  const transporter = getTransporter();
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] OTP successfully sent to ${toEmail} via SMTP`);
    return info;
  } catch (err) {
    const isTimeout = err.code === 'ETIMEDOUT' || err.code === 'ESOCKET' || err.message?.includes('timeout') || err.message?.includes('Greeting never received');
    if (isTimeout) {
      const helpfulError = new Error(
        'Email delivery timed out. On Render\'s Free tier, outbound SMTP ports (465/587) are blocked by Render\'s firewall. Please add RESEND_API_KEY in Render\'s Environment tab to send over HTTPS without restrictions.'
      );
      helpfulError.statusCode = 503;
      helpfulError.code = 'RENDER_SMTP_BLOCKED';
      throw helpfulError;
    }
    throw err;
  }
}
