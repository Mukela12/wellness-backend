# Email Service Configuration Guide

## Overview

The wellness platform's email service is **optional**. The system will work without email configuration, but certain features like password reset and email notifications will be disabled.

## Configuration Options

### 1. Development Mode (No Email)

For local development and testing, you can run without email configuration:

```env
# No email configuration needed - service will skip email operations
```

The system will:
- ✅ Allow user registration without sending emails
- ✅ Skip email verification (if `REQUIRE_EMAIL_VERIFICATION` is not set)
- ✅ Log email operations to console instead
- ⚠️ Password reset will not work without email

### 2. Development Mode (With Email Verification)

To test email verification flow in development:

```env
# Email service (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
EMAIL_FROM="Wellness Dev <noreply@wellness.dev>"

# Require email verification for login
REQUIRE_EMAIL_VERIFICATION=true
```

### 3. Production Mode

For production, configure a reliable email service:

```env
# Email service configuration
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key
EMAIL_FROM="Wellness Platform <noreply@your-domain.com>"

# Require email verification in production
REQUIRE_EMAIL_VERIFICATION=true
```

## Email Service Providers

### Gmail (Development Only)
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password  # Not your regular password!
```

**Note**: Use [App-specific passwords](https://support.google.com/accounts/answer/185833) for Gmail.

### SendGrid (Recommended for Production)
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=SG.your-api-key-here
```

### Amazon SES
```env
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-smtp-username
EMAIL_PASS=your-smtp-password
```

### Mailgun
```env
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=postmaster@your-domain.mailgun.org
EMAIL_PASS=your-mailgun-password
```

## Features Affected by Email Configuration

| Feature | Email Required | Fallback Behavior |
|---------|---------------|-------------------|
| User Registration | No | Registration succeeds, no welcome email sent |
| Email Verification | No | Can be disabled with `REQUIRE_EMAIL_VERIFICATION=false` |
| Password Reset | **Yes** | Feature unavailable without email |
| Check-in Reminders | No | No email reminders sent |
| Survey Notifications | No | Use Slack or in-app notifications |
| Welcome Emails | No | Skipped if email not configured |

## Troubleshooting

### Connection Timeout Errors

If you see "Connection timeout" errors:

1. **Check firewall/network settings** - Ensure outbound SMTP ports are open
2. **Verify credentials** - Double-check username/password
3. **Try different port** - Some networks block port 25/587
4. **Increase timeout** - Already configured to 10 seconds in the code

### Gmail Specific Issues

1. **Enable 2-factor authentication** on your Google account
2. **Generate app-specific password**: 
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Security → 2-Step Verification → App passwords
3. **Allow less secure apps** (not recommended for production)

### Testing Email Configuration

Run this command to test your email configuration:

```bash
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
transporter.verify().then(() => console.log('✅ Email configuration is valid'))
  .catch(err => console.error('❌ Email configuration error:', err.message));
"
```

## Best Practices

1. **Development**: Run without email or use a test email service like [Mailtrap](https://mailtrap.io/)
2. **Staging**: Use the same email provider as production with test addresses
3. **Production**: Use a reliable transactional email service (SendGrid, AWS SES, etc.)
4. **Security**: Never commit email credentials to git - use environment variables
5. **Monitoring**: Set up email delivery monitoring and bounce handling

## Default Behavior

When email is not configured:
- The service logs `"⚠️ Email service not configured - skipping connection verification"`
- All email operations return `{ skipped: true }` instead of throwing errors
- The application continues to function normally
- Users can still register and use the platform

This design ensures the platform remains functional even without email configuration, making it easier to develop and test locally.