const User = require('../models/User');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

class ProfileController {
  async updateProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user._id;
      const updates = {};
      
      const allowedUpdates = ['name', 'phone', 'department'];
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields provided for update'
        });
      }

      updates.updatedAt = new Date();

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password -refreshTokens -emailVerificationToken -passwordResetToken');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: user.toJSON()
        }
      });

    } catch (error) {
      console.error('Profile update error:', error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({
          success: false,
          message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  }

  async updatePreferences(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user._id;
      const { notifications, personality } = req.body;
      
      const updates = { updatedAt: new Date() };

      if (notifications) {
        const allowedNotificationFields = [
          'checkInReminder', 
          'surveyReminder', 
          'rewardUpdates', 
          'preferredChannel', 
          'reminderTime'
        ];
        
        allowedNotificationFields.forEach(field => {
          if (notifications[field] !== undefined) {
            updates[`notifications.${field}`] = notifications[field];
          }
        });
      }

      if (personality) {
        const allowedPersonalityFields = ['interests', 'stressManagement'];
        
        allowedPersonalityFields.forEach(field => {
          if (personality[field] !== undefined) {
            updates[`personality.${field}`] = personality[field];
          }
        });
      }

      if (Object.keys(updates).length === 1) { // Only updatedAt
        return res.status(400).json({
          success: false,
          message: 'No valid preferences provided for update'
        });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password -refreshTokens -emailVerificationToken -passwordResetToken');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: {
          user: user.toJSON()
        }
      });

    } catch (error) {
      console.error('Preferences update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update preferences'
      });
    }
  }

  async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // For now, we'll just store the file path
      // In production, you'd want to use Cloudinary or similar service
      const avatarPath = `/uploads/avatars/${req.file.filename}`;
      
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { 
          $set: { 
            'profile.avatar': avatarPath,
            updatedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      ).select('-password -refreshTokens -emailVerificationToken -passwordResetToken');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          avatarUrl: avatarPath,
          user: user.toJSON()
        }
      });

    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload avatar'
      });
    }
  }

  async getWellnessStats(req, res) {
    try {
      const userId = req.user._id;
      const { period = '30' } = req.query;
      
      const days = parseInt(period);
      if (isNaN(days) || days < 1 || days > 365) {
        return res.status(400).json({
          success: false,
          message: 'Period must be between 1 and 365 days'
        });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const user = await User.findById(userId)
        .select('wellness onboarding createdAt')
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get check-ins for the period
      const CheckIn = require('../models/CheckIn');
      const checkIns = await CheckIn.find({
        userId,
        date: { $gte: startDate }
      }).sort({ date: -1 });

      const totalDays = Math.ceil((new Date() - user.createdAt) / (1000 * 60 * 60 * 24));
      const activeDays = checkIns.length;
      
      // Calculate streaks
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      
      // Sort check-ins by date descending to calculate current streak
      const sortedCheckIns = [...checkIns].sort((a, b) => b.date - a.date);
      
      for (let i = 0; i < sortedCheckIns.length; i++) {
        const checkInDate = new Date(sortedCheckIns[i].date);
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        expectedDate.setHours(0, 0, 0, 0);
        
        if (checkInDate.getTime() === expectedDate.getTime()) {
          currentStreak++;
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          if (i === 0) currentStreak = 0; // No check-in today breaks current streak
          tempStreak = 0;
        }
      }

      // Mood distribution and trends
      const moodCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let totalMood = 0;
      let totalCoins = 0;
      
      checkIns.forEach(checkIn => {
        moodCounts[checkIn.mood]++;
        totalMood += checkIn.mood;
        totalCoins += checkIn.happyCoinsEarned || 0;
      });

      const averageMood = checkIns.length > 0 ? (totalMood / checkIns.length) : 0;
      
      // Weekly mood trend
      const weeklyTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dayCheckIn = checkIns.find(c => 
          new Date(c.date).getTime() === date.getTime()
        );
        
        weeklyTrend.push({
          date: date.toISOString().split('T')[0],
          mood: dayCheckIn ? dayCheckIn.mood : null,
          moodLabel: dayCheckIn ? getMoodLabel(dayCheckIn.mood) : null
        });
      }

      res.json({
        success: true,
        data: {
          period: {
            days: days,
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString()
          },
          overview: {
            totalDaysActive: totalDays,
            checkInDays: activeDays,
            engagementRate: totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0,
            currentStreak: currentStreak,
            longestStreak: Math.max(longestStreak, user.wellness?.longestStreak || 0),
            totalHappyCoins: user.wellness?.happyCoins || 0,
            coinsEarnedInPeriod: totalCoins
          },
          mood: {
            average: Math.round(averageMood * 10) / 10,
            distribution: moodCounts,
            weeklyTrend: weeklyTrend
          },
          wellness: {
            riskLevel: user.wellness?.riskLevel || 'low',
            riskScore: user.wellness?.riskScore || 0,
            lastCheckIn: user.wellness?.lastCheckIn || null
          },
          milestones: {
            firstCheckIn: checkIns.length > 0 ? checkIns[checkIns.length - 1].date : null,
            longestStreakAchieved: user.wellness?.longestStreak || 0,
            totalCheckIns: activeDays,
            coinsToNextReward: Math.max(0, 500 - (user.wellness?.happyCoins || 0))
          }
        }
      });

    } catch (error) {
      console.error('Wellness stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve wellness statistics'
      });
    }
  }

  async deleteAccount(req, res) {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to delete account'
        });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }

      // Soft delete - mark as inactive
      await User.findByIdAndUpdate(req.user.id, {
        $set: {
          isActive: false,
          email: `deleted_${Date.now()}_${user.email}`,
          employeeId: `deleted_${Date.now()}_${user.employeeId}`,
          deletedAt: new Date(),
          updatedAt: new Date()
        },
        $unset: {
          refreshTokens: 1,
          emailVerificationToken: 1,
          passwordResetToken: 1
        }
      });

      res.json({
        success: true,
        message: 'Account has been deactivated successfully'
      });

    } catch (error) {
      console.error('Account deletion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete account'
      });
    }
  }
}

function getMoodLabel(mood) {
  const labels = {
    1: 'Very Bad',
    2: 'Bad', 
    3: 'Neutral',
    4: 'Good',
    5: 'Excellent'
  };
  return labels[mood] || 'Unknown';
}

module.exports = new ProfileController();