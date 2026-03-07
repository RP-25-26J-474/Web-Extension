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

function buildVerificationUrl(token) {
  const baseUrl = process.env.EMAIL_VERIFICATION_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/api/auth/verify-email?token=${token}`;
}

async function sendVerificationEmail(email, verificationUrl) {
  const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_USER;

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
        <p>Thanks for registering with AURA!</p>
        <p>Please verify your email by clicking the link below:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link expires in ${VERIFICATION_EXPIRY_HOURS} hours.</p>
        <p>If you didn't create an account, you can ignore this email.</p>
      `
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
  sendVerificationEmail,
  VERIFICATION_EXPIRY_HOURS
};
