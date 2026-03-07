# AURA Authentication Setup

Email verification for the AURA Chrome extension. Users register with email/password and must verify their email before logging in.

## Email Verification Setup

### Development (no SMTP)

Without SMTP configured, verification links are **logged to the server console**. Copy the link and open it in a browser to verify.

### Testing SMTP in development

**Option A: Real emails** (simplest – use your real inbox)

Add your SMTP credentials to `server/.env` and register with your real email. Verification emails will be sent to your inbox.

Example with Gmail (use an [App Password](https://support.google.com/accounts/answer/185833), not your normal password):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="AURA Dev" <your-email@gmail.com>
```

Set `EMAIL_VERIFICATION_BASE_URL=http://localhost:3000` so the verification link points to your local server.

**Option B: Mailtrap** (sandbox – no real emails sent) (sandbox – no real emails sent)

1. Sign up at [mailtrap.io](https://mailtrap.io)
2. Create an inbox → copy SMTP credentials from the "Integrations" tab
3. Add to `server/.env`:

```
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-pass
SMTP_FROM="AURA Dev" <noreply@aura.local>
```

4. Start the server and register – emails appear in your Mailtrap inbox (click the link to verify)

**Option C: MailHog** (local, no signup)

Run MailHog in Docker to catch all outgoing mail locally:

```bash
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

Add to `server/.env`:

```
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="AURA Dev" <noreply@aura.local>
```

Open http://localhost:8025 to view captured emails.

### Production (SMTP)

Add to `server/.env`:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM="AURA Research" <noreply@yourdomain.com>
```

### Verification link base URL

```
EMAIL_VERIFICATION_BASE_URL=https://your-api.com
```

Or use `BASE_URL` if it matches your API base. The verification link will be:

`{BASE_URL}/api/auth/verify-email?token=...`

---

## Flow Summary

1. **Register** → User receives verification email (or link in console for dev)
2. **Verify** → User clicks link → email marked verified
3. **Login** → User can log in and proceed to consent → onboarding
