# Microsoft Teams Integration Guide for Wellness Platform

## Table of Contents
1. [Overview](#overview)
2. [Architecture Comparison](#architecture-comparison)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Setup Process](#step-by-step-setup-process)
5. [Implementation Details](#implementation-details)
6. [User Experience Flow](#user-experience-flow)
7. [API Reference](#api-reference)
8. [Security Considerations](#security-considerations)
9. [Testing Guide](#testing-guide)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Microsoft Teams integration allows employees to receive and respond to wellness surveys and pulse check-ins directly within Teams, leveraging the Bot Framework and Adaptive Cards for rich, interactive experiences.

### Key Features
- 📋 Interactive surveys using Adaptive Cards
- 🤖 Bot-powered conversational interface
- ⚡ Real-time survey responses
- 🔔 Proactive notifications and reminders
- 💎 Happy Coins rewards integration
- 📊 Rich media support with charts and images
- 🎯 Targeted survey distribution
- 🔒 Secure authentication with SSO support

### Advantages Over Slack Integration
- **Richer UI**: Adaptive Cards provide more interactive elements
- **Better Media Support**: Embed images, videos, and charts directly
- **Enterprise Integration**: Seamless SSO with Azure AD
- **Advanced Actions**: Multi-step workflows and conditional logic
- **Broader Reach**: Works across Teams, Outlook, and other M365 apps

---

## Architecture Comparison

### Slack vs Teams Architecture

```
SLACK ARCHITECTURE:
[Wellness Platform] → [Slack Web API] → [Slack Workspace] → [User DM]
        ↑                                                          ↓
        └────────────── [Webhook Response] ←─────────────────────┘

TEAMS ARCHITECTURE:
[Wellness Platform] → [Bot Framework] → [Teams Service] → [User Chat]
        ↑                     ↓                               ↓
        │              [Azure Bot Service]            [Adaptive Cards]
        │                     ↓                               ↓
        └──────────── [Activity Handler] ←───────────────────┘
```

### Key Differences
1. **Bot Framework**: Teams uses Microsoft Bot Framework SDK v4
2. **Adaptive Cards**: Richer UI compared to Slack blocks
3. **Authentication**: Azure AD integration for SSO
4. **Messaging**: Activity-based model vs webhook-based
5. **Deployment**: Requires Azure Bot Service registration

---

## Prerequisites

### Development Requirements
- Node.js 18.x or higher
- Microsoft 365 developer account or Teams admin access
- Azure subscription (for Bot Service)
- Visual Studio Code with Teams Toolkit extension
- ngrok or Azure Dev Tunnels for local development

### Required Accounts
1. **Azure Account**: For Bot Service registration
2. **Microsoft 365 Account**: With Teams administrator access
3. **App Registration**: In Azure Active Directory

---

## Step-by-Step Setup Process

### Step 1: Create Azure Bot Service

1. **Navigate to Azure Portal**
   ```
   https://portal.azure.com
   ```

2. **Create Bot Service Resource**
   - Click "Create a resource"
   - Search for "Azure Bot"
   - Select "Azure Bot" and click "Create"

3. **Configure Bot Settings**
   ```
   Bot handle: wellness-platform-bot
   Subscription: Your Azure subscription
   Resource group: Create new or use existing
   Pricing tier: F0 (Free) for development
   Microsoft App ID: Create new Microsoft App ID
   ```

4. **Save Credentials**
   - Copy the Microsoft App ID
   - Create and save the client secret

### Step 2: Register App in Azure AD

1. **Go to Azure Active Directory**
   - Navigate to "App registrations"
   - Click "New registration"

2. **Configure App Registration**
   ```
   Name: Wellness Platform Teams Bot
   Supported account types: Single tenant
   Redirect URI: Leave blank initially
   ```

3. **Configure API Permissions**
   - Add Microsoft Graph permissions:
     - User.Read (Delegated)
     - TeamsAppInstallation.ReadWriteForUser (Delegated)
     - TeamsActivity.Send (Application)

4. **Create Client Secret**
   - Go to "Certificates & secrets"
   - New client secret
   - Description: "Teams Bot Secret"
   - Expires: 24 months
   - Copy the secret value immediately

### Step 3: Configure Bot Messaging Endpoint

1. **For Local Development**
   ```bash
   # Install ngrok
   npm install -g ngrok
   
   # Run ngrok
   ngrok http 3978
   ```
   
   Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

2. **Update Bot Service**
   - Go to your Bot Service in Azure
   - Configuration → Messaging endpoint
   - Set to: `https://abc123.ngrok.io/api/messages`
   - Save changes

### Step 4: Set Up Teams App

1. **Create App Package Structure**
   ```
   teams-app/
   ├── manifest.json
   ├── color.png (192x192)
   └── outline.png (32x32)
   ```

2. **Create manifest.json**
   ```json
   {
     "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
     "manifestVersion": "1.16",
     "version": "1.0.0",
     "id": "YOUR-BOT-APP-ID",
     "packageName": "com.wellness.teams.bot",
     "developer": {
       "name": "Wellness Platform",
       "websiteUrl": "https://wellness-platform.com",
       "privacyUrl": "https://wellness-platform.com/privacy",
       "termsOfUseUrl": "https://wellness-platform.com/terms"
     },
     "name": {
       "short": "Wellness Bot",
       "full": "Wellness Platform Survey Bot"
     },
     "description": {
       "short": "Receive and respond to wellness surveys",
       "full": "A bot that delivers wellness surveys and collects responses to improve employee wellbeing"
     },
     "icons": {
       "color": "color.png",
       "outline": "outline.png"
     },
     "accentColor": "#3B82F6",
     "bots": [
       {
         "botId": "YOUR-BOT-APP-ID",
         "scopes": ["personal", "team", "groupchat"],
         "supportsFiles": false,
         "isNotificationOnly": false,
         "commandLists": [
           {
             "scopes": ["personal", "team", "groupchat"],
             "commands": [
               {
                 "title": "survey",
                 "description": "Take a wellness survey"
               },
               {
                 "title": "checkin",
                 "description": "Quick wellness check-in"
               },
               {
                 "title": "help",
                 "description": "Get help using the wellness bot"
               }
             ]
           }
         ]
       }
     ],
     "permissions": [
       "identity",
       "messageTeamMembers"
     ],
     "validDomains": [
       "wellness-platform.com",
       "*.ngrok.io"
     ],
     "webApplicationInfo": {
       "id": "YOUR-BOT-APP-ID",
       "resource": "api://wellness-platform.com/YOUR-BOT-APP-ID"
     }
   }
   ```

3. **Create App Icons**
   - color.png: 192x192px color icon
   - outline.png: 32x32px monochrome outline

4. **Package the App**
   ```bash
   # From teams-app directory
   zip -r wellness-bot.zip manifest.json color.png outline.png
   ```

### Step 5: Install Bot Framework SDK

```bash
# Install required packages
npm install --save botbuilder
npm install --save botbuilder-teams
npm install --save restify
npm install --save dotenv
npm install --save adaptivecards
npm install --save adaptivecards-templating
```

### Step 6: Configure Environment Variables

Add to `.env`:
```env
# Microsoft Teams Bot Configuration
TEAMS_APP_ID=your-bot-app-id
TEAMS_APP_PASSWORD=your-bot-app-password
TEAMS_APP_TENANT_ID=your-tenant-id
TEAMS_BOT_ENDPOINT=/api/messages

# Bot Framework
BOT_DOMAIN=https://your-domain.com
PORT=3978

# Azure Bot Service
AZURE_BOT_ID=your-azure-bot-id
AZURE_BOT_HANDLE=wellness-platform-bot
```

### Step 7: Deploy to Teams

1. **Admin Upload (Recommended for Testing)**
   - Go to Teams Admin Center
   - Teams apps → Manage apps
   - Upload → Upload .zip file
   - Select wellness-bot.zip

2. **User Installation**
   - In Teams, go to Apps
   - Upload a custom app
   - Upload for me or my team
   - Select wellness-bot.zip

---

## Implementation Details

### Core Components

#### 1. Bot Service Architecture
```javascript
// teams.service.js structure
class TeamsService {
  - Bot initialization
  - Activity handlers
  - Conversation references
  - Proactive messaging
  - User authentication
}
```

#### 2. Adaptive Cards Service
```javascript
// adaptiveCards.service.js
class AdaptiveCardsService {
  - Survey card templates
  - Quick check-in cards
  - Result cards
  - Dynamic card generation
}
```

#### 3. Survey Service
```javascript
// teamsSurvey.service.js  
class TeamsSurveyService {
  - Survey distribution
  - Response collection
  - Progress tracking
  - Reminder scheduling
}
```

### Key Implementation Differences from Slack

1. **Message Handling**
   - Teams: Activity-based with turnContext
   - Slack: Event/command based with webhooks

2. **UI Components**
   - Teams: Adaptive Cards with rich actions
   - Slack: Block Kit with limited interactivity

3. **Authentication**
   - Teams: OAuth 2.0 with Azure AD
   - Slack: OAuth 2.0 with Slack identity

4. **User Identification**
   - Teams: AAD Object ID + Teams User ID
   - Slack: Slack User ID

---

## User Experience Flow

### 1. Initial Setup (Employee)
```
1. Employee receives Teams notification about Wellness Bot
2. Clicks to install the bot in personal scope
3. Bot sends welcome message with setup instructions
4. Employee links their wellness account via SSO
5. Bot confirms connection and shows available commands
```

### 2. Survey Distribution Flow
```
1. Admin creates survey in wellness platform
2. System identifies Teams-connected users
3. Bot sends proactive message with survey card
4. Employee interacts with adaptive card elements
5. Responses are submitted via card actions
6. Bot confirms submission and shows rewards earned
```

### 3. Quick Check-in Flow
```
1. Employee types "/checkin" or clicks reminder
2. Bot presents mood selection card
3. Employee selects mood with single click
4. Bot records response and shows streak
5. Optional: Follow-up questions if mood is low
```

---

## API Reference

### Webhook Endpoints

#### POST /api/messages
Bot Framework messaging endpoint
```javascript
Request: Bot Framework Activity
Response: 200 OK
```

#### POST /api/teams/proactive
Send proactive messages
```javascript
Request: {
  userId: string,
  message: AdaptiveCard,
  conversationReference: object
}
```

### Bot Commands

| Command | Description | Scope |
|---------|-------------|-------|
| `/survey [id]` | Take a specific survey or list available | Personal, Team |
| `/checkin` | Quick wellness check-in | Personal |
| `/help` | Show available commands | All |
| `/status` | View wellness stats and streaks | Personal |
| `/connect` | Link Teams account to wellness platform | Personal |

---

## Security Considerations

### 1. Authentication
- Use Azure AD for SSO
- Validate JWT tokens from Teams
- Store refresh tokens securely
- Implement token expiration handling

### 2. Data Protection
- Encrypt conversation references
- Use HTTPS for all communications
- Validate Teams app ID in requests
- Implement rate limiting

### 3. Permissions
- Request minimal Graph API permissions
- Use delegated permissions where possible
- Audit bot activities
- Implement user consent flows

---

## Testing Guide

### Local Development Setup

1. **Start ngrok tunnel**
   ```bash
   ngrok http 3978
   ```

2. **Update Bot Service endpoint**
   - Use ngrok HTTPS URL
   - Append `/api/messages`

3. **Run the bot locally**
   ```bash
   npm run dev
   ```

4. **Test in Teams**
   - Upload updated app package
   - Send test messages
   - Verify responses

### Testing Checklist
- [ ] Bot responds to commands
- [ ] Adaptive cards render correctly
- [ ] Survey responses are recorded
- [ ] Proactive messages work
- [ ] Error handling functions
- [ ] Authentication flow completes
- [ ] Happy Coins are awarded

---

## Troubleshooting

### Common Issues

#### 1. Bot Not Responding
- Check messaging endpoint URL
- Verify app ID and password
- Ensure bot is running
- Check Teams app permissions

#### 2. Adaptive Cards Not Rendering
- Verify card schema version (≤1.5)
- Check for invalid JSON
- Test card in designer first
- Ensure image URLs are accessible

#### 3. Authentication Failures
- Verify Azure AD app registration
- Check token configuration
- Ensure correct tenant ID
- Validate redirect URIs

#### 4. Proactive Messages Failing
- Store conversation references
- Handle user blocks/uninstalls
- Implement retry logic
- Check rate limits

### Debug Tools
- Bot Framework Emulator
- Teams App Studio
- Adaptive Cards Designer
- Azure Bot Service Test in Web Chat
- Teams Developer Portal

### Logging
```javascript
// Enable detailed logging
process.env.DEBUG = 'botbuilder*'
```

---

## Migration Path from Slack

### Phase 1: Parallel Operation
1. Keep Slack integration active
2. Deploy Teams bot to pilot group
3. Collect feedback and iterate
4. Monitor engagement metrics

### Phase 2: Feature Parity
1. Implement all Slack features in Teams
2. Add Teams-specific enhancements
3. Train HR/Admin on Teams tools
4. Create migration guides

### Phase 3: User Migration
1. Announce Teams integration availability
2. Provide incentives for early adoption
3. Offer support during transition
4. Phase out Slack integration gradually

---

## Best Practices

### 1. User Experience
- Keep surveys short and focused
- Use visual elements in cards
- Provide clear CTAs
- Show progress indicators
- Celebrate streaks and achievements

### 2. Performance
- Cache conversation references
- Batch proactive messages
- Implement queue for large distributions
- Monitor API rate limits
- Use Teams activity feed

### 3. Maintenance
- Version your bot updates
- Test cards before deployment
- Monitor error rates
- Keep documentation updated
- Regular security audits

---

## Conclusion

The Microsoft Teams integration provides a more feature-rich and enterprise-ready solution compared to Slack, leveraging the full power of the Microsoft ecosystem. With Adaptive Cards, SSO, and deep M365 integration, it offers a superior user experience for wellness surveys and engagement.