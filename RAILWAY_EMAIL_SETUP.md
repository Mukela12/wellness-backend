# Email Setup for Railway Deployment

## Current Issue
Railway is timing out when connecting to Gmail SMTP. This is a common issue due to network restrictions.

## Solutions to Try

### 1. Use Port 465 with SSL/TLS
Add these environment variables in Railway:
```
EMAIL_PORT=465
EMAIL_SECURE=true
```

### 2. Increase Timeouts (Already implemented)
The code now uses longer timeouts specifically for Railway.

### 3. Alternative: Use SendGrid (Free tier available)
If Gmail continues to fail, consider using SendGrid:

1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Get API key
3. Update environment variables:
   ```
   SENDGRID_API_KEY=your_api_key
   EMAIL_FROM=your-verified-sender@domain.com
   ```

### 4. Alternative: Use Resend (Simple & Railway-friendly)
1. Sign up at https://resend.com (free tier: 3,000 emails/month)
2. Get API key
3. Very simple integration

### 5. Debug on Railway
Add this environment variable to see more details:
```
NODE_ENV=development
```

## Testing Email on Railway

1. Deploy your app
2. Check logs: `railway logs`
3. If still failing, try port 465
4. If port 465 fails, consider using an email API service

## Quick Fix for Gmail

Try these environment variables on Railway:
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
RAILWAY_ENVIRONMENT=production
```

## Network Debugging

You can SSH into Railway and run:
```bash
railway run node diagnose-email.js
```

This will show which ports are accessible from Railway's network.