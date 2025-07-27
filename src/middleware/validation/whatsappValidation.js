const { body, validationResult } = require('express-validator');

// Validation for sending WhatsApp messages
const sendMessage = [
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in valid international format'),
    
  body('message')
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ min: 1, max: 4096 })
    .withMessage('Message must be between 1 and 4096 characters'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

// Validation for WhatsApp settings update
const updateSettings = [
  body('phoneNumber')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in valid international format'),
    
  body('enableReminders')
    .optional()
    .isBoolean()
    .withMessage('enableReminders must be a boolean'),
    
  body('preferredReminderTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Reminder time must be in HH:MM format'),
    
  body('enableWeeklySummary')
    .optional()
    .isBoolean()
    .withMessage('enableWeeklySummary must be a boolean'),
    
  body('enableChallengeUpdates')
    .optional()
    .isBoolean()
    .withMessage('enableChallengeUpdates must be a boolean'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

// Validation for phone number verification
const verifyPhoneNumber = [
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in valid international format'),
    
  body('verificationCode')
    .notEmpty()
    .withMessage('Verification code is required')
    .isLength({ min: 4, max: 6 })
    .withMessage('Verification code must be 4-6 digits')
    .isNumeric()
    .withMessage('Verification code must contain only numbers'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  sendMessage,
  updateSettings,
  verifyPhoneNumber
};