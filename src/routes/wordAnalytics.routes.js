const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const { authenticate: auth, authorize } = require('../middleware/auth');
const wordAnalyticsController = require('../controllers/wordAnalytics.controller');

// Validation rules
const dateValidation = [
  query('startDate').optional().isISO8601().toDate().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().toDate().withMessage('Invalid end date format')
];

const departmentValidation = [
  query('departments').optional().custom((value) => {
    if (typeof value === 'string') return true;
    if (Array.isArray(value)) return value.every(d => typeof d === 'string');
    throw new Error('Departments must be string or array of strings');
  })
];

// Company-wide word cloud with AI insights
router.get('/word-cloud', 
  auth, 
  authorize(['hr', 'admin']),
  [
    ...dateValidation,
    ...departmentValidation,
    query('sourceTypes').optional().custom((value) => {
      const validTypes = ['journal', 'survey', 'checkin'];
      if (typeof value === 'string') return validTypes.includes(value);
      if (Array.isArray(value)) return value.every(t => validTypes.includes(t));
      throw new Error('Invalid source types');
    }),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
    query('minOccurrences').optional().isInt({ min: 1, max: 50 }).withMessage('Min occurrences must be between 1 and 50'),
    query('timeframe').optional().isString().withMessage('Timeframe must be a string')
  ],
  wordAnalyticsController.getCompanyWordCloud
);

// User-specific word cloud
router.get('/users/:userId/word-cloud',
  auth,
  authorize(['hr', 'admin', 'manager']),
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    ...dateValidation,
    query('sourceTypes').optional().custom((value) => {
      const validTypes = ['journal', 'survey', 'checkin'];
      if (typeof value === 'string') return validTypes.includes(value);
      if (Array.isArray(value)) return value.every(t => validTypes.includes(t));
      throw new Error('Invalid source types');
    }),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  wordAnalyticsController.getUserWordCloud
);

// Department word trends
router.get('/departments/:department/trends',
  auth,
  authorize(['hr', 'admin']),
  [
    param('department').notEmpty().withMessage('Department is required'),
    ...dateValidation,
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  wordAnalyticsController.getDepartmentWordTrends
);

// Word analytics summary
router.get('/summary',
  auth,
  authorize(['hr', 'admin']),
  [
    ...dateValidation,
    query('department').optional().isString().withMessage('Department must be a string')
  ],
  wordAnalyticsController.getWordAnalyticsSummary
);

// Top themes across company
router.get('/themes',
  auth,
  authorize(['hr', 'admin']),
  [
    ...dateValidation,
    query('department').optional().isString().withMessage('Department must be a string'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  wordAnalyticsController.getTopThemes
);

// Process existing data (admin only)
router.post('/process-existing',
  auth,
  authorize(['admin', 'hr']),
  [
    body('dataTypes').optional().isArray().withMessage('Data types must be an array')
      .custom((value) => {
        const validTypes = ['journals', 'surveys', 'checkins'];
        return value.every(type => validTypes.includes(type));
      }).withMessage('Invalid data types')
  ],
  wordAnalyticsController.processExistingData
);

module.exports = router;