const { body, param, query } = require('express-validator');
const { DEPARTMENTS, MOOD_SCALE, ROLES } = require('../config/constants');

// User registration validation
const validateRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  body('employeeId')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Employee ID must be between 3 and 20 characters')
    .matches(/^[A-Za-z0-9-_]+$/)
    .withMessage('Employee ID can only contain letters, numbers, hyphens, and underscores'),

  body('department')
    .isIn(DEPARTMENTS)
    .withMessage(`Department must be one of: ${DEPARTMENTS.join(', ')}`),

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('role')
    .optional()
    .isIn(Object.values(ROLES))
    .withMessage(`Role must be one of: ${Object.values(ROLES).join(', ')}`)
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  body('remember')
    .optional()
    .isBoolean()
    .withMessage('Remember must be a boolean value')
];

// Email validation (for resend verification, forgot password)
const validateEmail = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

// Password reset validation
const validatePasswordReset = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

// Change password validation (for authenticated users)
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    })
];

// Profile update validation
const validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('department')
    .optional()
    .isIn(DEPARTMENTS)
    .withMessage(`Department must be one of: ${DEPARTMENTS.join(', ')}`),

  body('notifications.checkInReminder')
    .optional()
    .isBoolean()
    .withMessage('Check-in reminder must be a boolean'),

  body('notifications.surveyReminder')
    .optional()
    .isBoolean()
    .withMessage('Survey reminder must be a boolean'),

  body('notifications.rewardUpdates')
    .optional()
    .isBoolean()
    .withMessage('Reward updates must be a boolean'),

  body('notifications.preferredChannel')
    .optional()
    .isIn(['email', 'whatsapp', 'both'])
    .withMessage('Preferred channel must be email, whatsapp, or both'),

  body('notifications.reminderTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Reminder time must be in HH:MM format (24-hour)')
];

// Check-in validation
const validateCheckIn = [
  body('mood')
    .isInt({ min: MOOD_SCALE.MIN, max: MOOD_SCALE.MAX })
    .withMessage(`Mood must be between ${MOOD_SCALE.MIN} and ${MOOD_SCALE.MAX}`),

  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Feedback cannot exceed 500 characters'),

  body('source')
    .optional()
    .isIn(['web', 'whatsapp'])
    .withMessage('Source must be either web or whatsapp')
];

// Survey response validation
const validateSurveyResponse = [
  body('surveyType')
    .isIn(['onboarding', 'weekly_pulse', 'monthly_detailed'])
    .withMessage('Invalid survey type'),

  body('responses')
    .isObject()
    .withMessage('Responses must be an object'),

  body('responses.*')
    .custom((value, { req, location, path }) => {
      // Allow various response types based on question type
      if (typeof value === 'string' || typeof value === 'number' || Array.isArray(value)) {
        return true;
      }
      throw new Error(`Invalid response format for field`);
    })
];

// Onboarding validation
const validateOnboarding = [
  body('answers')
    .isObject()
    .withMessage('Answers must be an object'),

  body('sectionCompleted')
    .optional()
    .isString()
    .withMessage('Section completed must be a string')
];

// ID parameter validation
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),

  param('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID format')
];

// Query parameter validation for lists
const validateListQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('sort')
    .optional()
    .matches(/^-?[a-zA-Z_][a-zA-Z0-9_.]*$/)
    .withMessage('Invalid sort format'),

  query('department')
    .optional()
    .isIn(DEPARTMENTS)
    .withMessage(`Department must be one of: ${DEPARTMENTS.join(', ')}`),

  query('riskLevel')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Risk level must be low, medium, or high'),

  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be in ISO 8601 format'),

  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be in ISO 8601 format')
];

// Date range validation
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format')
    .custom((value, { req }) => {
      if (req.query.startDate && value) {
        const startDate = new Date(req.query.startDate);
        const endDate = new Date(value);
        
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
        
        // Limit date range to 1 year
        const oneYear = 365 * 24 * 60 * 60 * 1000;
        if (endDate - startDate > oneYear) {
          throw new Error('Date range cannot exceed 1 year');
        }
      }
      return true;
    })
];

// Reward redemption validation
const validateRewardRedemption = [
  body('rewardId')
    .isMongoId()
    .withMessage('Invalid reward ID format'),

  body('quantity')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Quantity must be between 1 and 10')
];

// WhatsApp webhook validation
const validateWhatsAppWebhook = [
  query('hub.mode')
    .optional()
    .equals('subscribe')
    .withMessage('Invalid webhook mode'),

  query('hub.verify_token')
    .optional()
    .notEmpty()
    .withMessage('Verification token is required'),

  query('hub.challenge')
    .optional()
    .notEmpty()
    .withMessage('Challenge is required')
];

// Profile preferences validation
const validatePreferences = [
  body('notifications.checkInReminder')
    .optional()
    .isBoolean()
    .withMessage('Check-in reminder must be a boolean'),

  body('notifications.surveyReminder')
    .optional()
    .isBoolean()
    .withMessage('Survey reminder must be a boolean'),

  body('notifications.rewardUpdates')
    .optional()
    .isBoolean()
    .withMessage('Reward updates must be a boolean'),

  body('notifications.preferredChannel')
    .optional()
    .isIn(['email', 'whatsapp', 'both'])
    .withMessage('Preferred channel must be email, whatsapp, or both'),

  body('notifications.reminderTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Reminder time must be in HH:MM format (24-hour)'),

  body('personality.interests')
    .optional()
    .isArray()
    .withMessage('Interests must be an array'),

  body('personality.interests.*')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each interest must be 1-50 characters'),

  body('personality.stressManagement')
    .optional()
    .isArray()
    .withMessage('Stress management techniques must be an array'),

  body('personality.stressManagement.*')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each stress management technique must be 1-100 characters')
];

// Wellness stats query validation
const validateWellnessStats = [
  query('period')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Period must be between 1 and 365 days')
];

// Account deletion validation
const validateAccountDeletion = [
  body('password')
    .notEmpty()
    .withMessage('Password is required to delete account')
];

// Import WhatsApp validation
const validateWhatsApp = require('./validation/whatsappValidation');

module.exports = {
  validateRegistration,
  validateLogin,
  validateEmail,
  validatePasswordReset,
  validateChangePassword,
  validateProfileUpdate,
  validateCheckIn,
  validateSurveyResponse,
  validateOnboarding,
  validateObjectId,
  validateListQuery,
  validateDateRange,
  validateRewardRedemption,
  validateWhatsAppWebhook,
  validatePreferences,
  validateWellnessStats,
  validateAccountDeletion,
  validateWhatsApp
};