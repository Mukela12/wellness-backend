const express = require('express');
const router = express.Router();
const integrationsController = require('../controllers/integrations.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get integration status for current user
router.get('/status', integrationsController.getIntegrationStatus);

// Slack integration
router.get('/slack/oauth-url', integrationsController.getSlackOAuthUrl);
router.post('/slack/connect', integrationsController.connectSlack);
router.post('/slack/disconnect', integrationsController.disconnectSlack);

// Quick connect for testing (no auth required temporarily)
router.post('/slack/quick-connect', integrationsController.quickConnectSlack);

// Notification preferences
router.patch('/notifications/preferences', integrationsController.updateNotificationPreferences);

module.exports = router;