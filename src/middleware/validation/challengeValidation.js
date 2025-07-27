const { body, validationResult } = require('express-validator');
const { sendErrorResponse } = require('../../utils/responseUtils');

const validateChallenge = [
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
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),

  body('category')
    .isIn(['mindfulness', 'fitness', 'nutrition', 'sleep', 'social', 'learning', 'habit', 'team'])
    .withMessage('Invalid challenge category'),

  body('type')
    .isIn(['individual', 'team', 'company_wide'])
    .withMessage('Invalid challenge type'),

  body('difficulty')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Invalid difficulty level'),

  body('duration.days')
    .isInt({ min: 1, max: 365 })
    .withMessage('Duration must be between 1 and 365 days'),

  body('duration.startDate')
    .isISO8601()
    .withMessage('Invalid start date format'),

  body('duration.endDate')
    .isISO8601()
    .withMessage('Invalid end date format'),

  body('goal.type')
    .isIn(['checkin_streak', 'mood_average', 'total_checkins', 'habit_completion', 'peer_recognition', 'custom'])
    .withMessage('Invalid goal type'),

  body('goal.target')
    .isNumeric()
    .withMessage('Goal target must be a number')
    .custom((value) => {
      if (value <= 0) {
        throw new Error('Goal target must be greater than 0');
      }
      return true;
    }),

  body('rewards.completion.happyCoins')
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage('Completion reward must be between 0 and 10000 Happy Coins'),

  body('maxParticipants')
    .optional()
    .isInt({ min: -1 })
    .withMessage('Max participants must be -1 (unlimited) or positive number'),

  body('milestones')
    .optional()
    .isArray()
    .withMessage('Milestones must be an array'),

  body('milestones.*.percentage')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Milestone percentage must be between 1 and 100'),

  body('milestones.*.reward.happyCoins')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Milestone reward must be between 0 and 1000 Happy Coins'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return sendErrorResponse(res, errorMessages, 400);
    }

    const { duration, milestones } = req.body;
    
    if (new Date(duration.endDate) <= new Date(duration.startDate)) {
      return sendErrorResponse(res, 'End date must be after start date', 400);
    }

    const startDate = new Date(duration.startDate);
    const endDate = new Date(duration.endDate);
    const actualDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    if (actualDays !== duration.days) {
      return sendErrorResponse(res, 'Duration days must match the difference between start and end dates', 400);
    }

    if (milestones && milestones.length > 0) {
      const percentages = milestones.map(m => m.percentage).sort((a, b) => a - b);
      const uniquePercentages = [...new Set(percentages)];
      
      if (percentages.length !== uniquePercentages.length) {
        return sendErrorResponse(res, 'Milestone percentages must be unique', 400);
      }
    }

    next();
  }
];

const validateChallengeProgress = [
  body('current')
    .isNumeric()
    .withMessage('Current progress must be a number')
    .custom((value) => {
      if (value < 0) {
        throw new Error('Progress cannot be negative');
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
  validateChallenge,
  validateChallengeProgress
};