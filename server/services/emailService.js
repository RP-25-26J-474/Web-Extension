/**
 * Email service for sending verification emails.
 * Without SMTP config: logs verification links to console for development.
 */
const crypto = require('crypto');

const VERIFICATION_EXPIRY_HOURS = 24;

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getVerificationExpiry() {
  const expires = new Date();
  expires.setHours(expires.getHours() + VERIFICATION_EXPIRY_HOURS);
  return expires;
}

function getBaseUrl() {
  return (process.env.EMAIL_VERIFICATION_BASE_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function buildVerificationUrl(token) {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/api/auth/verify-email?token=${token}`;
}

async function sendVerificationEmail(email, verificationUrl) {
  const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_USER;
  const baseUrl = getBaseUrl();
  const logoUrl = `${baseUrl}/logo.png`;

  if (hasSmtp) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const from = process.env.SMTP_FROM || '"AURA Research" <noreply@aura.example.com>';
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Verify your AURA account',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.06)">
    <div style="text-align:center;margin-bottom:24px">
      <img src="${logoUrl}" alt="AURA" style="height:48px;width:auto" onerror="this.style.display='none'">
    </div>
    <h1 style="font-size:1.5rem;color:#1e293b;margin:0 0 16px;text-align:center">Verify your AURA account</h1>
    <p style="color:#475569;line-height:1.6;margin:0 0 20px">Thanks for registering with AURA! Please verify your email by clicking the button below.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${verificationUrl}" style="display:inline-block;background:linear-gradient(135deg,#8BC53F,#A8D665);color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;box-shadow:0 2px 8px rgba(139,197,63,0.3)">Verify Email</a>
    </p>
    <p style="font-size:0.875rem;color:#64748b;line-height:1.5">This link expires in ${VERIFICATION_EXPIRY_HOURS} hours. If you didn't create an account, you can ignore this email.</p>
  </div>
</body>
</html>`
    });
  } else {
    console.log('\n========== EMAIL VERIFICATION (dev - no SMTP) ==========');
    console.log(`To: ${email}`);
    console.log(`Verification link: ${verificationUrl}`);
    console.log('Copy this link and open it in a browser to verify.\n');
  }
}

module.exports = {
  generateVerificationToken,
  getVerificationExpiry,
  buildVerificationUrl,
  getBaseUrl,
  sendVerificationEmail,
  VERIFICATION_EXPIRY_HOURS
};
