# Slack Integration Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables
Ensure all required environment variables are set in your production environment (Railway):

```bash
# Required for Slack Integration
SLACK_CLIENT_ID=your_client_id
SLACK_CLIENT_SECRET=your_client_secret
SLACK_SIGNING_SECRET=your_signing_secret  # 32-character hex string from Slack app settings
SLACK_BOT_TOKEN=xoxb-your-bot-token      # Starts with xoxb-

# Core Requirements
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

### 2. Verify Environment Variables
Run this command locally to check your .env file:
```bash
node src/utils/checkProduction.js
```

### 3. Slack App Configuration
In your Slack App settings (api.slack.com):

1. **OAuth & Permissions**:
   - Redirect URL: `https://your-backend-url.railway.app/api/slack/oauth/callback`
   - Bot Token Scopes:
     - `chat:write`
     - `commands`
     - `users:read`
     - `im:write`

2. **Interactivity & Shortcuts**:
   - Request URL: `https://your-backend-url.railway.app/api/slack/interactions`
   - Enable Interactivity: ON

3. **Slash Commands**:
   - `/quick-checkin` → `https://your-backend-url.railway.app/api/slack/commands`
   - `/wellness-survey` → `https://your-backend-url.railway.app/api/slack/commands`

4. **Event Subscriptions** (if using events):
   - Request URL: `https://your-backend-url.railway.app/api/slack/events`
   - Subscribe to bot events: `app_mention`, `message.im`

### 4. Test Endpoints

After deployment, test these endpoints:

```bash
# Health check
curl https://your-backend-url.railway.app/health

# Slack test endpoint
curl https://your-backend-url.railway.app/api/slack/test
```

## Common Issues and Solutions

### Issue 1: Signature Verification Failed
**Symptoms**: "dispatch_failed" error in Slack, 401 responses

**Solutions**:
1. Ensure `SLACK_SIGNING_SECRET` is correctly set in production
2. Check that the signing secret is from the correct Slack app
3. Verify the request isn't older than 5 minutes

### Issue 2: Email Service Connection Failed
**Symptoms**: Warning messages about email service

**Solutions**:
1. Email is optional - the service will work without it
2. If needed, set `EMAIL_USER` and `EMAIL_PASS` environment variables
3. For Gmail, use app-specific password, not regular password

### Issue 3: Commands Not Working
**Symptoms**: Commands show as "failed" in Slack

**Solutions**:
1. Check Railway logs for detailed error messages
2. Verify all Slack URLs in app settings point to correct Railway URL
3. Ensure MongoDB is accessible from Railway

## Testing in Production

1. **Test Slack Commands**:
   ```
   /quick-checkin
   /wellness-survey
   ```

2. **Monitor Logs**:
   ```bash
   railway logs
   ```

3. **Check MongoDB Connection**:
   - Verify users can be found in database
   - Check if check-ins are being created

## Security Notes

1. Never commit `.env` file to git
2. Use Railway's environment variable UI to set sensitive values
3. Regularly rotate your Slack signing secret
4. Monitor for unusual activity in logs

## Support

If issues persist:
1. Check Railway deployment logs
2. Verify Slack app configuration
3. Test with the debug endpoint: `/api/slack-debug/test-signature`