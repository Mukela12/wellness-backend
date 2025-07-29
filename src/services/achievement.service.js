const { Achievement, UserAchievement } = require('../models/Reward');
const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const notificationService = require('./notifications/notification.service');

class AchievementService {
  /**
   * Check and award achievements for a user based on their activities
   * @param {string} userId - User ID
   * @param {string} triggerType - Type of activity that triggered this check
   * @param {Object} data - Additional data for the trigger
   */
  async checkAndAwardAchievements(userId, triggerType, data = {}) {
    try {
      console.log(`🏆 Checking achievements for user ${userId}, trigger: ${triggerType}`);
      
      const user = await User.findById(userId);
      if (!user) {
        console.warn(`User ${userId} not found for achievement check`);
        return [];
      }

      // Get all active achievements
      const achievements = await Achievement.find({ isActive: true });
      
      // Get user's existing achievements to avoid duplicates
      const existingUserAchievements = await UserAchievement.find({ userId })
        .select('achievementId');
      const earnedAchievementIds = new Set(
        existingUserAchievements.map(ua => ua.achievementId.toString())
      );

      const newlyEarnedAchievements = [];

      // Check each achievement
      for (const achievement of achievements) {
        // Skip if already earned
        if (earnedAchievementIds.has(achievement._id.toString())) {
          continue;
        }

        // Check if user meets the criteria
        const meetsRequirement = await this.checkAchievementCriteria(
          userId, 
          achievement, 
          triggerType, 
          data
        );

        if (meetsRequirement) {
          console.log(`🎉 User ${userId} earned achievement: ${achievement.name}`);
          
          try {
            // Award the achievement
            const userAchievement = await this.awardAchievement(userId, achievement);
            newlyEarnedAchievements.push(userAchievement);

            // Award happy coins
            if (achievement.happyCoinsReward > 0) {
              user.wellness.happyCoins = (user.wellness.happyCoins || 0) + achievement.happyCoinsReward;
              await user.save();
              console.log(`💰 Awarded ${achievement.happyCoinsReward} happy coins for ${achievement.name}`);
            }

            // Send notification
            this.sendAchievementNotification(userId, achievement).catch(error => {
              console.error('Failed to send achievement notification:', error);
            });

          } catch (error) {
            console.error(`Error awarding achievement ${achievement.name}:`, error);
          }
        }
      }

      return newlyEarnedAchievements;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }

  /**
   * Check if user meets the criteria for a specific achievement
   */
  async checkAchievementCriteria(userId, achievement, triggerType, data) {
    const { criteria } = achievement;

    switch (criteria.type) {
      case 'total_checkins':
        return await this.checkTotalCheckIns(userId, criteria.value);
      
      case 'streak_days':
        return await this.checkStreakDays(userId, criteria.value);
      
      case 'consecutive_good_mood':
        return await this.checkConsecutiveGoodMood(userId, criteria.value);
      
      case 'survey_completion':
        return await this.checkSurveyCompletion(userId, criteria.value);
      
      case 'peer_recognition':
        return await this.checkPeerRecognition(userId, criteria.value);
      
      case 'custom':
        return await this.checkCustomCriteria(userId, achievement, triggerType, data);
      
      default:
        console.warn(`Unknown achievement criteria type: ${criteria.type}`);
        return false;
    }
  }

  /**
   * Award an achievement to a user
   */
  async awardAchievement(userId, achievement) {
    const userAchievement = new UserAchievement({
      userId,
      achievementId: achievement._id,
      achievement: {
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        rarity: achievement.rarity
      },
      earnedAt: new Date(),
      happyCoinsEarned: achievement.happyCoinsReward
    });

    await userAchievement.save();
    return userAchievement;
  }

  /**
   * Check total check-ins criteria
   */
  async checkTotalCheckIns(userId, requiredCount) {
    const checkInCount = await CheckIn.countDocuments({ userId });
    return checkInCount >= requiredCount;
  }

  /**
   * Check streak days criteria
   */
  async checkStreakDays(userId, requiredDays) {
    const user = await User.findById(userId).select('wellness.currentStreak');
    const currentStreak = user?.wellness?.currentStreak || 0;
    return currentStreak >= requiredDays;
  }

  /**
   * Check consecutive good mood criteria
   */
  async checkConsecutiveGoodMood(userId, requiredConsecutive) {
    const recentCheckIns = await CheckIn.find({ userId })
      .sort({ date: -1 })
      .limit(requiredConsecutive);

    if (recentCheckIns.length < requiredConsecutive) {
      return false;
    }

    // Check if all recent check-ins have good mood (4 or 5)
    return recentCheckIns.every(checkIn => checkIn.mood >= 4);
  }

  /**
   * Check survey completion criteria
   */
  async checkSurveyCompletion(userId, requiredCount) {
    // This would need to be implemented based on your survey system
    // For now, return false as surveys aren't implemented in the current system
    return false;
  }

  /**
   * Check peer recognition criteria
   */
  async checkPeerRecognition(userId, requiredCount) {
    const { Recognition } = require('../models/Reward');
    const recognitionCount = await Recognition.countDocuments({ toUserId: userId });
    return recognitionCount >= requiredCount;
  }

  /**
   * Check custom criteria (for special achievements)
   */
  async checkCustomCriteria(userId, achievement, triggerType, data) {
    // Handle special cases based on achievement name or trigger
    switch (achievement.name) {
      case 'Wellness Ambassador':
        // Check if user has sent peer recognition
        const { Recognition } = require('../models/Reward');
        const sentCount = await Recognition.countDocuments({ fromUserId: userId });
        return sentCount >= achievement.criteria.value;
      
      default:
        return false;
    }
  }

  /**
   * Send achievement notification
   */
  async sendAchievementNotification(userId, achievement) {
    try {
      await notificationService.notifyAchievementEarned(
        userId,
        achievement.name,
        achievement.description,
        achievement.happyCoinsReward
      );
    } catch (error) {
      console.error('Error sending achievement notification:', error);
    }
  }

  /**
   * Get user's achievement progress
   */
  async getUserAchievementProgress(userId) {
    try {
      const [achievements, userAchievements, user] = await Promise.all([
        Achievement.find({ isActive: true }).sort({ category: 1, sortOrder: 1 }),
        UserAchievement.find({ userId }).select('achievementId earnedAt'),
        User.findById(userId).select('wellness')
      ]);

      const earnedMap = new Map();
      userAchievements.forEach(ua => {
        earnedMap.set(ua.achievementId.toString(), ua.earnedAt);
      });

      const progressData = [];

      for (const achievement of achievements) {
        const isEarned = earnedMap.has(achievement._id.toString());
        let progress = 0;
        let current = 0;
        let target = achievement.criteria.value;

        if (!isEarned) {
          // Calculate current progress
          switch (achievement.criteria.type) {
            case 'total_checkins':
              current = await CheckIn.countDocuments({ userId });
              break;
            case 'streak_days':
              current = user?.wellness?.currentStreak || 0;
              break;
            case 'consecutive_good_mood':
              const recentCheckIns = await CheckIn.find({ userId })
                .sort({ date: -1 })
                .limit(target);
              current = recentCheckIns.filter(c => c.mood >= 4).length;
              if (recentCheckIns.length < target || !recentCheckIns.every(c => c.mood >= 4)) {
                current = 0; // Must be consecutive
              }
              break;
            // Add other criteria types as needed
          }
          
          progress = Math.min((current / target) * 100, 100);
        } else {
          progress = 100;
          current = target;
        }

        progressData.push({
          ...achievement.toObject(),
          isEarned,
          earnedAt: earnedMap.get(achievement._id.toString()) || null,
          progress: {
            current,
            target,
            percentage: Math.round(progress)
          }
        });
      }

      return progressData;
    } catch (error) {
      console.error('Error getting user achievement progress:', error);
      throw error;
    }
  }
}

module.exports = new AchievementService();