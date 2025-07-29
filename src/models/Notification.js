const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../config/constants');

const notificationSchema = new mongoose.Schema({
  // User who will receive the notification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },

  // Notification type
  type: {
    type: String,
    enum: {
      values: [
        'HAPPY_COINS_EARNED',
        'CHECK_IN_COMPLETED',
        'STREAK_WARNING',
        'STREAK_MILESTONE',
        'MILESTONE_ACHIEVED',
        'SURVEY_AVAILABLE',
        'CHALLENGE_JOINED',
        'REWARD_REDEEMED',
        'RECOGNITION_RECEIVED',
        'RISK_ALERT',
        'SYSTEM_UPDATE',
        'DAILY_CONTENT'
      ],
      message: '{VALUE} is not a valid notification type'
    },
    required: [true, 'Notification type is required']
  },

  // Notification title
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    maxlength: [100, 'Title cannot exceed 100 characters'],
    trim: true
  },

  // Notification message/content
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    maxlength: [500, 'Message cannot exceed 500 characters'],
    trim: true
  },

  // Additional data for the notification (coins earned, streak count, etc.)
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Priority level
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: '{VALUE} is not a valid priority level'
    },
    default: 'medium'
  },

  // Read status
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },

  // When the notification was read
  readAt: {
    type: Date
  },

  // Icon for the notification (for frontend display)
  icon: {
    type: String,
    enum: ['coins', 'checkmark', 'warning', 'trophy', 'star', 'bell', 'heart', 'fire', 'info', 'journal', 'quote'],
    default: 'bell'
  },

  // Action type (what happens when clicked)
  actionType: {
    type: String,
    enum: ['none', 'navigate', 'modal', 'external'],
    default: 'none'
  },

  // Action data (URL to navigate to, modal to open, etc.)
  actionData: {
    type: mongoose.Schema.Types.Mixed
  },

  // Auto-delete after certain time (for temporary notifications)
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  },

  // Source of the notification (what triggered it)
  source: {
    type: String,
    enum: ['system', 'check_in', 'survey', 'challenge', 'reward', 'streak', 'manual', 'journaling', 'daily-quotes'],
    default: 'system'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ userId: 1, priority: 1, createdAt: -1 });

// Virtual for time since creation
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else if (diffHours > 0) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }
});

// Static method to create notification
notificationSchema.statics.createNotification = async function(notificationData) {
  try {
    const notification = new this(notificationData);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Static method to get user notifications with pagination
notificationSchema.statics.getUserNotifications = function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    unreadOnly = false,
    type = null,
    priority = null
  } = options;

  const query = { userId };
  
  if (unreadOnly) {
    query.isRead = false;
  }
  
  if (type) {
    query.type = type;
  }
  
  if (priority) {
    query.priority = priority;
  }

  return this.find(query)
    .sort({ priority: -1, createdAt: -1 }) // High priority first, then newest
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ userId, isRead: false });
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = async function(userId, notificationIds = null) {
  const query = { userId, isRead: false };
  
  if (notificationIds && Array.isArray(notificationIds)) {
    query._id = { $in: notificationIds };
  }

  return this.updateMany(query, {
    isRead: true,
    readAt: new Date()
  });
};

// Static method to bulk create notifications for multiple users
notificationSchema.statics.createBulkNotifications = async function(userIds, notificationData) {
  try {
    const notifications = userIds.map(userId => ({
      ...notificationData,
      userId
    }));
    
    return await this.insertMany(notifications);
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    throw error;
  }
};

// Static method to clean up old notifications
notificationSchema.statics.cleanupOldNotifications = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true
  });
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);