const cron = require('node-cron');
const whatsappService = require('./whatsapp.service');
const User = require('../../models/User');
const CheckIn = require('../../models/CheckIn');

class WhatsAppScheduledJobs {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Start all scheduled jobs
  start() {
    if (this.isRunning) {
      console.log('⚠️  WhatsApp scheduled jobs already running');
      return;
    }

    try {
      // Daily check-in reminders at 9 AM (Monday-Friday)
      const dailyReminderJob = cron.schedule('0 9 * * 1-5', async () => {
        await this.sendDailyCheckInReminders();
      }, {
        scheduled: false,
        timezone: "UTC"
      });

      // Weekly reports on Friday at 5 PM
      const weeklyReportJob = cron.schedule('0 17 * * 5', async () => {
        await this.sendWeeklyReports();
      }, {
        scheduled: false,
        timezone: "UTC"
      });

      // Test job every 5 minutes (development only)
      let testJob = null;
      if (process.env.NODE_ENV === 'development') {
        testJob = cron.schedule('*/5 * * * *', () => {
          console.log('🔄 WhatsApp test job running every 5 minutes');
        }, {
          scheduled: false,
          timezone: "UTC"
        });
      }

      // Store jobs for management
      this.jobs.set('dailyReminder', dailyReminderJob);
      this.jobs.set('weeklyReport', weeklyReportJob);
      if (testJob) this.jobs.set('test', testJob);

      // Start all jobs
      this.jobs.forEach((job, name) => {
        job.start();
        console.log(`✅ WhatsApp job started: ${name}`);
      });

      this.isRunning = true;
      console.log('🚀 WhatsApp scheduled jobs started');

    } catch (error) {
      console.error('❌ Error starting WhatsApp scheduled jobs:', error);
    }
  }

  // Stop all scheduled jobs
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  WhatsApp scheduled jobs not running');
      return;
    }

    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️  WhatsApp job stopped: ${name}`);
    });

    this.jobs.clear();
    this.isRunning = false;
    console.log('⏹️  WhatsApp scheduled jobs stopped');
  }

  // Send daily check-in reminders
  async sendDailyCheckInReminders() {
    try {
      console.log('📱 Starting daily WhatsApp check-in reminders...');

      // Get users who have WhatsApp enabled and haven't checked in today
      const today = new Date().toISOString().split('T')[0];
      
      const users = await User.find({
        'notifications.preferredChannel': { $in: ['whatsapp', 'both'] },
        'notifications.checkInReminder': true,
        phone: { $exists: true, $ne: null },
        isActive: true
      });

      console.log(`Found ${users.length} users with WhatsApp reminders enabled`);

      let remindersSent = 0;
      let errors = 0;

      for (const user of users) {
        try {
          // Check if user already checked in today
          const todayCheckIn = await CheckIn.findOne({
            userId: user._id,
            date: today
          });

          if (todayCheckIn) {
            console.log(`User ${user.name} already checked in today, skipping`);
            continue;
          }

          // Send reminder
          await whatsappService.sendDailyCheckInReminder(user._id);
          remindersSent++;
          
          // Add delay to avoid rate limiting
          await this.delay(1000); // 1 second delay between messages

        } catch (error) {
          console.error(`Failed to send reminder to ${user.name}:`, error.message);
          errors++;
        }
      }

      console.log(`📱 Daily reminders completed: ${remindersSent} sent, ${errors} errors`);

    } catch (error) {
      console.error('❌ Error in sendDailyCheckInReminders:', error);
    }
  }

  // Send weekly reports
  async sendWeeklyReports() {
    try {
      console.log('📊 Starting weekly WhatsApp reports...');

      // Get users who have WhatsApp enabled and weekly summaries enabled
      const users = await User.find({
        'notifications.preferredChannel': { $in: ['whatsapp', 'both'] },
        'notifications.surveyReminder': true, // Using this for weekly summaries
        phone: { $exists: true, $ne: null },
        isActive: true
      });

      console.log(`Found ${users.length} users for weekly reports`);

      let reportsSent = 0;
      let errors = 0;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7); // Last 7 days

      for (const user of users) {
        try {
          // Generate weekly report data
          const reportData = await this.generateWeeklyReportData(user._id, startDate, endDate);

          // Send report
          await whatsappService.sendWeeklyDataReport(user._id, reportData);
          reportsSent++;
          
          // Add delay to avoid rate limiting
          await this.delay(2000); // 2 second delay between messages

        } catch (error) {
          console.error(`Failed to send weekly report to ${user.name}:`, error.message);
          errors++;
        }
      }

      console.log(`📊 Weekly reports completed: ${reportsSent} sent, ${errors} errors`);

    } catch (error) {
      console.error('❌ Error in sendWeeklyReports:', error);
    }
  }

  // Generate weekly report data for a user
  async generateWeeklyReportData(userId, startDate, endDate) {
    try {
      // Get check-ins for the week
      const checkIns = await CheckIn.find({
        userId,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      });

      // Calculate metrics
      const checkInsCompleted = checkIns.length;
      const averageMood = checkIns.length > 0 
        ? (checkIns.reduce((sum, ci) => sum + ci.mood, 0) / checkIns.length).toFixed(1)
        : 0;
      
      // Calculate happy coins earned this week
      const happyCoinsEarned = checkIns.reduce((sum, ci) => {
        return sum + (ci.rewardEarned?.total || ci.happyCoinsEarned || 50);
      }, 0);

      // Count achievements (simple estimate)
      const achievementsUnlocked = Math.floor(checkInsCompleted / 3); // 1 achievement per 3 check-ins

      return {
        period: 'Past 7 days',
        checkInsCompleted,
        averageMood,
        happyCoinsEarned,
        achievementsUnlocked
      };

    } catch (error) {
      console.error('Error generating weekly report data:', error);
      return {
        period: 'Past 7 days',
        checkInsCompleted: 0,
        averageMood: 0,
        happyCoinsEarned: 0,
        achievementsUnlocked: 0
      };
    }
  }

  // Test sending a reminder to a specific user
  async testReminder(userId) {
    try {
      console.log(`🧪 Testing WhatsApp reminder for user: ${userId}`);
      await whatsappService.sendDailyCheckInReminder(userId);
      console.log('✅ Test reminder sent successfully');
    } catch (error) {
      console.error('❌ Test reminder failed:', error);
      throw error;
    }
  }

  // Test sending a weekly report to a specific user
  async testWeeklyReport(userId) {
    try {
      console.log(`🧪 Testing WhatsApp weekly report for user: ${userId}`);
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);
      
      const reportData = await this.generateWeeklyReportData(userId, startDate, endDate);
      await whatsappService.sendWeeklyDataReport(userId, reportData);
      
      console.log('✅ Test weekly report sent successfully');
    } catch (error) {
      console.error('❌ Test weekly report failed:', error);
      throw error;
    }
  }

  // Utility function to add delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get job status
  getStatus() {
    const jobStatuses = {};
    this.jobs.forEach((job, name) => {
      jobStatuses[name] = {
        running: job.running,
        scheduled: true
      };
    });

    return {
      isRunning: this.isRunning,
      totalJobs: this.jobs.size,
      jobs: jobStatuses,
      nextRun: {
        dailyReminder: 'Monday-Friday at 9:00 AM UTC',
        weeklyReport: 'Friday at 5:00 PM UTC'
      }
    };
  }
}

module.exports = new WhatsAppScheduledJobs();