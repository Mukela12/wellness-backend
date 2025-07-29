const Notification = require('../../models/Notification');
const User = require('../../models/User');

class NotificationService {
  
  // Create a notification for a specific user
  async createNotification(userId, notificationData) {
    try {
      const notification = await Notification.createNotification({
        userId,
        ...notificationData
      });
      
      console.log(`📱 Notification created for user ${userId}: ${notificationData.title}`);
      return notification;
    } catch (error) {
      console.error('NotificationService: Error creating notification:', error);
      throw error;
    }
  }

  // Create notifications for multiple users
  async createBulkNotifications(userIds, notificationData) {
    try {
      const notifications = await Notification.createBulkNotifications(userIds, notificationData);
      console.log(`📱 ${notifications.length} bulk notifications created`);
      return notifications;
    } catch (error) {
      console.error('NotificationService: Error creating bulk notifications:', error);
      throw error;
    }
  }

  // Happy coins earned notification
  async notifyHappyCoinsEarned(userId, coinsEarned, source = 'check_in') {
    return this.createNotification(userId, {
      type: 'HAPPY_COINS_EARNED',
      title: `+${coinsEarned} Happy Coins!`,
      message: source === 'check_in' 
        ? `Great job! You earned ${coinsEarned} happy coins for checking in today.`
        : `You've earned ${coinsEarned} happy coins! Keep up the great work.`,
      data: { 
        coinsEarned,
        source 
      },
      priority: 'medium',
      icon: 'coins',
      actionType: 'navigate',
      actionData: { route: '/dashboard' },
      source: source
    });
  }

  // Check-in completed notification
  async notifyCheckInCompleted(userId, mood, streak = 0) {
    const moodLabels = {
      1: 'Very Poor', 2: 'Poor', 3: 'Neutral', 4: 'Good', 5: 'Excellent'
    };

    return this.createNotification(userId, {
      type: 'CHECK_IN_COMPLETED',
      title: 'Check-in Complete!',
      message: `Thanks for checking in! Your mood: ${moodLabels[mood]}${streak > 0 ? ` | Streak: ${streak} days` : ''}`,
      data: { 
        mood,
        moodLabel: moodLabels[mood],
        streak 
      },
      priority: 'low',
      icon: 'checkmark',
      actionType: 'navigate',
      actionData: { route: '/wellness/history' },
      source: 'check_in'
    });
  }

  // Streak warning notification (when user might lose streak)
  async notifyStreakWarning(userId, currentStreak, hoursLeft = 24) {
    return this.createNotification(userId, {
      type: 'STREAK_WARNING',
      title: 'Don\'t Break Your Streak!',
      message: `You have ${hoursLeft} hours left to check in and maintain your ${currentStreak}-day streak!`,
      data: { 
        currentStreak,
        hoursLeft 
      },
      priority: 'high',
      icon: 'warning',
      actionType: 'navigate',
      actionData: { route: '/wellness/checkin' },
      source: 'streak',
      expiresAt: new Date(Date.now() + hoursLeft * 60 * 60 * 1000)
    });
  }

  // Streak milestone achieved
  async notifyStreakMilestone(userId, streakDays, bonusCoins = 0) {
    const milestoneMessages = {
      7: 'First week complete!',
      14: 'Two weeks strong!',
      30: 'A whole month!',
      60: 'Two months of consistency!',
      90: 'Quarter year achievement!',
      180: 'Half year milestone!',
      365: 'Full year streak!'
    };

    const message = milestoneMessages[streakDays] || `${streakDays} days of consistency!`;

    return this.createNotification(userId, {
      type: 'STREAK_MILESTONE',
      title: `🔥 ${streakDays}-Day Streak!`,
      message: `${message}${bonusCoins > 0 ? ` Bonus: ${bonusCoins} happy coins!` : ''}`,
      data: { 
        streakDays,
        bonusCoins 
      },
      priority: 'high',
      icon: 'fire',
      actionType: 'navigate',
      actionData: { route: '/dashboard' },
      source: 'streak'
    });
  }

  // General milestone achieved
  async notifyMilestoneAchieved(userId, milestoneType, title, message, data = {}) {
    return this.createNotification(userId, {
      type: 'MILESTONE_ACHIEVED',
      title,
      message,
      data: { 
        milestoneType,
        ...data 
      },
      priority: 'medium',
      icon: 'trophy',
      actionType: 'navigate',
      actionData: { route: '/achievements' },
      source: 'system'
    });
  }

  // Achievement earned notification
  async notifyAchievementEarned(userId, achievementName, description, happyCoinsReward = 0) {
    const coinsMessage = happyCoinsReward > 0 ? ` You've earned ${happyCoinsReward} happy coins!` : '';
    
    return this.createNotification(userId, {
      type: 'ACHIEVEMENT_EARNED',
      title: `🏆 Achievement Unlocked!`,
      message: `${achievementName}: ${description}${coinsMessage}`,
      data: { 
        achievementName,
        description,
        happyCoinsReward
      },
      priority: 'high',
      icon: 'trophy',
      actionType: 'navigate',
      actionData: { route: '/profile?tab=achievements' },
      source: 'achievement'
    });
  }

  // Survey available notification
  async notifySurveyAvailable(userId, surveyTitle) {
    return this.createNotification(userId, {
      type: 'SURVEY_AVAILABLE',
      title: 'New Survey Available',
      message: `"${surveyTitle}" - Share your thoughts and help us improve!`,
      data: { surveyTitle },
      priority: 'medium',
      icon: 'info',
      actionType: 'navigate',
      actionData: { route: '/surveys' },
      source: 'survey',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
    });
  }

  // Challenge joined notification
  async notifyChallengeJoined(userId, challengeName) {
    return this.createNotification(userId, {
      type: 'CHALLENGE_JOINED',
      title: 'Challenge Joined!',
      message: `You've successfully joined "${challengeName}". Good luck!`,
      data: { challengeName },
      priority: 'medium',
      icon: 'star',
      actionType: 'navigate',
      actionData: { route: '/challenges' },
      source: 'challenge'
    });
  }

  // Reward redeemed notification
  async notifyRewardRedeemed(userId, rewardName, coinsSpent) {
    return this.createNotification(userId, {
      type: 'REWARD_REDEEMED',
      title: 'Reward Redeemed!',
      message: `You've redeemed "${rewardName}" for ${coinsSpent} happy coins.`,
      data: { 
        rewardName,
        coinsSpent 
      },
      priority: 'medium',
      icon: 'heart',
      actionType: 'navigate',
      actionData: { route: '/rewards' },
      source: 'reward'
    });
  }

  // Recognition received notification
  async notifyRecognitionReceived(userId, fromUserName, recognitionType) {
    return this.createNotification(userId, {
      type: 'RECOGNITION_RECEIVED',
      title: 'Recognition Received!',
      message: `${fromUserName} has given you recognition for ${recognitionType}!`,
      data: { 
        fromUserName,
        recognitionType 
      },
      priority: 'high',
      icon: 'star',
      actionType: 'navigate',
      actionData: { route: '/recognitions' },
      source: 'system'
    });
  }

  // Risk alert notification (for HR/managers about employees)
  async notifyRiskAlert(userId, employeeName, riskLevel, reason) {
    return this.createNotification(userId, {
      type: 'RISK_ALERT',
      title: 'Employee Wellness Alert',
      message: `${employeeName} shows ${riskLevel} risk level: ${reason}`,
      data: { 
        employeeName,
        riskLevel,
        reason 
      },
      priority: 'urgent',
      icon: 'warning',
      actionType: 'navigate',
      actionData: { route: '/analytics/risk-assessment' },
      source: 'system'
    });
  }

  // System update notification
  async notifySystemUpdate(userIds, title, message, actionData = null) {
    return this.createBulkNotifications(userIds, {
      type: 'SYSTEM_UPDATE',
      title,
      message,
      data: {},
      priority: 'low',
      icon: 'info',
      actionType: actionData ? 'navigate' : 'none',
      actionData,
      source: 'system',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Expires in 30 days
    });
  }

  // Get user notifications with options
  async getUserNotifications(userId, options = {}) {
    try {
      const notifications = await Notification.getUserNotifications(userId, options);
      return notifications;
    } catch (error) {
      console.error('NotificationService: Error getting user notifications:', error);
      throw error;
    }
  }

  // Get unread notification count
  async getUnreadCount(userId) {
    try {
      return await Notification.getUnreadCount(userId);
    } catch (error) {
      console.error('NotificationService: Error getting unread count:', error);
      throw error;
    }
  }

  // Mark notifications as read
  async markAsRead(userId, notificationIds = null) {
    try {
      const result = await Notification.markAsRead(userId, notificationIds);
      console.log(`📱 Marked ${result.modifiedCount} notifications as read for user ${userId}`);
      return result;
    } catch (error) {
      console.error('NotificationService: Error marking notifications as read:', error);
      throw error;
    }
  }

  // Delete old notifications (cleanup job)
  async cleanupOldNotifications(daysOld = 30) {
    try {
      const result = await Notification.cleanupOldNotifications(daysOld);
      console.log(`📱 Cleaned up ${result.deletedCount} old notifications`);
      return result;
    } catch (error) {
      console.error('NotificationService: Error cleaning up notifications:', error);
      throw error;
    }
  }

  // Helper method to check user notification preferences
  async shouldNotifyUser(userId, notificationType) {
    try {
      const user = await User.findById(userId).select('notifications');
      if (!user) return false;

      // Map notification types to user preferences
      const preferenceMap = {
        'HAPPY_COINS_EARNED': 'rewardUpdates',
        'CHECK_IN_COMPLETED': 'checkInReminder',
        'STREAK_WARNING': 'checkInReminder',
        'STREAK_MILESTONE': 'rewardUpdates',
        'SURVEY_AVAILABLE': 'surveyReminder'
      };

      const preferenceKey = preferenceMap[notificationType];
      return preferenceKey ? user.notifications[preferenceKey] : true;
    } catch (error) {
      console.error('NotificationService: Error checking user preferences:', error);
      return true; // Default to showing notification if there's an error
    }
  }

  // Create notification only if user preferences allow it
  async createNotificationIfAllowed(userId, notificationData) {
    const shouldNotify = await this.shouldNotifyUser(userId, notificationData.type);
    
    if (shouldNotify) {
      return this.createNotification(userId, notificationData);
    } else {
      console.log(`📱 Notification skipped due to user preferences: ${notificationData.title}`);
      return null;
    }
  }
}

module.exports = new NotificationService();