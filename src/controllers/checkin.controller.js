const { validationResult } = require('express-validator');
const CheckIn = require('../models/CheckIn');
const User = require('../models/User');
const { HTTP_STATUS, MOOD_SCALE } = require('../config/constants');

class CheckInController {
  // Create daily check-in
  async createCheckIn(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { mood, feedback, source = 'web' } = req.body;
      const userId = req.user._id;

      // Check if user already checked in today
      const existingCheckIn = await CheckIn.findTodaysCheckIn(userId);
      if (existingCheckIn) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'You have already checked in today',
          data: {
            checkIn: existingCheckIn,
            nextCheckIn: getNextCheckInTime()
          }
        });
      }

      // Create check-in
      const checkIn = new CheckIn({
        userId,
        mood,
        feedback: feedback?.trim(),
        source,
        date: new Date() // Will be normalized to start of day
      });

      await checkIn.save();

      // Populate user data for response
      await checkIn.populate('userId', 'name employeeId department wellness');

      // Calculate streak bonus
      const user = await User.findById(userId);
      let streakBonus = 0;
      const currentStreak = user.wellness.currentStreak;
      
      // Check for streak milestones
      if (currentStreak === 7) streakBonus = 100;
      else if (currentStreak === 30) streakBonus = 500;
      else if (currentStreak === 90) streakBonus = 1500;

      if (streakBonus > 0) {
        user.wellness.happyCoins += streakBonus;
        await user.save();
      }

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Check-in completed successfully! Thank you for sharing how you feel.',
        data: {
          checkIn: {
            id: checkIn._id,
            mood,
            moodLabel: checkIn.moodLabel,
            feedback,
            date: checkIn.dateFormatted,
            happyCoinsEarned: checkIn.happyCoinsEarned,
            streakAtCheckIn: checkIn.streakAtCheckIn,
            source
          },
          user: {
            totalHappyCoins: user.wellness.happyCoins,
            currentStreak: user.wellness.currentStreak,
            longestStreak: user.wellness.longestStreak
          },
          streakBonus,
          nextCheckIn: getNextCheckInTime()
        }
      });

    } catch (error) {
      console.error('Check-in creation error:', error);
      
      // Handle duplicate key error (race condition)
      if (error.code === 11000) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'You have already checked in today'
        });
      }

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to create check-in. Please try again.'
      });
    }
  }

  // Get user's check-in history
  async getCheckInHistory(req, res) {
    try {
      const userId = req.user._id;
      const {
        startDate,
        endDate,
        limit = 30,
        page = 1,
        includeAnalysis = false
      } = req.query;

      const options = {
        startDate,
        endDate,
        limit: parseInt(limit),
        sort: { date: -1 }
      };

      // Calculate skip for pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      let query = CheckIn.findByUser(userId, options).skip(skip);

      // Include analysis data if requested
      if (includeAnalysis === 'true') {
        query = query.select('+analysis');
      }

      const checkIns = await query.exec();

      // Get total count for pagination
      const totalCount = await CheckIn.countDocuments({
        userId,
        ...(startDate || endDate ? {
          date: {
            ...(startDate && { $gte: new Date(startDate) }),
            ...(endDate && { $lte: new Date(endDate) })
          }
        } : {})
      });

      // Calculate mood statistics
      const moodStats = await calculateMoodStats(userId, startDate, endDate);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          checkIns: checkIns.map(checkIn => ({
            id: checkIn._id,
            mood: checkIn.mood,
            moodLabel: checkIn.moodLabel,
            feedback: checkIn.feedback,
            date: checkIn.dateFormatted,
            happyCoinsEarned: checkIn.happyCoinsEarned,
            streakAtCheckIn: checkIn.streakAtCheckIn,
            source: checkIn.source,
            isPositive: checkIn.isPositive(),
            requiresAttention: checkIn.requiresAttention(),
            ...(includeAnalysis === 'true' && { analysis: checkIn.analysis })
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount,
            hasNextPage: skip + checkIns.length < totalCount,
            hasPrevPage: parseInt(page) > 1
          },
          statistics: moodStats
        }
      });

    } catch (error) {
      console.error('Get check-in history error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch check-in history'
      });
    }
  }

  // Get today's check-in status
  async getTodaysCheckIn(req, res) {
    try {
      const userId = req.user._id;
      const checkIn = await CheckIn.findTodaysCheckIn(userId);

      if (!checkIn) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'No check-in completed today',
          data: {
            checkedInToday: false,
            nextCheckIn: getNextCheckInTime(),
            canCheckIn: true
          }
        });
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Check-in completed for today',
        data: {
          checkedInToday: true,
          checkIn: {
            id: checkIn._id,
            mood: checkIn.mood,
            moodLabel: checkIn.moodLabel,
            feedback: checkIn.feedback,
            date: checkIn.dateFormatted,
            happyCoinsEarned: checkIn.happyCoinsEarned,
            streakAtCheckIn: checkIn.streakAtCheckIn,
            source: checkIn.source,
            createdAt: checkIn.createdAt
          },
          nextCheckIn: getNextCheckInTime(),
          canCheckIn: false
        }
      });

    } catch (error) {
      console.error('Get today\'s check-in error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch today\'s check-in status'
      });
    }
  }

  // Get mood trend for user
  async getMoodTrend(req, res) {
    try {
      const userId = req.user._id;
      const { days = 7 } = req.query;

      const trend = await CheckIn.getUserMoodTrend(userId, parseInt(days));

      // Calculate trend direction
      const trendDirection = calculateTrendDirection(trend);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          trend: trend.map(item => ({
            date: item.date.toISOString().split('T')[0],
            mood: item.mood,
            moodLabel: MOOD_SCALE.LABELS[item.mood]
          })),
          analysis: {
            direction: trendDirection.direction,
            change: trendDirection.change,
            period: `${days} days`,
            averageMood: trendDirection.average
          }
        }
      });

    } catch (error) {
      console.error('Get mood trend error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch mood trend'
      });
    }
  }

  // Update check-in (only feedback can be updated, within same day)
  async updateCheckIn(req, res) {
    try {
      const { id } = req.params;
      const { feedback } = req.body;
      const userId = req.user._id;

      const checkIn = await CheckIn.findOne({ _id: id, userId });

      if (!checkIn) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Check-in not found'
        });
      }

      // Check if check-in is from today (can only update today's check-in)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      
      if (checkIn.date.getTime() !== today.getTime()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Can only update today\'s check-in'
        });
      }

      // Update feedback only
      checkIn.feedback = feedback?.trim();
      await checkIn.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Check-in updated successfully',
        data: {
          checkIn: {
            id: checkIn._id,
            mood: checkIn.mood,
            moodLabel: checkIn.moodLabel,
            feedback: checkIn.feedback,
            date: checkIn.dateFormatted,
            updatedAt: checkIn.updatedAt
          }
        }
      });

    } catch (error) {
      console.error('Update check-in error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to update check-in'
      });
    }
  }

  // Helper Methods
  getNextCheckInTime() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setUTCHours(9, 0, 0, 0); // 9 AM UTC
    return tomorrow.toISOString();
  }
  async calculateMoodStats(userId, startDate, endDate) {
    const filter = {
      userId,
      ...(startDate || endDate ? {
        date: {
          ...(startDate && { $gte: new Date(startDate) }),
          ...(endDate && { $lte: new Date(endDate) })
        }
      } : {})
    };

    const stats = await CheckIn.getAnalytics(filter);
    return stats;
  }

  calculateTrendDirection(trend) {
    if (trend.length < 2) {
      return { direction: 'stable', change: 0, average: trend[0]?.mood || 0 };
    }

    const recent = trend.slice(-3); // Last 3 entries
    const older = trend.slice(0, -3); // Older entries

    const recentAvg = recent.reduce((sum, item) => sum + item.mood, 0) / recent.length;
    const olderAvg = older.length > 0 
      ? older.reduce((sum, item) => sum + item.mood, 0) / older.length 
      : recentAvg;

    const change = recentAvg - olderAvg;
    const overallAvg = trend.reduce((sum, item) => sum + item.mood, 0) / trend.length;

    let direction = 'stable';
    if (change > 0.3) direction = 'improving';
    else if (change < -0.3) direction = 'declining';

    return {
      direction,
      change: Math.round(change * 100) / 100,
      average: Math.round(overallAvg * 100) / 100
    };
  }
}

// Helper functions outside the class
function getNextCheckInTime() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setUTCHours(9, 0, 0, 0); // 9 AM UTC
  return tomorrow.toISOString();
}

async function calculateMoodStats(userId, startDate, endDate) {
  const filter = {
    userId,
    ...(startDate || endDate ? {
      date: {
        ...(startDate && { $gte: new Date(startDate) }),
        ...(endDate && { $lte: new Date(endDate) })
      }
    } : {})
  };

  const stats = await CheckIn.getAnalytics(filter);
  return stats;
}

function calculateTrendDirection(trend) {
  if (trend.length < 2) {
    return { direction: 'stable', change: 0, average: trend[0]?.mood || 0 };
  }

  const recent = trend.slice(-3); // Last 3 entries
  const older = trend.slice(0, -3); // Older entries

  const recentAvg = recent.reduce((sum, item) => sum + item.mood, 0) / recent.length;
  const olderAvg = older.length > 0 
    ? older.reduce((sum, item) => sum + item.mood, 0) / older.length 
    : recentAvg;

  const change = recentAvg - olderAvg;
  const overallAvg = trend.reduce((sum, item) => sum + item.mood, 0) / trend.length;

  let direction = 'stable';
  if (change > 0.3) direction = 'improving';
  else if (change < -0.3) direction = 'declining';

  return {
    direction,
    change: Math.round(change * 100) / 100,
    average: Math.round(overallAvg * 100) / 100
  };
}

module.exports = new CheckInController();