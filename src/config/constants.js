module.exports = {
  // User roles
  ROLES: {
    EMPLOYEE: 'employee',
    HR: 'hr',
    ADMIN: 'admin'
  },

  // Departments
  DEPARTMENTS: [
    'Engineering',
    'Marketing', 
    'Sales',
    'HR',
    'Finance',
    'Operations',
    'Product'
  ],

  // Mood scale
  MOOD_SCALE: {
    MIN: 1,
    MAX: 5,
    LABELS: {
      1: 'Very Poor',
      2: 'Poor', 
      3: 'Neutral',
      4: 'Good',
      5: 'Excellent'
    }
  },

  // Risk levels
  RISK_LEVELS: {
    LOW: 'low',
    MEDIUM: 'medium', 
    HIGH: 'high'
  },

  // Happy Coins rewards
  HAPPY_COINS: {
    DAILY_CHECKIN: parseInt(process.env.DAILY_CHECKIN_COINS) || 50,
    JOURNAL_ENTRY: parseInt(process.env.JOURNAL_ENTRY_COINS) || 25,
    SURVEY_COMPLETION: parseInt(process.env.SURVEY_COMPLETION_COINS) || 75,
    POSITIVE_MOOD_BONUS: 25, // Extra coins for mood >= 4
    STREAK_BONUS: {
      7: 100,   // 1 week streak
      30: 500,  // 1 month streak
      90: 1500  // 3 month streak
    }
  },

  // Risk detection thresholds
  RISK_THRESHOLDS: {
    LOW_MOOD: parseFloat(process.env.LOW_MOOD_THRESHOLD) || 2.5,
    CONSECUTIVE_LOW_DAYS: parseInt(process.env.CONSECUTIVE_LOW_DAYS) || 3,
    RISK_ALERT: parseFloat(process.env.RISK_ALERT_THRESHOLD) || 0.7
  },

  // Notification types
  NOTIFICATION_TYPES: {
    CHECKIN_REMINDER: 'checkin_reminder',
    SURVEY_REMINDER: 'survey_reminder', 
    RISK_ALERT: 'risk_alert',
    REWARD_UPDATE: 'reward_update',
    MILESTONE_ACHIEVED: 'milestone_achieved'
  },

  // Communication channels
  CHANNELS: {
    EMAIL: 'email',
    WHATSAPP: 'whatsapp',
    BOTH: 'both'
  },

  // Survey types
  SURVEY_TYPES: {
    ONBOARDING: 'onboarding',
    WEEKLY_PULSE: 'weekly_pulse',
    MONTHLY_DETAILED: 'monthly_detailed'
  },

  // API Response codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500
  },

  // Rate limiting
  RATE_LIMITS: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300
  }
};