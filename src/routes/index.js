const express = require('express');
const authRoutes = require('./auth.routes');
const checkInRoutes = require('./checkin.routes');
const profileRoutes = require('./profile.routes');
const onboardingRoutes = require('./onboarding.routes');
const analyticsRoutes = require('./analytics.routes');
const aiRoutes = require('./ai.routes');
const surveyRoutes = require('./surveyRoutes');
const surveyManagementRoutes = require('./survey.management.routes');
const teamRoutes = require('./teamRoutes');
const challengeRoutes = require('./challengeRoutes');
const resourceRoutes = require('./resourceRoutes');
const rewardRoutes = require('./rewardRoutes');
const whatsappRoutes = require('./whatsapp.routes');
const notificationRoutes = require('./notification.routes');
const journalRoutes = require('./journal.routes');
const quotesRoutes = require('./quotes.routes');
const leaderboardRoutes = require('./leaderboard.routes');
const wordAnalyticsRoutes = require('./wordAnalytics.routes');
const employeeManagementRoutes = require('./employeeManagement.routes');

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
        profile: {
          'PUT /api/profile': 'Update profile information (auth required)',
          'PUT /api/profile/preferences': 'Update user preferences (auth required)',
          'POST /api/profile/avatar': 'Upload profile avatar (auth required)',
          'GET /api/profile/wellness-stats': 'Get wellness statistics (auth required)',
          'DELETE /api/profile/account': 'Deactivate account (auth required)'
        },
        onboarding: {
          'GET /api/onboarding/questionnaire': 'Get onboarding questionnaire (auth required)',
          'POST /api/onboarding/submit': 'Submit questionnaire responses (auth required)',
          'GET /api/onboarding/status': 'Get onboarding status and insights (auth required)'
        },
        analytics: {
          'GET /api/analytics/company-overview': 'Get company-wide wellness overview (HR/Admin only)',
          'GET /api/analytics/department/:department': 'Get department-specific analytics (HR/Admin only)',
          'GET /api/analytics/risk-assessment': 'Get risk assessment report (HR/Admin only)',
          'GET /api/analytics/engagement': 'Get engagement metrics and trends (HR/Admin only)',
          'GET /api/analytics/export': 'Export analytics data (HR/Admin only)'
        },
        ai: {
          'GET /api/ai/test': 'Test AI service connection (auth required)',
          'GET /api/ai/insights': 'Get personalized AI insights (auth required)',
          'GET /api/ai/analyze/:checkInId': 'Analyze specific check-in with AI (auth required)',
          'GET /api/ai/summary/weekly': 'Generate AI weekly wellness summary (auth required)',
          'GET /api/ai/risk-assessment/:userId': 'Generate AI risk assessment (HR/Admin only)',
          'GET /api/ai/status': 'Get AI service status (auth required)'
        },
        surveys: {
          'GET /api/surveys/templates': 'Get pulse survey templates (auth required)',
          'GET /api/surveys/active': 'Get active surveys for user (auth required)',
          'GET /api/surveys': 'Get all surveys (auth required)',
          'POST /api/surveys': 'Create new survey (HR/Admin only)',
          'GET /api/surveys/:id': 'Get survey details (auth required)',
          'PUT /api/surveys/:id': 'Update survey (HR/Admin only)',
          'DELETE /api/surveys/:id': 'Delete survey (HR/Admin only)',
          'POST /api/surveys/:id/respond': 'Submit survey response (auth required)',
          'GET /api/surveys/:id/analytics': 'Get survey analytics (HR/Admin only)',
          'PATCH /api/surveys/:id/status': 'Update survey status (HR/Admin only)'
        },
        team: {
          'GET /api/team/overview': 'Get team wellness overview (Manager/HR/Admin only)',
          'GET /api/team/mood-trend': 'Get team mood trend analysis (Manager/HR/Admin only)',
          'GET /api/team/risk-assessment': 'Get team risk assessment (Manager/HR/Admin only)',
          'GET /api/team/survey-participation': 'Get team survey participation (Manager/HR/Admin only)',
          'GET /api/team/engagement': 'Get team engagement metrics (Manager/HR/Admin only)'
        },
        challenges: {
          'GET /api/challenges/templates': 'Get challenge templates (auth required)',
          'GET /api/challenges/active': 'Get active challenges for user (auth required)',
          'GET /api/challenges/my-challenges': 'Get user\'s challenges (auth required)',
          'GET /api/challenges': 'Get all challenges (auth required)',
          'POST /api/challenges': 'Create new challenge (HR/Admin only)',
          'GET /api/challenges/:id': 'Get challenge details (auth required)',
          'PUT /api/challenges/:id': 'Update challenge (HR/Admin only)',
          'DELETE /api/challenges/:id': 'Delete challenge (HR/Admin only)',
          'POST /api/challenges/:id/join': 'Join challenge (auth required)',
          'POST /api/challenges/:id/leave': 'Leave challenge (auth required)',
          'POST /api/challenges/:id/progress': 'Update challenge progress (auth required)',
          'GET /api/challenges/:id/leaderboard': 'Get challenge leaderboard (auth required)',
          'GET /api/challenges/:id/analytics': 'Get challenge analytics (HR/Admin only)',
          'PATCH /api/challenges/:id/status': 'Update challenge status (HR/Admin only)'
        },
        resources: {
          'GET /api/resources/categories': 'Get resource categories (auth required)',
          'GET /api/resources/featured': 'Get featured resources (auth required)',
          'GET /api/resources/popular': 'Get popular resources (auth required)',
          'GET /api/resources/my-history': 'Get user resource history (auth required)',
          'GET /api/resources/category/:category': 'Get resources by category (auth required)',
          'GET /api/resources': 'Get all resources (auth required)',
          'POST /api/resources': 'Create new resource (Admin only)',
          'GET /api/resources/:id': 'Get resource details (auth required)',
          'PUT /api/resources/:id': 'Update resource (Admin only)',
          'DELETE /api/resources/:id': 'Delete resource (Admin only)',
          'POST /api/resources/:id/interact': 'Interact with resource (auth required)',
          'GET /api/resources/:id/analytics': 'Get resource analytics (Admin only)',
          'PATCH /api/resources/:id/status': 'Update resource status (Admin only)'
        },
        rewards: {
          'GET /api/rewards/categories': 'Get reward categories (auth required)',
          'GET /api/rewards/featured': 'Get featured rewards (auth required)',
          'GET /api/rewards/category/:category': 'Get rewards by category (auth required)',
          'GET /api/rewards': 'Get all rewards (auth required)',
          'POST /api/rewards': 'Create new reward (HR/Admin only)',
          'GET /api/rewards/:id': 'Get reward details (auth required)',
          'PUT /api/rewards/:id': 'Update reward (HR/Admin only)',
          'DELETE /api/rewards/:id': 'Delete reward (HR/Admin only)',
          'POST /api/rewards/:id/redeem': 'Redeem reward (auth required)',
          'GET /api/rewards/redemptions/my-redemptions': 'Get user redemptions (auth required)',
          'GET /api/rewards/redemptions/:id': 'Get redemption details (auth required)',
          'PATCH /api/rewards/redemptions/:id/status': 'Update redemption status (HR/Admin only)',
          'POST /api/rewards/redemptions/:id/rate': 'Rate redemption (auth required)',
          'GET /api/rewards/achievements/all': 'Get all achievements (auth required)',
          'GET /api/rewards/achievements/my-achievements': 'Get user achievements (auth required)',
          'POST /api/rewards/achievements': 'Create achievement (HR/Admin only)',
          'POST /api/rewards/recognitions/send': 'Send peer recognition (auth required)',
          'GET /api/rewards/recognitions/my-recognitions': 'Get user recognitions (auth required)',
          'GET /api/rewards/recognitions/team': 'Get team recognitions (auth required)'
        },
        whatsapp: {
          'GET /api/whatsapp/webhook': 'Verify WhatsApp webhook (public)',
          'POST /api/whatsapp/webhook': 'Handle WhatsApp messages (public)',
          'POST /api/whatsapp/send-message': 'Send WhatsApp message (HR/Admin only)',
          'POST /api/whatsapp/send-reminder': 'Send check-in reminder (Admin only)',
          'POST /api/whatsapp/send-report': 'Send weekly report (Admin only)',
          'GET /api/whatsapp/status': 'Get WhatsApp service status (auth required)',
          'POST /api/whatsapp/test-template': 'Test template message (Development only)'
        },
        notifications: {
          'GET /api/notifications': 'Get user notifications with pagination (auth required)',
          'GET /api/notifications/unread-count': 'Get unread notification count (auth required)',
          'GET /api/notifications/stats': 'Get notification statistics (auth required)',
          'PATCH /api/notifications/mark-read': 'Mark specific notifications as read (auth required)',
          'PATCH /api/notifications/mark-all-read': 'Mark all notifications as read (auth required)',
          'POST /api/notifications/test': 'Create test notification (Development only)',
          'POST /api/notifications/send-to-users': 'Send notification to specific users (HR/Admin only)',
          'POST /api/notifications/send-to-all': 'Send notification to all users (Admin only)'
        },
        journals: {
          'GET /api/journals': 'Get user journal entries with pagination and filtering (auth required)',
          'POST /api/journals': 'Create new journal entry (auth required)',
          'GET /api/journals/stats': 'Get user journaling statistics (auth required)',
          'GET /api/journals/prompts': 'Get AI-generated writing prompts (auth required)',
          'GET /api/journals/insights': 'Get AI-powered insights from journal entries (auth required)',
          'GET /api/journals/streak': 'Get user journaling streak information (auth required)',
          'GET /api/journals/search': 'Search through user journal entries (auth required)',
          'GET /api/journals/:id': 'Get specific journal entry (auth required)',
          'PUT /api/journals/:id': 'Update journal entry within 24 hours (auth required)',
          'DELETE /api/journals/:id': 'Delete journal entry (auth required)',
          'POST /api/journals/:id/analyze': 'Request AI analysis of journal entry (auth required)',
          'GET /api/journals/export/data': 'Export user journal data (auth required)',
          'POST /api/journals/import/data': 'Import journal data (auth required)',
          'GET /api/journals/admin/overview': 'Get journaling system overview (Admin/HR only)',
          'GET /api/journals/admin/trends': 'Get journaling trends and patterns (Admin/HR only)'
        },
        quotes: {
          'GET /api/quotes/today': 'Get today\'s personalized motivational quote (auth required)',
          'GET /api/quotes/history': 'Get user\'s quote history with pagination (auth required)',
          'POST /api/quotes/:id/view': 'Mark quote as viewed and track viewing time (auth required)',
          'POST /api/quotes/:id/like': 'Toggle like status for a quote (auth required)',
          'POST /api/quotes/:id/share': 'Mark quote as shared and get shareable content (auth required)',
          'POST /api/quotes/:id/feedback': 'Submit feedback and rating for a quote (auth required)',
          'GET /api/quotes/stats': 'Get user\'s quote engagement statistics (auth required)',
          'GET /api/quotes/categories': 'Get available quote categories (auth required)',
          'GET /api/quotes/search': 'Search through user\'s quote history (auth required)',
          'GET /api/quotes/admin/overview': 'Get quotes system overview and analytics (Admin/HR only)',
          'GET /api/quotes/admin/engagement': 'Get detailed engagement analytics (Admin/HR only)'
        },
        leaderboard: {
          'GET /api/leaderboard/happy-coins': 'Get global Happy Coins leaderboard (auth required)',
          'GET /api/leaderboard/department/:department': 'Get department-specific Happy Coins leaderboard (auth required)',
          'GET /api/leaderboard/stats': 'Get leaderboard statistics and insights (auth required)',
          'GET /api/leaderboard/user/:userId?': 'Get user ranking and nearby users (auth required)'
        },
        users: {
          'GET /api/users': 'Get all users with pagination and filtering (Admin only)',
          'GET /api/users/departments': 'Get all departments list (Admin only)',
          'GET /api/users/:id': 'Get user by ID with wellness stats (Admin only)',
          'POST /api/users': 'Create new user (Admin only)',
          'POST /api/users/bulk-action': 'Perform bulk actions on users (Admin only)',
          'PUT /api/users/:id': 'Update user details (Admin only)',
          'PATCH /api/users/:id/status': 'Toggle user active/inactive status (Admin only)',
          'PATCH /api/users/:id/role': 'Update user role (Admin only)',
          'DELETE /api/users/:id': 'Delete user (Admin only)'
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
router.use('/profile', profileRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/ai', aiRoutes);
router.use('/surveys', surveyRoutes);
router.use('/surveys/management', surveyManagementRoutes);
router.use('/team', teamRoutes);
router.use('/challenges', challengeRoutes);
router.use('/resources', resourceRoutes);
router.use('/rewards', rewardRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/notifications', notificationRoutes);
router.use('/journals', journalRoutes);
router.use('/quotes', quotesRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/word-analytics', wordAnalyticsRoutes);
router.use('/employee-management', employeeManagementRoutes);

// User management routes (Admin only)
router.use('/users', require('./user.routes'));

module.exports = router;