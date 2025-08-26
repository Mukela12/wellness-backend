const axios = require('axios');
const crypto = require('crypto');

class SlackService {
  constructor() {
    this.clientId = process.env.SLACK_CLIENT_ID;
    this.clientSecret = process.env.SLACK_CLIENT_SECRET;
    this.signingSecret = process.env.SLACK_SIGNING_SECRET;
    this.botToken = process.env.SLACK_BOT_TOKEN;
    
    console.log('✅ Minimal Slack service initialized');
  }

  // Stub methods to prevent errors
  verifySlackRequest(req) {
    console.warn('Slack signature verification disabled - install dependencies to enable');
    return true;
  }

  async handleSlashCommand(command, text, userId, responseUrl) {
    return {
      text: 'Slack integration is being set up. Please check back soon!',
      response_type: 'ephemeral'
    };
  }

  async handleInteraction(payload) {
    return { text: 'Interaction received' };
  }

  async handleOAuthCallback(code) {
    return {
      teamId: 'temp',
      teamName: 'Temporary Team'
    };
  }

  async sendMessage(channel, text) {
    console.log('Slack message sending disabled - install dependencies to enable');
    return true;
  }

  async sendDirectMessage(userId, message) {
    console.log('Slack DM sending disabled - install dependencies to enable');
    return true;
  }

  async sendDelayedResponse(responseUrl, message) {
    console.log('Slack delayed response disabled - install dependencies to enable');
    // Try to send response using axios which is already installed
    try {
      const axios = require('axios');
      await axios.post(responseUrl, message);
      return true;
    } catch (error) {
      console.error('Error sending delayed response:', error);
      return false;
    }
  }

  getStatus() {
    return {
      configured: false,
      connected: false,
      features: {
        surveys: false,
        quickCheckIn: false,
        reminders: false,
        interactiveMessages: false,
        slashCommands: false
      }
    };
  }
}

module.exports = new SlackService();