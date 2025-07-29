const User = require('../../models/User');
const CheckIn = require('../../models/CheckIn');
const notificationService = require('./notification.service');

class StreakWarningService {
  
  // Check for users who might lose their streak and send warnings
  async sendStreakWarnings() {
    try {
      console.log('🔥 Checking for users at risk of losing their streak...');
      
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      // Find users with active streaks who haven't checked in today
      const usersWithStreaks = await User.find({
        'wellness.currentStreak': { $gt: 0 },
        'wellness.lastCheckIn': { $exists: true },
        isActive: true,
        role: 'employee'
      }).select('_id name wellness notifications');

      let warningsSent = 0;
      let errors = 0;

      for (const user of usersWithStreaks) {
        try {
          // Check if user has already checked in today
          const todayCheckIn = await CheckIn.findTodaysCheckIn(user._id);
          
          if (!todayCheckIn && user.wellness.currentStreak > 0) {
            // Calculate hours left in the day
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);
            const hoursLeft = Math.ceil((endOfDay - now) / (1000 * 60 * 60));
            
            // Only send warning if there are reasonable hours left (more than 2 hours)
            if (hoursLeft > 2 && hoursLeft <= 18) {
              // Check user notification preferences
              if (user.notifications.checkInReminder) {
                await notificationService.notifyStreakWarning(
                  user._id,
                  user.wellness.currentStreak,
                  hoursLeft
                );
                warningsSent++;
              }
            }
          }
        } catch (error) {
          console.error(`Error checking streak for user ${user._id}:`, error);
          errors++;
        }
      }

      console.log(`🔥 Streak warning check completed: ${warningsSent} warnings sent, ${errors} errors`);
      return { warningsSent, errors };
      
    } catch (error) {
      console.error('Error in streak warning service:', error);
      throw error;
    }
  }

  // Check for users who lost their streak yesterday and send sympathy/motivation
  async sendStreakLossNotifications() {
    try {
      console.log('💔 Checking for users who lost their streak...');
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const endOfYesterday = new Date(yesterday);
      endOfYesterday.setHours(23, 59, 59, 999);

      // Find users who had streaks but didn't check in yesterday
      const usersWithPreviousStreaks = await User.find({
        'wellness.longestStreak': { $gt: 0 },
        'wellness.currentStreak': 0,
        isActive: true,
        role: 'employee'
      }).select('_id name wellness notifications');

      let motivationsSent = 0;
      let errors = 0;

      for (const user of usersWithPreviousStreaks) {
        try {
          // Check if they missed yesterday's check-in
          const yesterdayCheckIn = await CheckIn.findOne({
            userId: user._id,
            date: yesterday
          });

          if (!yesterdayCheckIn && user.wellness.longestStreak >= 3) {
            // Only send motivation if they had a meaningful streak
            await notificationService.createNotification(user._id, {
              type: 'SYSTEM_UPDATE',
              title: 'Don\'t Give Up!',
              message: `Your ${user.wellness.longestStreak}-day streak was impressive! Start a new one today and beat your record.`,
              data: { 
                lostStreak: user.wellness.longestStreak,
                motivationType: 'streak_loss_recovery'
              },
              priority: 'medium',
              icon: 'heart',
              actionType: 'navigate',
              actionData: { route: '/wellness/checkin' },
              source: 'streak'
            });
            motivationsSent++;
          }
        } catch (error) {
          console.error(`Error sending motivation to user ${user._id}:`, error);
          errors++;
        }
      }

      console.log(`💔 Streak loss check completed: ${motivationsSent} motivations sent, ${errors} errors`);
      return { motivationsSent, errors };
      
    } catch (error) {
      console.error('Error in streak loss notification service:', error);
      throw error;
    }
  }

  // Get streak statistics for monitoring
  async getStreakStatistics() {
    try {
      const stats = await User.aggregate([
        {
          $match: {
            role: 'employee',
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            usersWithActiveStreaks: {
              $sum: { $cond: [{ $gt: ['$wellness.currentStreak', 0] }, 1, 0] }
            },
            usersWithLongStreaks: {
              $sum: { $cond: [{ $gte: ['$wellness.currentStreak', 7] }, 1, 0] }
            },
            averageCurrentStreak: { $avg: '$wellness.currentStreak' },
            averageLongestStreak: { $avg: '$wellness.longestStreak' },
            maxCurrentStreak: { $max: '$wellness.currentStreak' },
            maxLongestStreak: { $max: '$wellness.longestStreak' }
          }
        }
      ]);

      return stats[0] || {
        totalUsers: 0,
        usersWithActiveStreaks: 0,
        usersWithLongStreaks: 0,
        averageCurrentStreak: 0,
        averageLongestStreak: 0,
        maxCurrentStreak: 0,
        maxLongestStreak: 0
      };
    } catch (error) {
      console.error('Error getting streak statistics:', error);
      throw error;
    }
  }
}

module.exports = new StreakWarningService();