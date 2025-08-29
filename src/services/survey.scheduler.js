const cron = require('node-cron');
const Survey = require('../models/Survey');
const User = require('../models/User');
const notificationService = require('./notifications/notification.service');
const slackSurveyService = require('./slack/slackSurvey.service');

class SurveyScheduler {
  constructor() {
    this.scheduledJobs = new Map();
    this.cronJobs = [];
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    console.log('📅 Initializing survey scheduler...');
    
    try {
    // Schedule automatic pulse survey creation every Monday at 9:00 AM
    cron.schedule('0 9 * * 1', async () => {
      console.log('🔄 Running weekly pulse survey scheduler...');
      await this.createWeeklyPulseSurvey();
    });

    // Schedule survey reminder notifications every day at 10:00 AM
    cron.schedule('0 10 * * *', async () => {
      console.log('🔔 Running survey reminder scheduler...');
      await this.sendSurveyReminders();
    });

    // Schedule survey closure check every day at 11:59 PM
    cron.schedule('59 23 * * *', async () => {
      console.log('🔚 Running survey closure scheduler...');
      await this.closeExpiredSurveys();
    });

      this.isInitialized = true;
      console.log('✅ Survey scheduler initialized successfully');
    } catch (error) {
      console.error('❌ Survey scheduler initialization failed:', error.message);
      console.warn('⚠️  Survey scheduling will be disabled');
    }
  }

  async createWeeklyPulseSurvey() {
    try {
      // Check if a pulse survey already exists for this week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6); // Sunday
      endOfWeek.setHours(23, 59, 59, 999);

      const existingSurvey = await Survey.findOne({
        type: 'pulse',
        status: { $in: ['active', 'draft'] },
        createdAt: { $gte: startOfWeek, $lte: endOfWeek }
      });

      if (existingSurvey) {
        console.log('📋 Weekly pulse survey already exists for this week');
        return;
      }

      // Get active employees count for targeting
      const activeEmployeeCount = await User.countDocuments({
        role: 'employee',
        isActive: true
      });

      if (activeEmployeeCount === 0) {
        console.log('👥 No active employees found, skipping pulse survey creation');
        return;
      }

      // Create the weekly pulse survey
      const weekNumber = this.getWeekNumber(new Date());
      const year = new Date().getFullYear();
      
      const survey = new Survey({
        title: `Weekly Engagement Pulse - Week ${weekNumber}, ${year}`,
        description: 'Quick weekly check-in to understand how you\'re feeling at work and identify any support you might need.',
        type: 'pulse',
        priority: 'high',
        status: 'active',
        questions: [
          {
            id: 'enps_weekly',
            question: `On a scale of 0-10, how likely are you to recommend ${process.env.COMPANY_NAME || 'our company'} as a great place to work this week?`,
            type: 'scale',
            scale: {
              min: 0,
              max: 10,
              labels: new Map([
                ['0', 'Not at all likely'],
                ['5', 'Neutral'],
                ['10', 'Extremely likely']
              ])
            },
            category: 'eNPS',
            required: true
          },
          {
            id: 'engagement_weekly',
            question: 'How engaged do you feel at work this week?',
            type: 'scale',
            scale: {
              min: 1,
              max: 5,
              labels: new Map([
                ['1', 'Not engaged'],
                ['2', 'Slightly engaged'],
                ['3', 'Moderately engaged'],
                ['4', 'Highly engaged'],
                ['5', 'Completely engaged']
              ])
            },
            category: 'engagement',
            required: true
          },
          {
            id: 'workload_weekly',
            question: 'How manageable has your workload been this week?',
            type: 'scale',
            scale: {
              min: 1,
              max: 5,
              labels: new Map([
                ['1', 'Overwhelming'],
                ['2', 'Heavy'],
                ['3', 'Just right'],
                ['4', 'Light'],
                ['5', 'Too light']
              ])
            },
            category: 'wellbeing',
            required: true
          },
          {
            id: 'support_weekly',
            question: 'Do you feel adequately supported by your team and manager this week?',
            type: 'boolean',
            category: 'leadership',
            required: true
          },
          {
            id: 'feedback_weekly',
            question: 'What\'s one thing that would improve your work experience next week?',
            type: 'text',
            category: 'feedback',
            required: false
          }
        ],
        schedule: {
          frequency: 'weekly',
          dayOfWeek: 1, // Monday
          time: '09:00',
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        },
        targetAudience: {
          all: true,
          departments: [],
          roles: [],
          specific_users: []
        },
        rewards: {
          happyCoins: 100
        },
        dueDate: endOfWeek,
        createdBy: await this.getSystemUserId()
      });

      await survey.save();
      console.log(`✅ Created weekly pulse survey: ${survey.title}`);

      // Send notifications to all employees about the new survey
      await this.notifyEmployeesAboutNewSurvey(survey);

      return survey;
    } catch (error) {
      console.error('Error creating weekly pulse survey:', error);
      throw error;
    }
  }

  async sendSurveyReminders() {
    try {
      // Find all active surveys that are due within 2 days
      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
      
      const upcomingSurveys = await Survey.find({
        status: 'active',
        dueDate: { $lte: twoDaysFromNow, $gte: new Date() },
        priority: { $in: ['high', 'urgent'] }
      });

      for (const survey of upcomingSurveys) {
        // Get all targeted users who haven't responded yet
        const targetUsers = await this.getTargetUsers(survey);
        const usersNeedingReminders = targetUsers.filter(user => 
          !survey.hasUserResponded(user._id)
        );

        if (usersNeedingReminders.length > 0) {
          await this.sendSurveyReminderNotifications(survey, usersNeedingReminders);
          console.log(`📬 Sent reminders for survey "${survey.title}" to ${usersNeedingReminders.length} users`);
        }
      }
    } catch (error) {
      console.error('Error sending survey reminders:', error);
    }
  }

  async closeExpiredSurveys() {
    try {
      // Find all active surveys that are past their due date
      const expiredSurveys = await Survey.find({
        status: 'active',
        dueDate: { $lt: new Date() }
      });

      for (const survey of expiredSurveys) {
        survey.status = 'closed';
        await survey.save();
        console.log(`🔒 Closed expired survey: ${survey.title}`);
      }

      if (expiredSurveys.length > 0) {
        console.log(`✅ Closed ${expiredSurveys.length} expired surveys`);
      }
    } catch (error) {
      console.error('Error closing expired surveys:', error);
    }
  }

  async notifyEmployeesAboutNewSurvey(survey) {
    try {
      const targetUsers = await this.getTargetUsers(survey);
      
      const notification = {
        title: 'New Pulse Survey Available',
        message: `A new ${survey.priority} priority survey "${survey.title}" is now available. Complete it to earn ${survey.rewards.happyCoins} Happy Coins!`,
        type: 'survey',
        priority: survey.priority,
        actionUrl: '/employee/surveys',
        metadata: {
          surveyId: survey._id,
          dueDate: survey.dueDate,
          estimatedTime: Math.ceil(survey.questions.length * 1.5),
          happyCoins: survey.rewards.happyCoins
        }
      };

      // Send notifications to all target users
      await notificationService.sendToMultipleUsers(
        targetUsers.map(user => user._id),
        notification
      );

      // Also send via Slack to connected users
      let slackCount = 0;
      for (const user of targetUsers) {
        if (user.integrations?.slack?.isConnected && user.notifications?.preferredChannel !== 'email') {
          const sent = await slackSurveyService.sendSurveyToUser(user._id, survey._id);
          if (sent) slackCount++;
        }
      }

      console.log(`📱 Sent survey notifications to ${targetUsers.length} employees (${slackCount} via Slack)`);
    } catch (error) {
      console.error('Error notifying employees about new survey:', error);
    }
  }

  async sendSurveyReminderNotifications(survey, users) {
    try {
      const daysUntilDue = Math.ceil((survey.dueDate - new Date()) / (1000 * 60 * 60 * 24));
      
      const notification = {
        title: 'Survey Reminder',
        message: `Don't forget to complete "${survey.title}" - due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}! Earn ${survey.rewards.happyCoins} Happy Coins.`,
        type: 'reminder',
        priority: survey.priority,
        actionUrl: '/employee/surveys',
        metadata: {
          surveyId: survey._id,
          dueDate: survey.dueDate,
          isReminder: true
        }
      };

      await notificationService.sendToMultipleUsers(
        users.map(user => user._id),
        notification
      );

      // Also send reminders via Slack to connected users
      for (const user of users) {
        if (user.integrations?.slack?.isConnected && user.notifications?.preferredChannel !== 'email') {
          await slackSurveyService.sendSurveyToUser(user._id, survey._id);
        }
      }
    } catch (error) {
      console.error('Error sending survey reminder notifications:', error);
    }
  }

  async getTargetUsers(survey) {
    const query = { isActive: true, role: 'employee' };
    
    if (!survey.targetAudience.all) {
      const conditions = [];
      
      if (survey.targetAudience.departments.length > 0) {
        conditions.push({ department: { $in: survey.targetAudience.departments } });
      }
      
      if (survey.targetAudience.roles.length > 0) {
        conditions.push({ role: { $in: survey.targetAudience.roles } });
      }
      
      if (survey.targetAudience.specific_users.length > 0) {
        conditions.push({ _id: { $in: survey.targetAudience.specific_users } });
      }
      
      if (conditions.length > 0) {
        query.$or = conditions;
      }
    }
    
    return await User.find(query).select('_id name email department integrations notifications');
  }

  async getSystemUserId() {
    // Try to find a system admin user, or create one if needed
    let systemUser = await User.findOne({ 
      role: 'admin', 
      email: process.env.SYSTEM_EMAIL || 'system@company.com' 
    });

    if (!systemUser) {
      // Create a system user if none exists
      systemUser = await User.findOne({ role: 'admin' });
      if (!systemUser) {
        // If no admin exists, find any HR user
        systemUser = await User.findOne({ role: 'hr' });
      }
    }

    return systemUser ? systemUser._id : null;
  }

  getWeekNumber(date) {
    const startDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
    return Math.ceil(days / 7);
  }

  // Manual trigger methods for testing/admin use
  async triggerWeeklyPulseSurvey() {
    console.log('🎯 Manually triggering weekly pulse survey creation...');
    return await this.createWeeklyPulseSurvey();
  }

  async triggerSurveyReminders() {
    console.log('🎯 Manually triggering survey reminders...');
    return await this.sendSurveyReminders();
  }

  async triggerSurveyClosures() {
    console.log('🎯 Manually triggering survey closures...');
    return await this.closeExpiredSurveys();
  }

  // Method to schedule a custom survey
  async scheduleCustomSurvey(surveyData, scheduleOptions) {
    try {
      const { frequency, dayOfWeek, time, duration } = scheduleOptions;
      
      // Create the survey with scheduled status
      const survey = new Survey({
        ...surveyData,
        status: 'draft',
        schedule: {
          frequency,
          dayOfWeek,
          time,
          startDate: new Date(),
          endDate: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : undefined
        }
      });

      await survey.save();
      
      // Schedule the cron job based on frequency
      if (frequency === 'weekly') {
        const cronPattern = this.buildWeeklyCronPattern(dayOfWeek, time);
        this.scheduledJobs.set(survey._id.toString(), {
          job: cron.schedule(cronPattern, async () => {
            await this.activateScheduledSurvey(survey._id);
          }),
          pattern: cronPattern
        });
      }

      console.log(`📅 Scheduled custom survey: ${survey.title}`);
      return survey;
    } catch (error) {
      console.error('Error scheduling custom survey:', error);
      throw error;
    }
  }

  buildWeeklyCronPattern(dayOfWeek, time) {
    const [hour, minute] = time.split(':');
    return `${minute} ${hour} * * ${dayOfWeek}`;
  }

  async activateScheduledSurvey(surveyId) {
    try {
      const survey = await Survey.findById(surveyId);
      if (survey && survey.status === 'draft') {
        survey.status = 'active';
        await survey.save();
        
        await this.notifyEmployeesAboutNewSurvey(survey);
        console.log(`✅ Activated scheduled survey: ${survey.title}`);
      }
    } catch (error) {
      console.error('Error activating scheduled survey:', error);
    }
  }

  // Cleanup method
  destroy() {
    this.scheduledJobs.forEach((scheduledJob) => {
      scheduledJob.job.destroy();
    });
    this.scheduledJobs.clear();
    console.log('🧹 Survey scheduler cleanup completed');
  }
}

// Create singleton instance
const surveyScheduler = new SurveyScheduler();

module.exports = surveyScheduler;