const express = require('express');
const router = express.Router();
const integrationsController = require('../controllers/integrations.controller');
const { authenticate } = require('../middleware/auth');

// Quick connect for testing (no auth required temporarily)
router.post('/slack/quick-connect', integrationsController.quickConnectSlack);

// Protected routes - require authentication
router.get('/status', authenticate, integrationsController.getIntegrationStatus);

// Slack integration
router.get('/slack/status', authenticate, integrationsController.getSlackStatus);
router.get('/slack/oauth-url', authenticate, integrationsController.getSlackOAuthUrl);
router.post('/slack/connect', authenticate, integrationsController.connectSlack);
router.post('/slack/disconnect', authenticate, integrationsController.disconnectSlack);

// Notification preferences
router.patch('/notifications/preferences', authenticate, integrationsController.updateNotificationPreferences);

module.exports = router;