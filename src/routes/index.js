const express = require('express');
const authRoutes = require('./auth.routes');
const checkInRoutes = require('./checkin.routes');

const router = express.Router();

// API Documentation endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WellnessAI Backend API',
    version: '1.0.0',
    documentation: {
      endpoints: {
        authentication: {
          'POST /api/auth/register': 'Register a new user',
          'POST /api/auth/login': 'Login user',
          'POST /api/auth/refresh': 'Refresh access token',
          'GET /api/auth/verify-email': 'Verify email address',
          'POST /api/auth/resend-verification': 'Resend email verification',
          'POST /api/auth/forgot-password': 'Request password reset',
          'POST /api/auth/reset-password': 'Reset password with token',
          'GET /api/auth/profile': 'Get user profile (auth required)',
          'POST /api/auth/logout': 'Logout user (auth required)',
          'POST /api/auth/change-password': 'Change password (auth required)',
          'POST /api/auth/logout-all': 'Logout from all devices (auth required)',
          'DELETE /api/auth/account': 'Deactivate account (auth required)'
        },
        checkins: {
          'POST /api/checkins': 'Create daily check-in (auth required)',
          'GET /api/checkins': 'Get check-in history (auth required)',
          'GET /api/checkins/today': 'Get today\'s check-in status (auth required)',
          'GET /api/checkins/trend': 'Get mood trend analysis (auth required)',
          'GET /api/checkins/stats': 'Get check-in statistics (auth required)',
          'PUT /api/checkins/:id': 'Update check-in feedback (auth required)',
          'DELETE /api/checkins/:id': 'Delete today\'s check-in (auth required)'
        },
        health: {
          'GET /health': 'Health check endpoint'
        }
      },
      authentication: {
        type: 'Bearer Token',
        header: 'Authorization: Bearer <token>',
        note: 'Include JWT token in Authorization header for protected routes'
      },
      rateLimit: {
        window: '1 minute',
        maxRequests: 300,
        note: 'Rate limiting applies to all /api routes'
      }
    },
    status: 'active',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/checkins', checkInRoutes);

// Future routes will be added here:
// router.use('/users', require('./user.routes'));
// router.use('/surveys', require('./survey.routes'));
// router.use('/analytics', require('./analytics.routes'));
// router.use('/rewards', require('./reward.routes'));

module.exports = router;