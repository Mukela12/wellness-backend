const { body, validationResult } = require('express-validator');
const { sendErrorResponse } = require('../../utils/responseUtils');

const validateReward = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Reward name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Reward name must be between 3 and 100 characters'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),

  body('category')
    .isIn(['wellness', 'food', 'entertainment', 'fitness', 'education', 'merchandise', 'experience', 'donation'])
    .withMessage('Invalid reward category'),

  body('type')
    .isIn(['physical', 'digital', 'service', 'discount', 'voucher'])
    .withMessage('Invalid reward type'),

  body('cost')
    .isInt({ min: 1, max: 50000 })
    .withMessage('Cost must be between 1 and 50000 Happy Coins'),

  body('value')
    .isNumeric()
    .withMessage('Value must be a number')
    .custom((value) => {
      if (value <= 0) {
        throw new Error('Value must be greater than 0');
      }
      return true;
    }),

  body('availability.quantity')
    .optional()
    .isInt({ min: -1 })
    .withMessage('Quantity must be -1 (unlimited) or positive number'),

  body('availability.startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),

  body('availability.endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),

  body('redemptionDetails.expiryDays')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Expiry days must be between 1 and 365'),

  body('merchant.name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Merchant name must be between 1 and 100 characters'),

  body('merchant.website')
    .optional()
    .isURL()
    .withMessage('Merchant website must be a valid URL'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return sendErrorResponse(res, errorMessages, 400);
    }

    const { availability } = req.body;
    
    if (availability && availability.startDate && availability.endDate) {
      if (new Date(availability.endDate) <= new Date(availability.startDate)) {
        return sendErrorResponse(res, 'End date must be after start date', 400);
      }
    }

    next();
  }
];

const validateRedemption = [
  body('fulfillmentMethod')
    .isIn(['email', 'pickup', 'delivery', 'digital'])
    .withMessage('Invalid fulfillment method'),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number format'),

  body('address.street')
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage('Street address must be between 5 and 200 characters'),

  body('address.city')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),

  body('address.zipCode')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('Zip code must be between 3 and 20 characters'),

  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return sendErrorResponse(res, errorMessages, 400);
    }

    const { fulfillmentMethod, address, email } = req.body;
    
    if (fulfillmentMethod === 'delivery' && (!address || !address.street || !address.city)) {
      return sendErrorResponse(res, 'Delivery address is required for delivery fulfillment', 400);
    }

    if (fulfillmentMethod === 'email' && !email) {
      return sendErrorResponse(res, 'Email is required for email fulfillment', 400);
    }

    next();
  }
];

const validateRecognition = [
  body('toUserId')
    .isMongoId()
    .withMessage('Invalid recipient user ID'),

  body('type')
    .isIn(['kudos', 'thank_you', 'great_job', 'team_player', 'innovation', 'leadership'])
    .withMessage('Invalid recognition type'),

  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Message must be between 10 and 500 characters'),

  body('category')
    .optional()
    .isIn(['collaboration', 'innovation', 'leadership', 'support', 'achievement', 'other'])
    .withMessage('Invalid recognition category'),

  body('visibility')
    .optional()
    .isIn(['public', 'team', 'private'])
    .withMessage('Invalid visibility setting'),

  body('isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('isAnonymous must be a boolean'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return sendErrorResponse(res, errorMessages, 400);
    }
    next();
  }
];

const validateAchievement = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Achievement name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Achievement name must be between 3 and 100 characters'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 300 })
    .withMessage('Description must be between 10 and 300 characters'),

  body('category')
    .isIn(['streak', 'checkin', 'mood', 'engagement', 'milestone', 'special'])
    .withMessage('Invalid achievement category'),

  body('icon')
    .trim()
    .notEmpty()
    .withMessage('Icon is required'),

  body('criteria.type')
    .isIn(['streak_days', 'total_checkins', 'consecutive_good_mood', 'survey_completion', 'peer_recognition', 'custom'])
    .withMessage('Invalid criteria type'),

  body('criteria.value')
    .isInt({ min: 1 })
    .withMessage('Criteria value must be a positive integer'),

  body('rarity')
    .optional()
    .isIn(['common', 'rare', 'epic', 'legendary'])
    .withMessage('Invalid rarity level'),

  body('happyCoinsReward')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Happy Coins reward must be between 0 and 1000'),

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
  validateReward,
  validateRedemption,
  validateRecognition,
  validateAchievement
};