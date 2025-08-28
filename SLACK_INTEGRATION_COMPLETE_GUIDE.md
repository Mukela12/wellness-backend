# Slack Integration Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [User Setup Guide](#user-setup-guide)
4. [Admin/HR Guide](#adminhr-guide)
5. [Technical Details](#technical-details)
6. [Slack Commands](#slack-commands)
7. [Survey Distribution](#survey-distribution)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Overview

The Wellness Platform Slack integration allows employees to receive and respond to wellness surveys and check-ins directly through Slack, making it easier to maintain engagement with wellness initiatives without leaving their primary communication tool.

### Key Features
- 📋 Receive surveys as interactive Slack messages
- ⚡ Quick mood check-ins with single button clicks
- 🎯 Automated reminders for pending surveys
- 💎 Earn Happy Coins for completed surveys
- 🔥 Track wellness streaks
- 📊 Real-time response tracking

### Important Limitations
- **Same Workspace Required**: The Slack integration only works for users who are members of the same Slack workspace where the Wellness app is installed
- **Cannot Send to External Users**: The system cannot send surveys to people outside your organization's Slack workspace
- **User Connection Required**: Each employee must connect their Slack account through the wellness platform

---

## How It Works

### System Architecture

```
[Wellness Platform] → [Slack API] → [User's Slack DM]
        ↑                                    ↓
        └──────── [User Response] ←─────────┘
```

1. **Survey Creation**: HR/Admin creates surveys in the wellness platform
2. **Distribution**: System sends surveys to connected Slack users
3. **Interaction**: Users respond through Slack buttons and menus
4. **Processing**: Responses are processed and stored in the platform
5. **Rewards**: Happy Coins and streaks are automatically calculated

### Data Flow
1. When a survey is distributed, the system checks each user's Slack connection status
2. For connected users, surveys are formatted as Slack blocks and sent via DM
3. User interactions trigger webhooks back to the platform
4. Responses are validated and stored in the CheckIn collection
5. User wellness stats are updated in real-time

---

## User Setup Guide

### For Employees: Connecting Your Slack Account

#### Step 1: Access Integration Settings
1. Log into the Wellness Platform at `https://your-wellness-platform.com`
2. Navigate to **Profile** → **Integrations**
3. Find the **Slack** section

#### Step 2: Connect Slack Account
1. Click the **"Connect Slack"** button
2. You'll be redirected to Slack's authorization page
3. Review the permissions requested:
   - Send you direct messages
   - View your basic profile information
4. Click **"Allow"** to grant access

#### Step 3: Verify Connection
1. You'll be redirected back to the wellness platform
2. The Slack section should now show **"Connected"** with a green checkmark
3. You'll see your Slack username displayed

#### Step 4: Test the Connection
1. In Slack, type `/quick-checkin` in any channel
2. You should see an interactive mood check-in appear
3. Click any mood button to test the integration

### Disconnecting Slack (if needed)
1. Go to **Profile** → **Integrations**
2. Click **"Disconnect Slack"** in the Slack section
3. Confirm the disconnection

---

## Admin/HR Guide

### Understanding Survey Distribution

#### Distribution Channels
When distributing surveys, you have two channel options:

1. **Email Only**: Traditional email distribution
2. **Email + Slack**: Sends to both channels for connected users

#### How Distribution Works

```
Survey Distribution Decision Tree:
│
├─ Is user active? → No → Skip user
│                    ↓ Yes
├─ Distribution channel selected?
│   ├─ Email only → Send email
│   └─ Email + Slack → Is Slack connected?
│                      ├─ Yes → Send via Slack DM
│                      └─ No → Send via email only
```

### Creating and Distributing Surveys

#### Via Web Interface
1. Navigate to **Surveys** → **Create Survey**
2. Fill in survey details:
   - Title and description
   - Questions (scale, multiple choice, text, boolean)
   - Rewards (Happy Coins)
   - Priority level
3. Click **"Save Survey"**

#### Distribution Options
1. Go to **Surveys** → **Manage**
2. Find your survey and click **"Distribute"**
3. Select recipients:
   - **All Employees**: Everyone in the system
   - **By Department**: Select specific departments
   - **Individual Selection**: Choose specific employees
4. Choose distribution channels:
   - ✅ Email
   - ✅ Slack (only sends to connected users)
5. Optional: Schedule for later or send immediately

### Monitoring Survey Responses

#### Real-time Dashboard
- View response rates by channel
- See which employees have/haven't responded
- Track average completion time
- Monitor engagement trends

#### Slack-Specific Metrics
- Number of users with Slack connected
- Slack vs Email response rates
- Average time to respond via Slack
- Most active response times

### Automatic Survey Distribution

The system automatically creates and distributes:
- **Weekly Pulse Surveys**: Every Monday at 9:00 AM
- **Reminder Notifications**: Daily at 10:00 AM for pending surveys

---

## Technical Details

### API Endpoints

#### Slack Integration Endpoints

```javascript
// Webhook endpoints (called by Slack)
POST /api/slack/events        // Event subscriptions
POST /api/slack/commands      // Slash commands
POST /api/slack/interactions  // Interactive components
GET  /api/slack/oauth/callback // OAuth callback

// Internal endpoints
GET  /api/integrations/slack/status  // Check connection status
POST /api/integrations/slack/connect  // Initiate connection
POST /api/integrations/slack/disconnect // Remove connection
```

### Data Models

#### User Integration Schema
```javascript
{
  integrations: {
    slack: {
      isConnected: Boolean,
      userId: String,        // Slack user ID (e.g., "U09CHTATL57")
      teamId: String,        // Slack workspace ID
      accessToken: String,   // Encrypted user token
      connectedAt: Date,
      lastSync: Date
    }
  }
}
```

#### CheckIn Schema (Slack-specific fields)
```javascript
{
  source: 'slack',           // Indicates Slack origin
  metadata: {
    slackUserId: String,
    responseId: String,      // Unique response session ID
    type: String             // 'quick_checkin' or 'survey'
  }
}
```

### Security Measures

1. **Request Verification**: All Slack requests are verified using HMAC SHA256
2. **Token Encryption**: Access tokens are encrypted before storage
3. **Time-based Validation**: Requests older than 5 minutes are rejected
4. **User Isolation**: Each user can only access their own data

---

## Slack Commands

### Available Commands

#### `/quick-checkin`
Quick mood check-in with 5 emoji-based options:
- 😊 Excellent (5)
- 🙂 Good (4)  
- 😐 Neutral (3)
- 😕 Not Great (2)
- 😔 Poor (1)

**Usage**: Type `/quick-checkin` in any Slack channel or DM

**Response**: 
- Instant feedback with coins earned
- Current streak information
- Prevents duplicate daily check-ins

#### `/wellness-survey`
View and access available surveys:
- Lists all active surveys assigned to you
- Shows survey priority and reward information
- Allows starting surveys directly from Slack

**Usage**: Type `/wellness-survey` in any Slack channel or DM

### Interactive Elements

#### Survey Questions
Different question types appear as:
- **Scale Questions**: Dropdown menu with emoji indicators
- **Multiple Choice**: Dropdown with options
- **Boolean**: Yes/No radio buttons
- **Text**: Multi-line input field

#### Action Buttons
- **Take Survey**: Opens survey in Slack
- **Submit Survey**: Validates and submits responses
- **Cancel**: Cancels current survey session
- **Remind Me Later**: Schedules a reminder

---

## Survey Distribution

### For HR/Admin: How Surveys Reach Employees

#### Distribution Flow

```
1. HR creates survey → 2. Selects recipients → 3. Chooses channels
                                                    ↓
                              4. System processes each recipient:
                                 - Check if active employee
                                 - Check Slack connection
                                 - Send via appropriate channel
                                                    ↓
                              5. Track delivery and responses
```

#### What Employees See

**In Slack DM:**
```
🤖 Wellness Bot APP 2:30 PM
┌─────────────────────────────────┐
│ 📋 Weekly Wellness Check-In     │
├─────────────────────────────────┤
│ How has your week been? This    │
│ quick survey helps us understand│
│ your wellness trends.           │
│                                 │
│ 🎯 Priority: High               │
│ 💰 Reward: 100 Happy Coins      │
│ ⏱️ Time: 3 minutes              │
├─────────────────────────────────┤
│ 1. How would you rate your mood │
│    this week?                   │
│    [Select rating ▼]            │
│                                 │
│ 2. How well did you manage      │
│    stress?                      │
│    [Select rating ▼]            │
├─────────────────────────────────┤
│ [Submit Survey] [Cancel]        │
└─────────────────────────────────┘
```

### Automated Distributions

#### Weekly Pulse Survey (Mondays 9 AM)
- Automatically created for all active employees
- 5 standard wellness questions
- 100 Happy Coins reward
- High priority

#### Daily Reminders (10 AM)
- Only sent to employees with pending surveys
- Includes due date and reward information
- One-click access to survey

---

## Troubleshooting

### Common Issues and Solutions

#### "Slack not connected" Error
**Problem**: User tries to use Slack commands but isn't connected
**Solution**: 
1. Go to Profile → Integrations
2. Click "Connect Slack"
3. Complete authorization

#### "Survey not delivered via Slack"
**Problem**: Survey was sent but user didn't receive in Slack
**Possible Causes**:
- Slack connection expired
- User not in company Slack workspace
- Slack DM permissions issue

**Solutions**:
1. Verify Slack connection status
2. Reconnect Slack account
3. Check if user can receive DMs from apps

#### "Duplicate check-in" Error
**Problem**: User tries to check in twice in one day
**Solution**: This is expected behavior - only one check-in per day allowed

#### Response Not Recording
**Problem**: User clicks buttons but response isn't saved
**Solutions**:
1. Ensure stable internet connection
2. Try refreshing Slack
3. Use web platform as backup

### For Administrators

#### Monitoring Integration Health
1. Check active Slack connections: 
   ```
   GET /api/analytics/integrations
   ```
2. View Slack-specific metrics in admin dashboard
3. Monitor error logs for signature verification failures

#### Bulk Troubleshooting
- Export user list with Slack connection status
- Identify users without connections
- Send targeted emails encouraging Slack setup

---

## FAQ

### General Questions

**Q: Can I send surveys to employees not in our Slack workspace?**
A: No, the integration only works within your organization's Slack workspace. External users must use the web platform or email.

**Q: Do employees need a paid Slack account?**
A: No, the integration works with both free and paid Slack accounts.

**Q: Can employees respond to surveys from mobile Slack?**
A: Yes, all features work on Slack mobile apps.

**Q: What happens if an employee leaves the Slack workspace?**
A: Their Slack integration will automatically disconnect, and they'll receive surveys via email only.

### Privacy & Security

**Q: What data does the Slack app access?**
A: Only basic profile information (name, email) and the ability to send direct messages. No access to private channels or messages.

**Q: Is survey response data encrypted?**
A: Yes, all data is encrypted in transit and at rest.

**Q: Can other Slack users see my survey responses?**
A: No, all surveys are sent via private DM and responses are confidential.

### Technical Questions

**Q: How quickly do responses sync?**
A: Responses are processed in real-time, usually within 1-2 seconds.

**Q: Is there a limit to survey frequency?**
A: No hard limit, but we recommend maximum 1 survey per day to avoid survey fatigue.

**Q: Can we customize the Slack bot name and icon?**
A: Yes, this can be configured in your Slack app settings.

### Troubleshooting

**Q: The slash commands aren't working**
A: 
1. Ensure you're in the correct Slack workspace
2. Try typing the full command: `/quick-checkin`
3. Check if the Wellness app is installed in your workspace

**Q: I connected Slack but don't receive surveys**
A:
1. Verify connection in Profile → Integrations
2. Check if you have any pending surveys
3. Ensure DMs from apps are allowed in your Slack settings

---

## Best Practices

### For Employees
- Connect Slack during onboarding for seamless experience
- Respond to surveys promptly for streak bonuses
- Use quick check-ins daily to track mood trends

### For HR/Admin
- Schedule surveys during work hours for better response rates
- Keep surveys short (5-7 questions max)
- Use high priority sparingly to maintain importance
- Monitor Slack vs email response rates to optimize channel selection

### For IT/Developers
- Regularly verify webhook URLs are accessible
- Monitor Slack API rate limits
- Keep signing secrets secure and rotate periodically
- Set up alerts for signature verification failures

---

## Support & Contact

For technical issues:
- Check error logs in Railway dashboard
- Review Slack app configuration
- Contact development team

For user support:
- HR can access user connection status via admin panel
- Provide this guide to employees during onboarding
- Create internal FAQ based on common questions

---

*Last Updated: [Current Date]*
*Version: 1.0*