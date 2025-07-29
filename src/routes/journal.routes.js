const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journal.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { body, query, param } = require('express-validator');

// All journal routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/journals
 * @desc    Get user's journal entries with pagination and filtering
 * @access  Private (Employee)
 * @query   {
 *   page: number,
 *   limit: number,
 *   category: string,
 *   mood: number,
 *   startDate: string,
 *   endDate: string,
 *   tags: string,
 *   search: string
 * }
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isIn(['personal', 'work', 'wellness', 'goals', 'gratitude', 'challenges', 'reflection']),
  query('mood').optional().isInt({ min: 1, max: 5 }).withMessage('Mood must be between 1 and 5'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date'),
  journalController.getJournals
);

/**
 * @route   POST /api/journals
 * @desc    Create a new journal entry
 * @access  Private (Employee)
 * @body    {
 *   title: string,
 *   content: string,
 *   mood: number,
 *   category?: string,
 *   tags?: string[],
 *   privacy?: string,
 *   aiPromptId?: string
 * }
 */
router.post('/',
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters')
    .trim(),
  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 10, max: 10000 })
    .withMessage('Content must be between 10 and 10,000 characters')
    .trim(),
  body('mood')
    .isInt({ min: 1, max: 5 })
    .withMessage('Mood must be between 1 and 5'),
  body('category')
    .optional()
    .isIn(['personal', 'work', 'wellness', 'goals', 'gratitude', 'challenges', 'reflection'])
    .withMessage('Invalid category'),
  body('privacy')
    .optional()
    .isIn(['private', 'anonymous_share', 'team_share'])
    .withMessage('Invalid privacy setting'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  journalController.createJournal
);

/**
 * @route   GET /api/journals/stats
 * @desc    Get user's journaling statistics
 * @access  Private (Employee)
 * @query   { 
 *   startDate?: string, 
 *   endDate?: string,
 *   period?: string // 'week', 'month', 'quarter', 'year'
 * }
 */
router.get('/stats',
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date'),  
  query('period').optional().isIn(['week', 'month', 'quarter', 'year']).withMessage('Invalid period'),
  journalController.getJournalingStats
);

/**
 * @route   GET /api/journals/prompts
 * @desc    Get AI-generated writing prompts based on user's mood and history
 * @access  Private (Employee)
 * @query   {
 *   type?: string, // 'reflection', 'gratitude', 'goal-setting', etc.
 *   mood?: number,
 *   count?: number
 * }
 */
router.get('/prompts',
  query('type')
    .optional()
    .isIn(['reflection', 'gratitude', 'goal-setting', 'stress-relief', 'mindfulness', 'creativity', 'growth', 'challenge'])
    .withMessage('Invalid prompt type'),
  query('mood')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Mood must be between 1 and 5'),
  query('count')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Count must be between 1 and 10'),
  journalController.getAIPrompts
);

/**
 * @route   GET /api/journals/insights
 * @desc    Get AI-powered insights from user's journal entries
 * @access  Private (Employee)
 * @query   { days?: number }
 */
router.get('/insights',
  query('days')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Days must be between 1 and 90'),
  journalController.getJournalInsights
);

/**
 * @route   GET /api/journals/streak
 * @desc    Get user's journaling streak information
 * @access  Private (Employee)
 */
router.get('/streak', journalController.getJournalingStreak);

/**
 * @route   GET /api/journals/search
 * @desc    Search through user's journal entries
 * @access  Private (Employee)
 * @query   {
 *   q: string,
 *   page?: number,
 *   limit?: number,
 *   category?: string,
 *   mood?: number
 * }
 */
router.get('/search',
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  journalController.searchJournals
);

/**
 * @route   GET /api/journals/:id
 * @desc    Get a specific journal entry
 * @access  Private (Employee - own entries only)
 */
router.get('/:id',
  param('id').isMongoId().withMessage('Invalid journal ID'),
  journalController.getJournal
);

/**
 * @route   PUT /api/journals/:id
 * @desc    Update a journal entry (within 24 hours of creation)
 * @access  Private (Employee - own entries only)
 * @body    {
 *   title?: string,
 *   content?: string,
 *   mood?: number,
 *   category?: string,
 *   tags?: string[],
 *   privacy?: string
 * }
 */
router.put('/:id',
  param('id').isMongoId().withMessage('Invalid journal ID'),
  body('title')
    .optional()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters')
    .trim(),
  body('content')
    .optional()
    .isLength({ min: 10, max: 10000 })
    .withMessage('Content must be between 10 and 10,000 characters')
    .trim(),
  body('mood')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Mood must be between 1 and 5'),
  body('category')
    .optional()
    .isIn(['personal', 'work', 'wellness', 'goals', 'gratitude', 'challenges', 'reflection'])
    .withMessage('Invalid category'),
  body('privacy')
    .optional()
    .isIn(['private', 'anonymous_share', 'team_share'])
    .withMessage('Invalid privacy setting'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  journalController.updateJournal
);

/**
 * @route   DELETE /api/journals/:id
 * @desc    Delete (soft delete) a journal entry
 * @access  Private (Employee - own entries only)
 */
router.delete('/:id',
  param('id').isMongoId().withMessage('Invalid journal ID'),
  journalController.deleteJournal
);

/**
 * @route   POST /api/journals/:id/analyze
 * @desc    Request AI analysis of a specific journal entry
 * @access  Private (Employee - own entries only)
 */
router.post('/:id/analyze',
  param('id').isMongoId().withMessage('Invalid journal ID'),
  journalController.analyzeJournalEntry
);

/**
 * @route   GET /api/journals/export/data
 * @desc    Export user's journal data
 * @access  Private (Employee)
 * @query   {
 *   format?: string, // 'json', 'csv', 'txt'
 *   startDate?: string,
 *   endDate?: string
 * }
 */
router.get('/export/data',
  query('format')
    .optional()
    .isIn(['json', 'csv', 'txt'])
    .withMessage('Format must be json, csv, or txt'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date'),
  journalController.exportJournalData
);

/**
 * @route   POST /api/journals/import/data
 * @desc    Import journal data (for data migration)
 * @access  Private (Employee)
 * @body    { entries: array }
 */
router.post('/import/data',
  body('entries')
    .isArray()
    .withMessage('Entries must be an array')
    .custom((entries) => {
      if (entries.length > 100) {
        throw new Error('Cannot import more than 100 entries at once');
      }
      return true;
    }),
  journalController.importJournalData
);

// Admin/HR routes for analytics (separate from user-specific routes)
/**
 * @route   GET /api/journals/admin/overview
 * @desc    Get journaling system overview (Admin/HR only)
 * @access  Private (Admin/HR)
 */
router.get('/admin/overview',
  authorize(['admin', 'hr']),
  journalController.getJournalingOverview
);

/**
 * @route   GET /api/journals/admin/trends
 * @desc    Get journaling trends and patterns (Admin/HR only)
 * @access  Private (Admin/HR)
 */
router.get('/admin/trends',
  authorize(['admin', 'hr']),
  journalController.getJournalingTrends
);

module.exports = router;