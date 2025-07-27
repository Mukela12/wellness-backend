const axios = require('axios');
const crypto = require('crypto');
const User = require('../../models/User');

class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v19.0';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    
    // Test number for development
    this.testPhoneNumber = process.env.NODE_ENV === 'development' ? '+15550267733' : null;
    
    if (!this.accessToken || !this.phoneNumberId) {
      console.warn('⚠️  WhatsApp Service: Missing required environment variables');
    } else {
      console.log('✅ WhatsApp service initialized');
    }
  }

  // Verify webhook for Meta
  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      console.log('✅ WhatsApp webhook verified');
      return challenge;
    }
    console.error('❌ WhatsApp webhook verification failed');
    return null;
  }

  // Send text message
  async sendTextMessage(phoneNumber, message) {
    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(phoneNumber),
        type: 'text',
        text: { body: message }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ WhatsApp message sent to ${phoneNumber}`);
      return response.data;
    } catch (error) {
      console.error('❌ WhatsApp send message error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send template message
  async sendTemplateMessage(phoneNumber, templateName, variables = []) {
    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
      
      // Build components based on template
      const components = [];
      
      // Add body component with variables if any
      if (variables.length > 0) {
        components.push({
          type: 'body',
          parameters: variables.map(value => ({
            type: 'text',
            text: String(value)
          }))
        });
      }

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(phoneNumber),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en_US' },
          components: components
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ WhatsApp template ${templateName} sent to ${phoneNumber}`);
      return response.data;
    } catch (error) {
      console.error('❌ WhatsApp template message error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send daily check-in reminder
  async sendDailyCheckInReminder(userId) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.phone) {
        throw new Error('User or phone number not found');
      }

      // Use test number in development
      const phoneNumber = this.testPhoneNumber || user.phone;
      
      return await this.sendTemplateMessage(
        phoneNumber,
        'wellness_daily_checkin',
        [user.name.split(' ')[0]] // First name only
      );
    } catch (error) {
      console.error(`❌ Failed to send check-in reminder to user ${userId}:`, error.message);
      throw error;
    }
  }

  // Send weekly data report
  async sendWeeklyDataReport(userId, reportData) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.phone) {
        throw new Error('User or phone number not found');
      }

      // Use test number in development
      const phoneNumber = this.testPhoneNumber || user.phone;
      
      const variables = [
        user.name.split(' ')[0], // First name
        reportData.period || 'Past 7 days',
        String(reportData.checkInsCompleted || 0),
        String(reportData.averageMood || 0),
        String(reportData.happyCoinsEarned || 0),
        String(reportData.achievementsUnlocked || 0)
      ];

      return await this.sendTemplateMessage(
        phoneNumber,
        'wellness_data_report',
        variables
      );
    } catch (error) {
      console.error(`❌ Failed to send weekly report to user ${userId}:`, error.message);
      throw error;
    }
  }

  // Handle incoming webhook
  async handleWebhook(body) {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(body)) {
        throw new Error('Invalid webhook signature');
      }

      const { entry } = body;
      if (!entry || entry.length === 0) return;

      for (const item of entry) {
        const { changes } = item;
        if (!changes || changes.length === 0) continue;

        for (const change of changes) {
          const { value } = change;
          if (!value.messages) continue;

          for (const message of value.messages) {
            await this.processIncomingMessage(message, value.contacts[0]);
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('❌ WhatsApp webhook error:', error.message);
      throw error;
    }
  }

  // Process incoming message
  async processIncomingMessage(message, contact) {
    try {
      const { from, type, text, button } = message;
      
      console.log(`📱 Received WhatsApp message from ${from}:`, text?.body || button?.text || type);

      // Find user by phone number
      const user = await User.findOne({ phone: this.normalizePhoneNumber(from) });
      if (!user) {
        console.warn(`User not found for phone: ${from}`);
        return;
      }

      // Handle quick replies from daily check-in template
      if (button?.text) {
        await this.handleQuickReply(user, button.text);
      }
      
      // Handle text messages
      else if (type === 'text' && text?.body) {
        await this.handleTextMessage(user, text.body);
      }

    } catch (error) {
      console.error('❌ Error processing incoming message:', error.message);
    }
  }

  // Handle quick reply buttons
  async handleQuickReply(user, buttonText) {
    switch (buttonText.toLowerCase()) {
      case 'complete check-in':
        // Send check-in link
        await this.sendTextMessage(
          user.phone,
          `Great! Complete your check-in here: ${process.env.CLIENT_URL}/checkin\n\nOr reply with a number 1-5 for your mood (1=Very Bad, 5=Excellent)`
        );
        break;

      case 'remind me later':
        // Schedule reminder for 2 hours later
        await this.sendTextMessage(
          user.phone,
          "No problem! I'll remind you in 2 hours. Stay well! 🌟"
        );
        // TODO: Implement scheduled reminder
        break;

      case 'skip today':
        // Mark as skipped
        await this.sendTextMessage(
          user.phone,
          "Understood. Remember, your wellbeing matters. I'll check in with you tomorrow! 💙"
        );
        break;

      case 'view details':
      case 'share report':
        // Send link to dashboard
        await this.sendTextMessage(
          user.phone,
          `View your complete wellness report: ${process.env.CLIENT_URL}/dashboard`
        );
        break;

      default:
        console.log('Unknown quick reply:', buttonText);
    }
  }

  // Handle text messages (simple mood tracking)
  async handleTextMessage(user, text) {
    const trimmedText = text.trim().toLowerCase();
    
    // Check if it's a mood rating (1-5)
    const moodMatch = trimmedText.match(/^[1-5]$/);
    if (moodMatch) {
      const mood = parseInt(moodMatch[0]);
      
      // Create a quick check-in
      try {
        const CheckIn = require('../../models/CheckIn');
        const checkIn = await CheckIn.create({
          userId: user._id,
          mood,
          energy: 3, // Default values
          stress: 3,
          productivity: 3,
          workload: 3,
          source: 'whatsapp',
          notes: 'Quick check-in via WhatsApp'
        });

        const moodEmoji = ['😔', '😕', '😐', '🙂', '😊'][mood - 1];
        await this.sendTextMessage(
          user.phone,
          `Thanks for checking in! ${moodEmoji}\n\nYour mood: ${mood}/5\nHappy Coins earned: +${checkIn.happyCoinsEarned || 50}\n\nWant to add more details? Visit: ${process.env.CLIENT_URL}/checkin`
        );
      } catch (error) {
        console.error('Error creating WhatsApp check-in:', error);
        await this.sendTextMessage(
          user.phone,
          "Sorry, I couldn't record your check-in. Please try again or use the web app."
        );
      }
    }
    // Handle other commands
    else if (trimmedText.includes('help')) {
      await this.sendHelpMessage(user.phone);
    }
    else if (trimmedText.includes('status')) {
      await this.sendStatusMessage(user);
    }
  }

  // Send help message
  async sendHelpMessage(phoneNumber) {
    const helpText = `Here's how I can help:

📱 *Quick Check-in*: Reply with 1-5 for mood
💰 *Check Balance*: Reply "status"
📊 *View Dashboard*: Reply "dashboard"
🔕 *Stop Messages*: Reply "stop"
❓ *Help*: Reply "help"

Or visit: ${process.env.CLIENT_URL}`;

    await this.sendTextMessage(phoneNumber, helpText);
  }

  // Send status message
  async sendStatusMessage(user) {
    const statusText = `Your Wellness Status:

💰 Happy Coins: ${user.wellness.happyCoins}
🔥 Current Streak: ${user.wellness.currentStreak} days
😊 Risk Level: ${user.wellness.riskLevel}

Keep up the great work!`;

    await this.sendTextMessage(user.phone, statusText);
  }

  // Format phone number
  formatPhoneNumber(phoneNumber) {
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (default to US +1)
    if (!cleaned.startsWith('1') && !cleaned.startsWith('852')) {
      cleaned = '1' + cleaned;
    }
    
    return cleaned;
  }

  // Normalize phone number for database lookup
  normalizePhoneNumber(phoneNumber) {
    // Add + prefix if missing
    return phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber;
  }

  // Verify webhook signature (Meta security)
  verifyWebhookSignature(body) {
    // In development, skip signature verification
    if (process.env.NODE_ENV === 'development') return true;
    
    // TODO: Implement signature verification for production
    // Reference: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
    return true;
  }

  // Get service status
  getStatus() {
    return {
      configured: !!(this.accessToken && this.phoneNumberId),
      connected: !!(this.accessToken && this.phoneNumberId),
      testMode: !!this.testPhoneNumber,
      features: {
        dailyReminders: true,
        weeklyReports: true,
        quickCheckIns: true,
        templateMessages: true
      }
    };
  }
}

module.exports = new WhatsAppService();