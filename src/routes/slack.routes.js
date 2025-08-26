const express = require('express');
const router = express.Router();
const slackController = require('../controllers/slack.controller');

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
router.post('/events', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Convert raw buffer to string and parse
  req.rawBody = req.body.toString();
  try {
    req.body = JSON.parse(req.rawBody);
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }
  next();
}, slackController.handleEvents);

// Slack slash commands
router.post('/commands', express.urlencoded({ extended: true }), rawBodyMiddleware, slackController.handleCommands);

// Slack interactive components
router.post('/interactions', express.urlencoded({ extended: true }), rawBodyMiddleware, slackController.handleInteractions);

// OAuth callback
router.get('/oauth/callback', slackController.handleOAuthCallback);

module.exports = router;