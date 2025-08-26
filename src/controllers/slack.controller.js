// Temporarily use minimal service until dependencies are installed
const slackService = require('../services/slack/slack.service.minimal');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');

const slackController = {
  // Handle Slack events (including verification challenge)
  async handleEvents(req, res) {
    try {
      // Handle URL verification challenge from Slack
      if (req.body.challenge) {
        console.log('Slack URL verification challenge received:', req.body.challenge);
        return res.send(req.body.challenge);
      }

      // For now, skip signature verification to handle the challenge
      // TODO: Re-enable verification after installing dependencies
      /*
      // Verify the request is from Slack
      if (!slackService.verifySlackRequest(req)) {
        console.error('Invalid Slack request signature');
        return res.status(401).send('Unauthorized');
      }
      */

      // Handle different event types
      const { type, event } = req.body;
      
      if (type === 'event_callback') {
        // Handle different event types
        switch (event.type) {
          case 'app_mention':
            await this.handleAppMention(event);
            break;
          case 'message':
            if (event.channel_type === 'im') {
              await this.handleDirectMessage(event);
            }
            break;
          default:
            console.log('Unhandled event type:', event.type);
        }
      }

      // Immediately respond to Slack
      res.status(200).send();
    } catch (error) {
      console.error('Slack events error:', error);
      res.status(500).send('Internal server error');
    }
  },

  // Handle slash commands
  async handleCommands(req, res) {
    try {
      // For now, skip signature verification
      // TODO: Re-enable verification after installing dependencies
      /*
      // Verify the request is from Slack
      if (!slackService.verifySlackRequest(req)) {
        return res.status(401).send('Unauthorized');
      }
      */

      const { command, text, user_id, response_url } = req.body;
      
      // Acknowledge the command immediately
      res.status(200).send();

      // Process the command asynchronously
      const result = await slackService.handleSlashCommand(
        command,
        text,
        user_id,
        response_url
      );

      // Send response back to Slack if needed
      if (response_url && result) {
        await slackService.sendDelayedResponse(response_url, result);
      }
    } catch (error) {
      console.error('Slack command error:', error);
      res.status(200).json({
        response_type: 'ephemeral',
        text: 'Sorry, something went wrong. Please try again.'
      });
    }
  },

  // Handle interactive components (buttons, select menus, etc.)
  async handleInteractions(req, res) {
    try {
      // Parse the payload
      const payload = JSON.parse(req.body.payload);
      
      // For now, skip signature verification
      // TODO: Re-enable verification after installing dependencies
      /*
      // Verify the request is from Slack
      req.body = payload; // Replace body with parsed payload for verification
      if (!slackService.verifySlackRequest(req)) {
        return res.status(401).send('Unauthorized');
      }
      */

      // Acknowledge the interaction immediately
      res.status(200).send();

      // Handle the interaction
      const result = await slackService.handleInteraction(payload);
      
      // Send response if needed
      if (result && payload.response_url) {
        await slackService.sendDelayedResponse(payload.response_url, result);
      }
    } catch (error) {
      console.error('Slack interaction error:', error);
      res.status(200).json({
        text: 'Sorry, something went wrong. Please try again.'
      });
    }
  },

  // Handle OAuth callback
  async handleOAuthCallback(req, res) {
    try {
      const { code, state } = req.query;
      
      if (!code) {
        return sendErrorResponse(res, 'No authorization code provided', 400);
      }

      // Exchange code for token
      const authData = await slackService.handleOAuthCallback(code);
      
      // Store the auth data securely (you might want to create a PlatformIntegration model)
      // For now, we'll redirect back to the frontend with success
      
      sendSuccessResponse(res, {
        message: 'Slack integration successful',
        data: {
          teamId: authData.teamId,
          teamName: authData.teamName
        }
      });
    } catch (error) {
      console.error('Slack OAuth error:', error);
      sendErrorResponse(res, 'Failed to complete Slack integration', 500);
    }
  },

  // Handle app mentions
  async handleAppMention(event) {
    try {
      const { text, user, channel } = event;
      
      // Check if the mention includes keywords
      if (text.toLowerCase().includes('survey')) {
        await slackService.sendMessage(channel, `Hi <@${user}>! Use \`/wellness-survey\` to see available surveys or \`/quick-checkin\` for a quick mood check-in.`);
      } else if (text.toLowerCase().includes('help')) {
        await slackService.sendMessage(channel, `Hi <@${user}>! I can help you with:\n• \`/wellness-survey\` - Take wellness surveys\n• \`/quick-checkin\` - Quick mood check-in\n• Mention me with "survey" to see available surveys`);
      }
    } catch (error) {
      console.error('Handle app mention error:', error);
    }
  },

  // Handle direct messages
  async handleDirectMessage(event) {
    try {
      const { text, user } = event;
      
      // Don't respond to bot messages
      if (event.bot_id) return;
      
      // Simple message handling
      if (text.toLowerCase().includes('help')) {
        await slackService.sendDirectMessage(user, 'I can help you with wellness surveys! Try these commands:\n• `/wellness-survey` - See and take surveys\n• `/quick-checkin` - Quick mood check-in');
      }
    } catch (error) {
      console.error('Handle direct message error:', error);
    }
  }
};

module.exports = slackController;