const { body, validationResult } = require('express-validator');
const { sendErrorResponse } = require('../../utils/responseUtils');

const validateResource = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),

  body('type')
    .isIn(['article', 'video', 'audio', 'infographic', 'checklist', 'worksheet', 'guide', 'podcast'])
    .withMessage('Invalid resource type'),

  body('category')
    .isIn(['mental_health', 'stress_management', 'mindfulness', 'fitness', 'nutrition', 'sleep', 'work_life_balance', 'team_building', 'leadership', 'productivity'])
    .withMessage('Invalid resource category'),

  body('difficulty')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Invalid difficulty level'),

  body('readingTime')
    .optional()
    .isInt({ min: 1, max: 300 })
    .withMessage('Reading time must be between 1 and 300 minutes'),

  body('content.url')
    .optional()
    .isURL()
    .withMessage('Content URL must be a valid URL'),

  body('content.duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Content duration must be a positive number'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),

  body('author.name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Author name must be between 1 and 100 characters'),

  body('source.credibility')
    .optional()
    .isIn(['verified', 'trusted', 'community'])
    .withMessage('Invalid source credibility level'),

  body('language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language code must be between 2 and 5 characters'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return sendErrorResponse(res, errorMessages, 400);
    }

    const { content, type } = req.body;
    
    if (['video', 'audio'].includes(type) && content && !content.duration) {
      return sendErrorResponse(res, `${type} resources must include duration`, 400);
    }

    if (type === 'article' && content && !content.body && !content.url) {
      return sendErrorResponse(res, 'Article resources must include either body content or URL', 400);
    }

    next();
  }
];

const validateResourceInteraction = [
  body('action')
    .isIn(['like', 'complete', 'bookmark', 'download', 'rate', 'update_progress', 'add_notes'])
    .withMessage('Invalid interaction action'),

  body('data.rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),

  body('data.percentage')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Progress percentage must be between 0 and 100'),

  body('data.timeSpent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Time spent must be a positive number'),

  body('data.feedback')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Feedback must be less than 500 characters'),

  body('data.notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return sendErrorResponse(res, errorMessages, 400);
    }

    const { action, data } = req.body;
    
    if (action === 'rate' && (!data || !data.rating)) {
      return sendErrorResponse(res, 'Rating action requires rating data', 400);
    }

    if (action === 'update_progress' && (!data || (data.percentage === undefined && !data.timeSpent && !data.lastPosition))) {
      return sendErrorResponse(res, 'Update progress action requires progress data', 400);
    }

    if (action === 'add_notes' && (!data || !data.notes)) {
      return sendErrorResponse(res, 'Add notes action requires notes data', 400);
    }

    next();
  }
];

module.exports = {
  validateResource,
  validateResourceInteraction
};