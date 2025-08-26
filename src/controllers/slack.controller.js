const slackService = require('../services/slack/slack.service');
const slackSurveyService = require('../services/slack/slackSurvey.service');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');

const slackController = {
  // Handle Slack events (including verification challenge)
  async handleEvents(req, res) {
    try {
      console.log('Slack event received:', {
        headers: req.headers,
        body: req.body,
        rawBody: req.rawBody ? 'present' : 'missing'
      });
      
      // Handle URL verification challenge from Slack
      if (req.body && req.body.challenge) {
        console.log('Slack URL verification challenge received:', req.body.challenge);
        // Return just the challenge value as plain text
        return res.type('text/plain').send(req.body.challenge);
      }

      // Verify the request is from Slack (skip for challenge)
      if (!req.body.challenge && !slackService.verifySlackRequest(req)) {
        console.error('Invalid Slack request signature');
        return res.status(401).send('Unauthorized');
      }

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
      console.log('Slash command received:', req.body.command);
      
      // Verify the request is from Slack
      if (!slackService.verifySlackRequest(req)) {
        console.error('Failed signature verification');
        return res.status(401).send('Unauthorized');
      }

      const { command, text, user_id, response_url } = req.body;
      
      // Send immediate acknowledgment to avoid timeout
      res.status(200).send();
      
      // Process the command asynchronously
      let result;
      
      try {
        switch (command) {
          case '/wellness-survey':
            result = await slackSurveyService.handleSurveyCommand(user_id, text);
            break;
          case '/quick-checkin':
            result = await slackSurveyService.handleQuickCheckInCommand(user_id);
            break;
          default:
            result = {
              text: `Unknown command: ${command}`,
              response_type: 'ephemeral'
            };
        }
        
        // Send the actual response via response_url
        if (result && response_url) {
          await slackService.sendDelayedResponse(response_url, result);
        }
      } catch (error) {
        console.error('Error processing command:', error);
        // Send error message if something goes wrong
        if (response_url) {
          await slackService.sendDelayedResponse(response_url, {
            text: 'Sorry, something went wrong. Please try again.',
            response_type: 'ephemeral'
          });
        }
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
      
      // Verify the request is from Slack
      req.body = payload; // Replace body with parsed payload for verification
      if (!slackService.verifySlackRequest(req)) {
        return res.status(401).send('Unauthorized');
      }

      // Acknowledge the interaction immediately
      res.status(200).send();

      // Handle the interaction
      let result;
      
      // Check if it's a survey-related interaction
      if (payload.actions && payload.actions[0]) {
        const action = payload.actions[0];
        
        if (action.action_id.startsWith('quick_mood_')) {
          result = await slackSurveyService.handleQuickMoodResponse(payload);
        } else if (action.action_id.startsWith('q_') || 
                   action.action_id === 'submit_survey' || 
                   action.action_id === 'cancel_survey' ||
                   action.action_id.startsWith('start_survey_')) {
          result = await slackSurveyService.handleSurveyResponse(payload);
        } else {
          result = await slackService.handleInteraction(payload);
        }
      } else {
        result = await slackService.handleInteraction(payload);
      }
      
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