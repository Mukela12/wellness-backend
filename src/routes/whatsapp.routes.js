const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsapp/whatsapp.service');
const { authenticate, authorize } = require('../middleware/auth');
const { validateWhatsApp } = require('../middleware/validation');

/**
 * @route   GET /api/whatsapp/webhook
 * @desc    Verify webhook for Meta
 * @access  Public
 */
router.get('/webhook', (req, res) => {
  try {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    
    const result = whatsappService.verifyWebhook(mode, token, challenge);
    
    if (result) {
      res.status(200).send(result);
    } else {
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.status(403).send('Forbidden');
  }
});

/**
 * @route   POST /api/whatsapp/webhook
 * @desc    Handle incoming WhatsApp messages and status updates
 * @access  Public (verified by signature)
 */
router.post('/webhook', async (req, res) => {
  try {
    // Immediately respond to Meta
    res.status(200).send('EVENT_RECEIVED');
    
    // Process webhook asynchronously
    await whatsappService.handleWebhook(req.body);
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent Meta from retrying
    res.status(200).send('EVENT_RECEIVED');
  }
});

/**
 * @route   POST /api/whatsapp/send-message
 * @desc    Send a WhatsApp message
 * @access  Private (Admin/HR only)
 */
router.post(
  '/send-message',
  authenticate,
  authorize('hr', 'admin'),
  validateWhatsApp.sendMessage,
  async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;
      
      const result = await whatsappService.sendTextMessage(phoneNumber, message);
      
      res.json({
        success: true,
        message: 'Message sent successfully',
        data: {
          messageId: result.messages[0].id,
          phoneNumber
        }
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/whatsapp/send-reminder
 * @desc    Send check-in reminder to a user
 * @access  Private (System/Admin)
 */
router.post(
  '/send-reminder',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { userId, reminderType = 'daily_checkin' } = req.body;
      
      let result;
      if (reminderType === 'daily_checkin') {
        result = await whatsappService.sendDailyCheckInReminder(userId);
      } else {
        throw new Error('Invalid reminder type');
      }
      
      res.json({
        success: true,
        message: 'Reminder sent successfully',
        data: {
          userId,
          reminderType,
          messageId: result.messages[0].id
        }
      });
    } catch (error) {
      console.error('Send reminder error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send reminder',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/whatsapp/send-report
 * @desc    Send weekly report to a user
 * @access  Private (System/Admin)
 */
router.post(
  '/send-report',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { userId, reportData } = req.body;
      
      const result = await whatsappService.sendWeeklyDataReport(userId, reportData);
      
      res.json({
        success: true,
        message: 'Report sent successfully',
        data: {
          userId,
          messageId: result.messages[0].id
        }
      });
    } catch (error) {
      console.error('Send report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send report',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/whatsapp/status
 * @desc    Get WhatsApp service status
 * @access  Private
 */
router.get('/status', authenticate, (req, res) => {
  try {
    const status = whatsappService.getStatus();
    
    res.json({
      success: true,
      message: 'WhatsApp service status',
      data: status
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get status',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/whatsapp/test-template
 * @desc    Test template message (Development only)
 * @access  Private (Admin)
 */
router.post(
  '/test-template',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({
          success: false,
          message: 'Test endpoint only available in development'
        });
      }

      const { templateName, phoneNumber, variables = [] } = req.body;
      
      const result = await whatsappService.sendTemplateMessage(
        phoneNumber || '+15550267733', // Test number
        templateName,
        variables
      );
      
      res.json({
        success: true,
        message: 'Test template sent',
        data: {
          messageId: result.messages[0].id,
          template: templateName
        }
      });
    } catch (error) {
      console.error('Test template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test template',
        error: error.response?.data || error.message
      });
    }
  }
);

module.exports = router;