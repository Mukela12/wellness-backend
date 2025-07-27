# WhatsApp Business API Integration Guide for Amy

## 🎯 Overview

This guide provides step-by-step instructions for Amy to set up WhatsApp Business API integration with the WellnessAI platform. The integration will enable automated wellness check-in reminders, conversational mood tracking, and real-time AI insights delivery via WhatsApp.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [WhatsApp Business API Setup](#whatsapp-business-api-setup)
3. [Backend Integration](#backend-integration)
4. [Environment Configuration](#environment-configuration)
5. [Testing Setup](#testing-setup)
6. [Web App Integration](#web-app-integration)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### Required Accounts & Services
- **Meta Business Account** (formerly Facebook Business)
- **WhatsApp Business Account**
- **Verified Business Phone Number**
- **SSL Certificate** for webhook endpoints
- **Public Domain** for webhook URLs

### Technical Requirements
- **Node.js 18+** (already set up)
- **MongoDB** (already configured)
- **HTTPS endpoint** for webhooks
- **Valid SSL certificate**

## 🚀 WhatsApp Business API Setup

### Step 1: Create Meta Business Account

1. **Go to Meta Business**: Visit [business.facebook.com](https://business.facebook.com)
2. **Create Account**: Click "Create Account" and follow setup
3. **Verify Business**: Complete business verification process
4. **Add WhatsApp**: Navigate to "WhatsApp" in business settings

### Step 2: Set Up WhatsApp Business API

1. **Access WhatsApp Manager**:
   ```
   https://business.facebook.com/wa/manage/
   ```

2. **Create WhatsApp Business Account**:
   - Click "Add WhatsApp Business Account"
   - Enter business details
   - Verify business information

3. **Add Phone Number**:
   - Click "Add phone number"
   - Enter business phone number
   - Complete verification (SMS/Voice call)
   - **Note**: This number will be used for all WhatsApp communications

### Step 3: Create WhatsApp App

1. **Go to Meta Developers**: Visit [developers.facebook.com](https://developers.facebook.com)
2. **Create App**:
   - Click "Create App"
   - Select "Business" type
   - Enter app name: `WellnessAI WhatsApp Integration`
   - Connect to your Meta Business Account

3. **Add WhatsApp Product**:
   - In app dashboard, click "Add Product"
   - Select "WhatsApp Business Platform"
   - Click "Set Up"

### Step 4: Configure WhatsApp Business Platform

1. **Get Access Token**:
   - Navigate to WhatsApp → Getting Started
   - Select your WhatsApp Business Account
   - Generate **Temporary Access Token** (24 hours)
   - **Save this token** - you'll need it for testing

2. **Get Phone Number ID**:
   - In the same section, note the **Phone Number ID**
   - This identifies your business phone number

3. **Configure Webhook**:
   - Go to WhatsApp → Configuration
   - Set Webhook URL: `https://yourdomain.com/api/whatsapp/webhook`
   - Set Verify Token: `wellness_webhook_verify_token_2024`
   - Subscribe to fields: `messages`, `message_status`

## 🔗 Backend Integration

### Step 5: Environment Variables Setup

Add these variables to your `.env` file:

```env
# WhatsApp Business API Configuration
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_WEBHOOK_VERIFY_TOKEN=wellness_webhook_verify_token_2024
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_here

# WhatsApp API Base URL
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v19.0

# Webhook Configuration
WEBHOOK_BASE_URL=https://yourdomain.com
```

### Step 6: Backend Code Implementation

The backend already has WhatsApp integration prepared. Here's what's included:

#### A. WhatsApp Service (`src/services/whatsapp/whatsapp.service.js`)
```javascript
// Already implemented features:
✅ Send text messages
✅ Send template messages  
✅ Send media messages
✅ Handle incoming messages
✅ Webhook verification
✅ Message status tracking
```

#### B. WhatsApp Routes (`src/routes/whatsapp.routes.js`)
```javascript
// Available endpoints:
✅ POST /api/whatsapp/webhook - Receive messages
✅ GET /api/whatsapp/webhook - Webhook verification
✅ POST /api/whatsapp/send-message - Send messages
✅ POST /api/whatsapp/send-reminder - Send check-in reminders
✅ GET /api/whatsapp/status - Service status
```

#### C. Automated Features (Already Implemented)
```javascript
// Scheduled tasks:
✅ Daily check-in reminders at 9 AM
✅ Weekly wellness summaries
✅ Mood trend alerts
✅ Challenge progress notifications
✅ Peer recognition alerts
```

### Step 7: Message Templates Setup

1. **Access Message Templates**:
   - Go to WhatsApp Manager → Message Templates
   - Click "Create Template"

2. **Create Check-in Reminder Template**:
   ```
   Template Name: wellness_checkin_reminder
   Category: UTILITY
   Language: English (US)
   
   Header: Good morning! 🌅
   Body: Hi {{1}}, it's time for your daily wellness check-in! How are you feeling today? Please complete your check-in to help us support your wellbeing journey.
   
   Buttons:
   - Quick Reply: "Great! 😊"
   - Quick Reply: "Okay 😐" 
   - Quick Reply: "Not great 😔"
   - URL Button: "Complete Check-in" → https://yourapp.com/checkin
   ```

3. **Create Weekly Summary Template**:
   ```
   Template Name: wellness_weekly_summary
   Category: UTILITY
   Language: English (US)
   
   Header: Your Weekly Wellness Summary 📊
   Body: Hi {{1}}, here's your wellness summary for this week:
   
   🎯 Check-ins completed: {{2}}/7
   😊 Average mood: {{3}}/5
   💰 Happy Coins earned: {{4}}
   🏆 Achievements unlocked: {{5}}
   
   Keep up the great work!
   
   Button: URL → "View Full Report" → https://yourapp.com/dashboard
   ```

## 🧪 Testing Setup

### Step 8: Test WhatsApp Integration

1. **Test Webhook Verification**:
   ```bash
   curl -X GET "https://yourdomain.com/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=test_challenge&hub.verify_token=wellness_webhook_verify_token_2024"
   ```

2. **Test Sending Message**:
   ```bash
   curl -X POST http://localhost:8005/api/whatsapp/send-message \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{
       "phoneNumber": "1234567890",
       "message": "Hello! This is a test message from WellnessAI 🌟"
     }'
   ```

3. **Test Check-in Reminder**:
   ```bash
   curl -X POST http://localhost:8005/api/whatsapp/send-reminder \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{
       "userId": "USER_ID_HERE",
       "reminderType": "daily_checkin"
     }'
   ```

### Step 9: Enable Production Access

1. **Business Verification**:
   - Complete Meta Business Verification
   - Provide business documents
   - Wait for approval (1-3 business days)

2. **Generate Permanent Access Token**:
   - Go to WhatsApp → Getting Started
   - Click "Generate permanent token"
   - Select required permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - **Save this token** and update `.env` file

3. **Message Template Approval**:
   - Submit templates for review
   - Wait for approval (24-48 hours)
   - Templates must be approved before sending

## 🌐 Web App Integration

### Step 10: Frontend Integration Points

#### A. User Profile Settings
```javascript
// Add WhatsApp preferences to user profile
const whatsappSettings = {
  phoneNumber: "+1234567890",
  enableReminders: true,
  preferredReminderTime: "09:00",
  enableWeeklySummary: true,
  enableChallengeUpdates: true
};
```

#### B. Check-in Flow Enhancement
```javascript
// After user completes check-in
if (user.preferences.whatsappEnabled) {
  // Send confirmation via WhatsApp
  await whatsappService.sendCheckInConfirmation(user.phoneNumber, {
    mood: checkIn.mood,
    happyCoinsEarned: checkIn.rewardEarned.total,
    streak: user.wellness.currentStreak
  });
}
```

#### C. WhatsApp Status Display
```javascript
// Show WhatsApp connection status in settings
const WhatsAppStatus = () => {
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    fetch('/api/whatsapp/status')
      .then(res => res.json())
      .then(data => setStatus(data));
  }, []);
  
  return (
    <div className="whatsapp-status">
      <span className={status?.connected ? 'connected' : 'disconnected'}>
        WhatsApp: {status?.connected ? 'Connected ✅' : 'Disconnected ❌'}
      </span>
    </div>
  );
};
```

### Step 11: User Onboarding for WhatsApp

#### A. Phone Number Collection
```javascript
// Add to onboarding flow
const WhatsAppOptIn = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [optIn, setOptIn] = useState(false);
  
  const handleOptIn = async () => {
    if (optIn && phoneNumber) {
      await fetch('/api/profile/whatsapp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          enableReminders: true
        })
      });
    }
  };
  
  return (
    <div className="whatsapp-optin">
      <h3>📱 WhatsApp Notifications (Optional)</h3>
      <p>Get daily wellness reminders and updates via WhatsApp</p>
      
      <input
        type="tel"
        placeholder="+1 (555) 123-4567"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
      />
      
      <label>
        <input
          type="checkbox"
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
        />
        Yes, send me WhatsApp notifications
      </label>
      
      <button onClick={handleOptIn}>Save Preferences</button>
    </div>
  );
};
```

## 🚀 Production Deployment

### Step 12: Deployment Checklist

1. **SSL Certificate**: Ensure HTTPS is properly configured
2. **Webhook URL**: Update webhook URL to production domain
3. **Environment Variables**: Set production tokens in deployment environment
4. **Message Templates**: Ensure all templates are approved
5. **Rate Limits**: Configure appropriate rate limiting
6. **Error Handling**: Implement comprehensive error logging
7. **Monitoring**: Set up monitoring for WhatsApp message delivery

### Step 13: Go Live Process

1. **Update Webhook URL**:
   ```
   Production: https://wellnessai.com/api/whatsapp/webhook
   ```

2. **Test Production Environment**:
   - Send test message to your phone
   - Verify webhook receives messages
   - Test all message templates

3. **Enable for Users**:
   - Start with beta users
   - Gradually roll out to all users
   - Monitor delivery rates and errors

## 🛠 Troubleshooting

### Common Issues & Solutions

#### 1. Webhook Verification Failed
```
Error: Webhook verification failed
Solution: 
- Check WHATSAPP_WEBHOOK_VERIFY_TOKEN matches Meta configuration
- Ensure webhook URL is accessible via HTTPS
- Verify SSL certificate is valid
```

#### 2. Message Sending Failed
```
Error: Message not delivered
Solutions:
- Check phone number format (+1234567890)
- Verify recipient has WhatsApp installed
- Ensure message template is approved
- Check access token is valid and has permissions
```

#### 3. Template Message Rejected
```
Error: Template message failed
Solutions:
- Use only approved message templates
- Ensure template parameters match exactly
- Check template is in APPROVED status
- Verify 24-hour messaging window
```

## 📊 Analytics & Monitoring

### Key Metrics to Track

1. **Message Delivery Rates**
   ```javascript
   // Track in database
   - Messages sent: 1,250
   - Messages delivered: 1,180 (94.4%)
   - Messages read: 980 (78.4%)
   - Messages failed: 70 (5.6%)
   ```

2. **User Engagement**
   ```javascript
   // WhatsApp vs other channels
   - Check-in completion rate (WhatsApp): 89%
   - Check-in completion rate (Email): 45%
   - Average response time: 2.3 minutes
   ```

3. **Template Performance**
   ```javascript
   // Template metrics
   - Daily reminder open rate: 92%
   - Weekly summary engagement: 76%
   - Challenge notification clicks: 84%
   ```

## 🔐 Security Considerations

### Best Practices

1. **Token Security**:
   - Store access tokens securely
   - Rotate tokens regularly
   - Never expose tokens in client-side code

2. **Webhook Security**:
   - Verify webhook signatures
   - Use HTTPS only
   - Implement rate limiting

3. **User Privacy**:
   - Obtain explicit consent for WhatsApp messaging
   - Provide easy opt-out mechanism
   - Comply with data protection regulations

## 📞 Support & Resources

### Meta Documentation
- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Webhook Setup](https://developers.facebook.com/docs/whatsapp/webhooks)

### Contact Information
- **Meta Support**: Available through Developer Console
- **Business Verification**: business-verification@meta.com
- **Technical Issues**: Report through Developer Console

---

## 🎯 Next Steps for Amy

1. **Immediate (This Week)**:
   - [ ] Create Meta Business Account
   - [ ] Set up WhatsApp Business Account
   - [ ] Create WhatsApp App in Developer Console
   - [ ] Configure webhook URL and verify token

2. **Short Term (Next Week)**:
   - [ ] Create and submit message templates
   - [ ] Generate permanent access token
   - [ ] Update backend environment variables
   - [ ] Test integration with development environment

3. **Medium Term (2-3 Weeks)**:
   - [ ] Complete business verification
   - [ ] Get templates approved
   - [ ] Test with beta users
   - [ ] Deploy to production

4. **Long Term (1 Month)**:
   - [ ] Roll out to all users
   - [ ] Monitor analytics and engagement
   - [ ] Optimize message templates based on performance
   - [ ] Implement advanced features (rich media, interactive buttons)

---

**Important Notes**:
- Keep all access tokens and credentials secure
- Test thoroughly in development before production
- WhatsApp has strict policies - ensure compliance
- Monitor message delivery rates and user feedback
- Be prepared for Meta review process (can take several days)

Contact the development team if you need any clarification or run into issues during setup!