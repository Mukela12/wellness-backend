const { validationResult } = require('express-validator');
const notificationService = require('../services/notifications/notification.service');
const { HTTP_STATUS } = require('../config/constants');

class NotificationController {

  // Get user's notifications with pagination and filtering
  async getNotifications(req, res) {
    try {
      const userId = req.user._id;
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        type = null,
        priority = null
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50), // Max 50 per request
        unreadOnly: unreadOnly === 'true',
        type,
        priority
      };

      const notifications = await notificationService.getUserNotifications(userId, options);
      const unreadCount = await notificationService.getUnreadCount(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          notifications,
          pagination: {
            currentPage: options.page,
            limit: options.limit,
            hasMore: notifications.length === options.limit
          },
          unreadCount
        }
      });

    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch notifications'
      });
    }
  }

  // Get unread notification count
  async getUnreadCount(req, res) {
    try {
      const userId = req.user._id;
      const unreadCount = await notificationService.getUnreadCount(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { unreadCount }
      });

    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch unread count'
      });
    }
  }

  // Mark specific notifications as read
  async markAsRead(req, res) {
    try {
      const userId = req.user._id;
      const { notificationIds } = req.body;

      // Validate that notificationIds is an array if provided
      if (notificationIds && !Array.isArray(notificationIds)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'notificationIds must be an array'
        });
      }

      const result = await notificationService.markAsRead(userId, notificationIds);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `${result.modifiedCount} notifications marked as read`,
        data: {
          modifiedCount: result.modifiedCount
        }
      });

    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to mark notifications as read'
      });
    }
  }

  // Mark all notifications as read
  async markAllAsRead(req, res) {
    try {
      const userId = req.user._id;
      const result = await notificationService.markAsRead(userId);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `All notifications marked as read`,
        data: {
          modifiedCount: result.modifiedCount
        }
      });

    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }
  }

  // Get notification statistics
  async getNotificationStats(req, res) {
    try {
      const userId = req.user._id;
      const { days = 7 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const Notification = require('../models/Notification');
      
      // Get stats for the specified period
      const stats = await Notification.aggregate([
        {
          $match: {
            userId: userId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalNotifications: { $sum: 1 },
            unreadNotifications: {
              $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
            },
            typeBreakdown: {
              $push: '$type'
            },
            priorityBreakdown: {
              $push: '$priority'
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalNotifications: 0,
        unreadNotifications: 0,
        typeBreakdown: [],
        priorityBreakdown: []
      };

      // Count by type
      const typeCounts = {};
      result.typeBreakdown.forEach(type => {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      // Count by priority
      const priorityCounts = {};
      result.priorityBreakdown.forEach(priority => {
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          period: `${days} days`,
          totalNotifications: result.totalNotifications,
          unreadNotifications: result.unreadNotifications,
          readNotifications: result.totalNotifications - result.unreadNotifications,
          typeBreakdown: typeCounts,
          priorityBreakdown: priorityCounts
        }
      });

    } catch (error) {
      console.error('Get notification stats error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch notification statistics'
      });
    }
  }

  // Test notification creation (for development/testing)
  async createTestNotification(req, res) {
    try {
      // Only allow in development mode
      if (process.env.NODE_ENV === 'production') {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Test notifications not allowed in production'
        });
      }

      const userId = req.user._id;
      const { type = 'SYSTEM_UPDATE', title, message } = req.body;

      const testNotification = await notificationService.createNotification(userId, {
        type,
        title: title || 'Test Notification',
        message: message || 'This is a test notification for development purposes.',
        priority: 'low',
        icon: 'info',
        source: 'manual'
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Test notification created',
        data: { notification: testNotification }
      });

    } catch (error) {
      console.error('Create test notification error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to create test notification'
      });
    }
  }

  // Admin: Send notification to specific users
  async sendNotificationToUsers(req, res) {
    try {
      // Check if user has admin/HR permissions
      if (!['admin', 'hr'].includes(req.user.role)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Access denied. Admin or HR role required.'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        userIds,
        title,
        message,
        type = 'SYSTEM_UPDATE',
        priority = 'medium',
        actionType = 'none',
        actionData = null
      } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'userIds must be a non-empty array'
        });
      }

      const notifications = await notificationService.createBulkNotifications(userIds, {
        type,
        title,
        message,
        priority,
        icon: 'info',
        actionType,
        actionData,
        source: 'manual'
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: `Notifications sent to ${notifications.length} users`,
        data: {
          notificationsSent: notifications.length,
          recipients: userIds
        }
      });

    } catch (error) {
      console.error('Send notification to users error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to send notifications'
      });
    }
  }

  // Admin: Send notification to all users
  async sendNotificationToAll(req, res) {
    try {
      // Check if user has admin permissions
      if (req.user.role !== 'admin') {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Access denied. Admin role required.'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        title,
        message,
        type = 'SYSTEM_UPDATE',
        priority = 'medium',
        actionType = 'none',
        actionData = null,
        excludeInactive = true
      } = req.body;

      // Get all active users
      const User = require('../models/User');
      const query = { role: 'employee' };
      if (excludeInactive) {
        query.isActive = true;
      }

      const users = await User.find(query).select('_id');
      const userIds = users.map(user => user._id);

      if (userIds.length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'No users found to send notifications to'
        });
      }

      const notifications = await notificationService.createBulkNotifications(userIds, {
        type,
        title,
        message,
        priority,
        icon: 'info',
        actionType,
        actionData,
        source: 'manual'
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: `Notifications sent to all ${notifications.length} users`,
        data: {
          notificationsSent: notifications.length,
          totalUsers: userIds.length
        }
      });

    } catch (error) {
      console.error('Send notification to all error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to send notifications to all users'
      });
    }
  }
}

module.exports = new NotificationController();