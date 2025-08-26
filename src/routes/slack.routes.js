const express = require('express');
const router = express.Router();
const slackController = require('../controllers/slack.controller');

// Test endpoint to verify Slack routes are working
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Slack routes are working',
    timestamp: new Date().toISOString()
  });
});

// Direct test for commands
router.post('/commands-test', (req, res) => {
  console.log('Commands test endpoint hit');
  res.json({
    response_type: 'ephemeral',
    text: 'Commands test endpoint working'
  });
});

// Middleware to capture raw body for signature verification
const rawBodyMiddleware = (req, res, next) => {
  let data = '';
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
};

// Slack event subscriptions (includes URL verification)
router.post('/events', (req, res, next) => {
  // rawBody is already set by global middleware
  // Just ensure req.body is properly parsed
  if (!req.body && req.rawBody) {
    try {
      req.body = JSON.parse(req.rawBody.toString());
    } catch (e) {
      return res.status(400).send('Invalid JSON');
    }
  }
  next();
}, slackController.handleEvents);

// Slack slash commands
router.post('/commands', express.urlencoded({ 
  extended: true,
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}), slackController.handleCommands);

// Slack interactive components
router.post('/interactions', express.urlencoded({ 
  extended: true,
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}), slackController.handleInteractions);

// OAuth callback
router.get('/oauth/callback', slackController.handleOAuthCallback);

module.exports = router;