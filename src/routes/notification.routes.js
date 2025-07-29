const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications with pagination and filtering
 * @access  Private
 * @query   {
 *   page: number,
 *   limit: number,
 *   unreadOnly: boolean,
 *   type: string,
 *   priority: string
 * }
 */
router.get('/', notificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Private
 * @query   { days: number }
 */
router.get('/stats', notificationController.getNotificationStats);

/**
 * @route   PATCH /api/notifications/mark-read
 * @desc    Mark specific notifications as read
 * @access  Private
 * @body    { notificationIds: string[] }
 */
router.patch('/mark-read', 
  body('notificationIds')
    .optional()
    .isArray()
    .withMessage('notificationIds must be an array'),
  notificationController.markAsRead
);

/**
 * @route   PATCH /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/mark-all-read', notificationController.markAllAsRead);

/**
 * @route   POST /api/notifications/test
 * @desc    Create a test notification (development only)
 * @access  Private
 * @body    { type?: string, title?: string, message?: string }
 */
router.post('/test',
  body('title')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('message')
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be between 1 and 500 characters'),
  notificationController.createTestNotification
);

/**
 * @route   POST /api/notifications/send-to-users
 * @desc    Send notification to specific users (Admin/HR only)
 * @access  Private (Admin/HR)
 * @body    {
 *   userIds: string[],
 *   title: string,
 *   message: string,
 *   type?: string,
 *   priority?: string,
 *   actionType?: string,
 *   actionData?: object
 * }
 */
router.post('/send-to-users',
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('userIds must be a non-empty array'),
  body('title')
    .notEmpty()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title is required and must be between 1 and 100 characters'),
  body('message')
    .notEmpty()
    .isLength({ min: 1, max: 500 })
    .withMessage('Message is required and must be between 1 and 500 characters'),
  body('type')
    .optional()
    .isIn([
      'HAPPY_COINS_EARNED', 'CHECK_IN_COMPLETED', 'STREAK_WARNING', 
      'STREAK_MILESTONE', 'MILESTONE_ACHIEVED', 'SURVEY_AVAILABLE',
      'CHALLENGE_JOINED', 'REWARD_REDEEMED', 'RECOGNITION_RECEIVED',
      'RISK_ALERT', 'SYSTEM_UPDATE'
    ])
    .withMessage('Invalid notification type'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  body('actionType')
    .optional()
    .isIn(['none', 'navigate', 'modal', 'external'])
    .withMessage('Action type must be one of: none, navigate, modal, external'),
  notificationController.sendNotificationToUsers
);

/**
 * @route   POST /api/notifications/send-to-all
 * @desc    Send notification to all users (Admin only)
 * @access  Private (Admin)
 * @body    {
 *   title: string,
 *   message: string,
 *   type?: string,
 *   priority?: string,
 *   actionType?: string,
 *   actionData?: object,
 *   excludeInactive?: boolean
 * }
 */
router.post('/send-to-all',
  body('title')
    .notEmpty()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title is required and must be between 1 and 100 characters'),
  body('message')
    .notEmpty()
    .isLength({ min: 1, max: 500 })
    .withMessage('Message is required and must be between 1 and 500 characters'),
  body('type')
    .optional()
    .isIn([
      'HAPPY_COINS_EARNED', 'CHECK_IN_COMPLETED', 'STREAK_WARNING', 
      'STREAK_MILESTONE', 'MILESTONE_ACHIEVED', 'SURVEY_AVAILABLE',
      'CHALLENGE_JOINED', 'REWARD_REDEEMED', 'RECOGNITION_RECEIVED',
      'RISK_ALERT', 'SYSTEM_UPDATE'
    ])
    .withMessage('Invalid notification type'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  body('actionType')
    .optional()
    .isIn(['none', 'navigate', 'modal', 'external'])
    .withMessage('Action type must be one of: none, navigate, modal, external'),
  body('excludeInactive')
    .optional()
    .isBoolean()
    .withMessage('excludeInactive must be a boolean'),
  notificationController.sendNotificationToAll
);

module.exports = router;