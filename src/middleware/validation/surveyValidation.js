const { body, validationResult } = require('express-validator');
const { sendErrorResponse } = require('../../utils/responseUtils');

const validateSurvey = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),

  body('type')
    .isIn(['pulse', 'onboarding', 'feedback', 'custom'])
    .withMessage('Invalid survey type'),

  body('questions')
    .isArray({ min: 1 })
    .withMessage('At least one question is required'),

  body('questions.*.question')
    .trim()
    .notEmpty()
    .withMessage('Question text is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Question must be between 5 and 200 characters'),

  body('questions.*.type')
    .isIn(['scale', 'multiple_choice', 'checkbox', 'text', 'boolean'])
    .withMessage('Invalid question type'),

  body('schedule.frequency')
    .optional()
    .isIn(['weekly', 'biweekly', 'monthly', 'once'])
    .withMessage('Invalid frequency'),

  body('schedule.dayOfWeek')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 and 6'),

  body('schedule.startDate')
    .isISO8601()
    .withMessage('Invalid start date format'),

  body('rewards.happyCoins')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Happy coins must be between 0 and 1000'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return sendErrorResponse(res, errorMessages, 400);
    }

    const { questions } = req.body;
    
    for (const question of questions) {
      if (question.type === 'scale') {
        if (!question.scale || typeof question.scale.min !== 'number' || typeof question.scale.max !== 'number') {
          return sendErrorResponse(res, 'Scale questions must have min and max values', 400);
        }
        if (question.scale.min >= question.scale.max) {
          return sendErrorResponse(res, 'Scale min value must be less than max value', 400);
        }
      }

      if (['multiple_choice', 'checkbox'].includes(question.type)) {
        if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
          return sendErrorResponse(res, `${question.type} questions must have at least 2 options`, 400);
        }
      }
    }

    next();
  }
];

const validateSurveyResponse = [
  body('answers')
    .isObject()
    .withMessage('Answers must be an object')
    .custom((answers) => {
      if (Object.keys(answers).length === 0) {
        throw new Error('At least one answer is required');
      }
      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return sendErrorResponse(res, errorMessages, 400);
    }
    next();
  }
];

const validateSurveyDistribution = [
  body('recipientType')
    .isIn(['all', 'departments', 'individuals'])
    .withMessage('Invalid recipient type. Must be "all", "departments", or "individuals"'),

  body('recipientIds')
    .optional()
    .isArray()
    .withMessage('Recipient IDs must be an array')
    .custom((value, { req }) => {
      if (req.body.recipientType !== 'all' && (!value || value.length === 0)) {
        throw new Error('Recipient IDs are required for selected recipient type');
      }
      return true;
    }),

  body('channels')
    .optional()
    .isArray()
    .withMessage('Channels must be an array')
    .custom((value) => {
      const validChannels = ['email', 'slack'];
      if (value && !value.every(channel => validChannels.includes(channel))) {
        throw new Error('Invalid channel. Must be "email" or "slack"');
      }
      return true;
    }),

  body('scheduledFor')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be in ISO8601 format')
    .custom((value) => {
      if (value && new Date(value) <= new Date()) {
        throw new Error('Scheduled date must be in the future');
      }
      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return sendErrorResponse(res, errorMessages, 400);
    }
    next();
  }
];

module.exports = {
  validateSurvey,
  validateSurveyResponse,
  validateSurveyDistribution
};