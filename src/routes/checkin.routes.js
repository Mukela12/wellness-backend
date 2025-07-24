const express = require('express');
const checkInController = require('../controllers/checkin.controller');
const { authenticate, requireOnboarding } = require('../middleware/auth');
const { validateCheckIn, validateObjectId, validateListQuery, validateDateRange } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/checkins
 * @desc    Create daily check-in
 * @access  Private (authenticated users)
 * @body    { mood: number(1-5), feedback?: string, source?: string }
 */
router.post('/', validateCheckIn, checkInController.createCheckIn);

/**
 * @route   GET /api/checkins
 * @desc    Get user's check-in history with pagination
 * @access  Private (authenticated users)
 * @query   { startDate?, endDate?, limit?, page?, includeAnalysis? }
 */
router.get('/', [validateListQuery, validateDateRange], checkInController.getCheckInHistory);

/**
 * @route   GET /api/checkins/today
 * @desc    Get today's check-in status
 * @access  Private (authenticated users)
 */
router.get('/today', checkInController.getTodaysCheckIn);

/**
 * @route   GET /api/checkins/trend
 * @desc    Get mood trend analysis
 * @access  Private (authenticated users)
 * @query   { days?: number }
 */
router.get('/trend', checkInController.getMoodTrend);

/**
 * @route   PUT /api/checkins/:id
 * @desc    Update check-in (feedback only, today's check-in only)
 * @access  Private (authenticated users)
 * @params  { id: ObjectId }
 * @body    { feedback: string }
 */
router.put('/:id', [
  validateObjectId,
  (req, res, next) => {
    // Validate feedback update
    const { feedback } = req.body;
    
    if (feedback !== undefined && typeof feedback !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Feedback must be a string'
      });
    }
    
    if (feedback && feedback.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Feedback cannot exceed 500 characters'
      });
    }
    
    next();
  }
], checkInController.updateCheckIn);

/**
 * @route   GET /api/checkins/stats
 * @desc    Get user's check-in statistics
 * @access  Private (authenticated users)
 * @query   { startDate?, endDate? }
 */
router.get('/stats', [validateDateRange], async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    // Get basic stats
    const CheckIn = require('../models/CheckIn');
    
    const filter = {
      userId,
      ...(startDate || endDate ? {
        date: {
          ...(startDate && { $gte: new Date(startDate) }),
          ...(endDate && { $lte: new Date(endDate) })
        }
      } : {})
    };

    const [stats, recentCheckIns] = await Promise.all([
      CheckIn.getAnalytics(filter),
      CheckIn.find(filter).sort({ date: -1 }).limit(30)
    ]);

    // Calculate additional metrics
    const totalDays = startDate && endDate 
      ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1
      : 30;
    
    const checkInRate = Math.round((stats.totalCheckIns / totalDays) * 100);

    // Find longest streak in period
    let longestStreak = 0;
    let currentStreak = 0;
    
    for (let i = 0; i < recentCheckIns.length; i++) {
      if (i === 0) {
        currentStreak = 1;
      } else {
        const currentDate = new Date(recentCheckIns[i].date);
        const previousDate = new Date(recentCheckIns[i - 1].date);
        const dayDiff = (previousDate - currentDate) / (1000 * 60 * 60 * 24);
        
        if (dayDiff === 1) {
          currentStreak++;
        } else {
          longestStreak = Math.max(longestStreak, currentStreak);
          currentStreak = 1;
        }
      }
    }
    longestStreak = Math.max(longestStreak, currentStreak);

    // Mood insights
    const moodInsights = {
      mostCommonMood: Object.entries(stats.moodDistribution)
        .reduce((a, b) => stats.moodDistribution[a[0]] > stats.moodDistribution[b[0]] ? a : b)[0],
      positiveCheckIns: (stats.moodDistribution['4'] || 0) + (stats.moodDistribution['5'] || 0),
      neutralCheckIns: stats.moodDistribution['3'] || 0,
      negativeCheckIns: (stats.moodDistribution['1'] || 0) + (stats.moodDistribution['2'] || 0)
    };

    res.json({
      success: true,
      data: {
        period: {
          startDate: startDate || recentCheckIns[recentCheckIns.length - 1]?.date,
          endDate: endDate || recentCheckIns[0]?.date,
          totalDays
        },
        checkInMetrics: {
          totalCheckIns: stats.totalCheckIns,
          checkInRate: `${checkInRate}%`,
          longestStreakInPeriod: longestStreak
        },
        moodMetrics: {
          averageMood: stats.averageMood,
          moodDistribution: stats.moodDistribution,
          insights: moodInsights
        },
        wellnessMetrics: {
          totalHappyCoinsEarned: stats.totalHappyCoins,
          positiveCheckInPercentage: Math.round((moodInsights.positiveCheckIns / stats.totalCheckIns) * 100) || 0
        }
      }
    });

  } catch (error) {
    console.error('Get check-in stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch check-in statistics'
    });
  }
});

/**
 * @route   DELETE /api/checkins/:id
 * @desc    Delete check-in (today's only, emergency use)
 * @access  Private (authenticated users)
 * @params  { id: ObjectId }
 */
router.delete('/:id', [validateObjectId], async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const CheckIn = require('../models/CheckIn');
    const checkIn = await CheckIn.findOne({ _id: id, userId });

    if (!checkIn) {
      return res.status(404).json({
        success: false,
        message: 'Check-in not found'
      });
    }

    // Only allow deletion of today's check-in
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    if (checkIn.date.getTime() !== today.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'Can only delete today\'s check-in'
      });
    }

    // Remove happy coins from user
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, {
      $inc: { 'wellness.happyCoins': -checkIn.happyCoinsEarned }
    });

    await CheckIn.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Check-in deleted successfully',
      data: {
        coinsDeducted: checkIn.happyCoinsEarned
      }
    });

  } catch (error) {
    console.error('Delete check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete check-in'
    });
  }
});

module.exports = router;