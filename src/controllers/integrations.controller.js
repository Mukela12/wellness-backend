const User = require('../models/User');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');

const integrationsController = {
  // Connect Slack account
  async connectSlack(req, res) {
    try {
      const { slackUserId, teamId, teamName } = req.body;
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      // Update user's Slack integration
      user.integrations = user.integrations || {};
      user.integrations.slack = {
        userId: slackUserId,
        teamId,
        teamName,
        isConnected: true,
        connectedAt: new Date()
      };

      await user.save();

      sendSuccessResponse(res, {
        message: 'Slack account connected successfully',
        data: {
          slack: user.integrations.slack
        }
      });
    } catch (error) {
      console.error('Connect Slack error:', error);
      sendErrorResponse(res, 'Failed to connect Slack account', 500);
    }
  },

  // Disconnect Slack account
  async disconnectSlack(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      // Clear Slack integration
      if (user.integrations && user.integrations.slack) {
        user.integrations.slack = {
          isConnected: false
        };
        await user.save();
      }

      sendSuccessResponse(res, {
        message: 'Slack account disconnected successfully'
      });
    } catch (error) {
      console.error('Disconnect Slack error:', error);
      sendErrorResponse(res, 'Failed to disconnect Slack account', 500);
    }
  },

  // Get integration status
  async getIntegrationStatus(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId).select('integrations');
      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      const status = {
        slack: {
          connected: user.integrations?.slack?.isConnected || false,
          teamName: user.integrations?.slack?.teamName || null,
          connectedAt: user.integrations?.slack?.connectedAt || null
        },
        teams: {
          connected: user.integrations?.teams?.isConnected || false,
          connectedAt: user.integrations?.teams?.connectedAt || null
        },
        whatsapp: {
          connected: !!user.phone,
          phone: user.phone || null
        }
      };

      sendSuccessResponse(res, {
        message: 'Integration status retrieved successfully',
        data: status
      });
    } catch (error) {
      console.error('Get integration status error:', error);
      sendErrorResponse(res, 'Failed to retrieve integration status', 500);
    }
  },

  // Generate Slack OAuth URL
  async getSlackOAuthUrl(req, res) {
    try {
      const clientId = process.env.SLACK_CLIENT_ID;
      const redirectUri = process.env.SLACK_REDIRECT_URI;
      
      if (!clientId || !redirectUri) {
        return sendErrorResponse(res, 'Slack integration not configured', 501);
      }

      // Slack OAuth scopes needed
      const scopes = [
        'channels:read',
        'chat:write',
        'commands',
        'im:read',
        'im:write',
        'im:history',
        'users:read',
        'users:read.email'
      ];

      const state = Buffer.from(JSON.stringify({
        userId: req.user.id,
        timestamp: Date.now()
      })).toString('base64');

      const oauthUrl = `https://slack.com/oauth/v2/authorize?` +
        `client_id=${clientId}&` +
        `scope=${scopes.join(',')}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}`;

      sendSuccessResponse(res, {
        message: 'Slack OAuth URL generated',
        data: {
          url: oauthUrl
        }
      });
    } catch (error) {
      console.error('Get Slack OAuth URL error:', error);
      sendErrorResponse(res, 'Failed to generate Slack OAuth URL', 500);
    }
  },

  // Update notification preferences
  async updateNotificationPreferences(req, res) {
    try {
      const userId = req.user.id;
      const { preferredChannel, checkInReminder, surveyReminder, rewardUpdates, reminderTime } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      // Update notification preferences
      if (preferredChannel) user.notifications.preferredChannel = preferredChannel;
      if (checkInReminder !== undefined) user.notifications.checkInReminder = checkInReminder;
      if (surveyReminder !== undefined) user.notifications.surveyReminder = surveyReminder;
      if (rewardUpdates !== undefined) user.notifications.rewardUpdates = rewardUpdates;
      if (reminderTime) user.notifications.reminderTime = reminderTime;

      await user.save();

      sendSuccessResponse(res, {
        message: 'Notification preferences updated successfully',
        data: user.notifications
      });
    } catch (error) {
      console.error('Update notification preferences error:', error);
      sendErrorResponse(res, 'Failed to update notification preferences', 500);
    }
  }
};

module.exports = integrationsController;