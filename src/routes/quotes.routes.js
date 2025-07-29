const express = require('express');
const router = express.Router();
const quotesController = require('../controllers/quotes.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { body, query, param } = require('express-validator');

// All quotes routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/quotes/today
 * @desc    Get today's personalized motivational quote for the user
 * @access  Private (Employee)
 */
router.get('/today', quotesController.getTodayQuote);

/**
 * @route   GET /api/quotes/history
 * @desc    Get user's quote history with pagination
 * @access  Private (Employee)
 * @query   {
 *   days?: number,
 *   page?: number,
 *   limit?: number
 * }
 */
router.get('/history',
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  quotesController.getQuoteHistory
);

/**
 * @route   POST /api/quotes/:id/view
 * @desc    Mark a quote as viewed and track viewing time
 * @access  Private (Employee - own quotes only)
 * @body    { timeSpent?: number }
 */
router.post('/:id/view',
  param('id').isMongoId().withMessage('Invalid quote ID'),
  body('timeSpent')
    .optional()
    .isInt({ min: 0, max: 3600 })
    .withMessage('Time spent must be between 0 and 3600 seconds'),
  quotesController.markQuoteViewed
);

/**
 * @route   POST /api/quotes/:id/like
 * @desc    Toggle like status for a quote
 * @access  Private (Employee - own quotes only)
 */
router.post('/:id/like',
  param('id').isMongoId().withMessage('Invalid quote ID'),
  quotesController.toggleQuoteLike
);

/**
 * @route   POST /api/quotes/:id/share
 * @desc    Mark quote as shared and get shareable content
 * @access  Private (Employee - own quotes only)
 * @body    { platform?: string }
 */
router.post('/:id/share',
  param('id').isMongoId().withMessage('Invalid quote ID'),
  body('platform')
    .optional()
    .isIn(['twitter', 'linkedin', 'facebook', 'whatsapp', 'email', 'copy'])
    .withMessage('Invalid sharing platform'),
  quotesController.shareQuote
);

/**
 * @route   POST /api/quotes/:id/feedback
 * @desc    Submit feedback and rating for a quote
 * @access  Private (Employee - own quotes only)
 * @body    {
 *   rating: number,
 *   helpful?: boolean,
 *   comment?: string
 * }
 */
router.post('/:id/feedback',
  param('id').isMongoId().withMessage('Invalid quote ID'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('helpful')
    .optional()
    .isBoolean()
    .withMessage('Helpful must be a boolean'),
  body('comment')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Comment must be less than 500 characters')
    .trim(),
  quotesController.submitQuoteFeedback
);

/**
 * @route   GET /api/quotes/stats
 * @desc    Get user's quote engagement statistics
 * @access  Private (Employee)
 * @query   { days?: number }
 */
router.get('/stats',
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365'),
  quotesController.getQuoteStats
);

/**
 * @route   GET /api/quotes/categories
 * @desc    Get available quote categories
 * @access  Private (Employee)
 */
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    message: 'Quote categories retrieved successfully',
    data: {
      categories: [
        {
          key: 'motivation',
          name: 'Motivation',
          description: 'Inspiring quotes to boost your drive and determination',
          icon: 'fire'
        },
        {
          key: 'resilience',
          name: 'Resilience',
          description: 'Quotes about overcoming challenges and bouncing back',
          icon: 'shield'
        },
        {
          key: 'growth',
          name: 'Personal Growth',
          description: 'Wisdom about learning, development, and self-improvement',
          icon: 'trending-up'
        },
        {
          key: 'wellness',
          name: 'Wellness',
          description: 'Quotes focused on mental, physical, and emotional well-being',
          icon: 'heart'
        },
        {
          key: 'mindfulness',
          name: 'Mindfulness',
          description: 'Present-moment awareness and mindful living',
          icon: 'eye'
        },
        {
          key: 'strength',
          name: 'Inner Strength',
          description: 'Quotes about finding and building your inner power',
          icon: 'muscle'
        },
        {
          key: 'inspiration',
          name: 'General Inspiration',
          description: 'Uplifting and inspiring thoughts for daily motivation',
          icon: 'sun'
        }
      ]
    }
  });
});

/**
 * @route   GET /api/quotes/search
 * @desc    Search through user's quote history
 * @access  Private (Employee)
 * @query   {
 *   q: string,
 *   category?: string,
 *   author?: string,
 *   page?: number,
 *   limit?: number
 * }
 */
router.get('/search',
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  query('category')
    .optional()
    .isIn(['motivation', 'resilience', 'growth', 'wellness', 'mindfulness', 'strength', 'inspiration'])
    .withMessage('Invalid category'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  async (req, res) => {
    try {
      const { q, category, author, page = 1, limit = 20 } = req.query;
      const userId = req.user._id;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build search query
      const query = {
        userId,
        $or: [
          { quote: { $regex: q, $options: 'i' } },
          { author: { $regex: q, $options: 'i' } },
          { tags: { $in: [new RegExp(q, 'i')] } }
        ]
      };

      if (category) query.category = category;
      if (author) query.author = { $regex: author, $options: 'i' };

      const DailyQuote = require('../models/DailyQuote');
      const quotes = await DailyQuote.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('quote author category date tags engagement userFeedback');

      const totalCount = await DailyQuote.countDocuments(query);

      res.json({
        success: true,
        message: 'Search completed successfully',
        data: {
          query: q,
          results: quotes.map(quote => ({
            id: quote._id,
            quote: quote.quote,
            author: quote.author,
            category: quote.category,
            date: quote.date,
            tags: quote.tags,
            engagement: quote.engagement,
            userRating: quote.userFeedback?.rating
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount,
            hasNext: skip + quotes.length < totalCount,
            hasPrev: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      console.error('Search quotes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search quotes'
      });
    }
  }
);

// Admin/HR routes for quotes analytics
/**
 * @route   GET /api/quotes/admin/overview
 * @desc    Get quotes system overview and analytics (Admin/HR only)
 * @access  Private (Admin/HR)
 * @query   {
 *   period?: string, // 'week', 'month', 'quarter', 'year'
 *   department?: string
 * }
 */
router.get('/admin/overview',
  authorize(['admin', 'hr']),
  query('period')
    .optional()
    .isIn(['week', 'month', 'quarter', 'year'])
    .withMessage('Invalid period'),
  query('department')
    .optional()
    .isString()
    .withMessage('Department must be a string'),
  quotesController.getQuotesOverview
);

/**
 * @route   GET /api/quotes/admin/engagement
 * @desc    Get detailed engagement analytics (Admin/HR only)
 * @access  Private (Admin/HR)
 */
router.get('/admin/engagement',
  authorize(['admin', 'hr']),
  async (req, res) => {
    try {
      const { period = 'month' } = req.query;
      
      // Calculate date range
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarterStart = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterStart, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const DailyQuote = require('../models/DailyQuote');
      
      const engagementData = await DailyQuote.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: now }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            },
            totalQuotes: { $sum: 1 },
            viewedQuotes: { $sum: { $cond: ['$engagement.viewed', 1, 0] } },
            likedQuotes: { $sum: { $cond: ['$engagement.liked', 1, 0] } },
            sharedQuotes: { $sum: { $cond: ['$engagement.shared', 1, 0] } },
            avgRating: { $avg: '$userFeedback.rating' },
            categories: { $push: '$category' }
          }
        },
        {
          $sort: { '_id.date': 1 }
        }
      ]);

      res.json({
        success: true,
        message: 'Engagement analytics retrieved successfully',
        data: {
          period,
          dateRange: { startDate, endDate: now },
          dailyEngagement: engagementData.map(day => ({
            date: day._id.date,
            totalQuotes: day.totalQuotes,
            viewRate: day.totalQuotes > 0 ? Math.round((day.viewedQuotes / day.totalQuotes) * 100) : 0,
            likeRate: day.viewedQuotes > 0 ? Math.round((day.likedQuotes / day.viewedQuotes) * 100) : 0,
            shareRate: day.viewedQuotes > 0 ? Math.round((day.sharedQuotes / day.viewedQuotes) * 100) : 0,
            averageRating: Math.round(day.avgRating * 100) / 100 || 0
          })),
          generatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Get engagement analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve engagement analytics'
      });
    }
  }
);

module.exports = router;