const cron = require('node-cron');
const User = require('../models/User');
const DailyQuote = require('../models/DailyQuote');
const quotesController = require('../controllers/quotes.controller');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isEnabled = process.env.ENABLE_SCHEDULED_JOBS !== 'false';
    
    if (this.isEnabled) {
      console.log('🕐 Scheduler service initialized');
      this.initializeJobs();
    } else {
      console.log('🕐 Scheduled jobs disabled');
    }
  }

  initializeJobs() {
    // Daily quote generation - runs every day at 6:00 AM
    this.scheduleJob('dailyQuotes', '0 6 * * *', this.generateDailyQuotesForAllUsers.bind(this));
    
    // Weekly journal insights - runs every Sunday at 8:00 AM
    this.scheduleJob('weeklyInsights', '0 8 * * 0', this.generateWeeklyInsights.bind(this));
    
    // Monthly analytics - runs on the 1st of each month at 9:00 AM
    this.scheduleJob('monthlyAnalytics', '0 9 1 * *', this.generateMonthlyAnalytics.bind(this));
    
    // Cleanup old quotes - runs daily at 2:00 AM
    this.scheduleJob('cleanupQuotes', '0 2 * * *', this.cleanupOldQuotes.bind(this));
  }

  scheduleJob(name, cronExpression, task) {
    try {
      const job = cron.schedule(cronExpression, async () => {
        console.log(`🔄 Running scheduled job: ${name}`);
        try {
          await task();
          console.log(`✅ Completed scheduled job: ${name}`);
        } catch (error) {
          console.error(`❌ Error in scheduled job ${name}:`, error);
        }
      }, {
        scheduled: true,
        timezone: process.env.TIMEZONE || 'UTC'
      });

      this.jobs.set(name, job);
      console.log(`📅 Scheduled job '${name}' with expression: ${cronExpression}`);
    } catch (error) {
      console.error(`❌ Failed to schedule job ${name}:`, error);
    }
  }

  async generateDailyQuotesForAllUsers() {
    console.log('🌅 Starting daily quote generation for all users...');
    
    try {
      // Get all active users
      const activeUsers = await User.find({ 
        isActive: true,
        isDeleted: false 
      }).select('_id name email wellness');

      console.log(`📊 Found ${activeUsers.length} active users`);

      const today = new Date().toISOString().split('T')[0];
      let generated = 0;
      let skipped = 0;
      let errors = 0;

      // Process users in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < activeUsers.length; i += batchSize) {
        const batch = activeUsers.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (user) => {
          try {
            // Check if user already has a quote for today
            const existingQuote = await DailyQuote.findOne({
              userId: user._id,
              date: today
            });

            if (existingQuote) {
              skipped++;
              return;
            }

            // Generate quote for this user
            const quote = await quotesController.generateTodayQuote(user._id);
            if (quote) {
              generated++;
            } else {
              errors++;
            }
          } catch (error) {
            console.error(`Error generating quote for user ${user._id}:`, error);
            errors++;
          }
        }));

        // Small delay between batches to be gentle on the system
        if (i + batchSize < activeUsers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Daily quote generation completed: ${generated} generated, ${skipped} skipped, ${errors} errors`);
    } catch (error) {
      console.error('❌ Error in daily quote generation:', error);
    }
  }

  async generateWeeklyInsights() {
    console.log('📈 Starting weekly insights generation...');
    
    try {
      // This would generate weekly insights for users with journal entries
      // For now, just log that the job ran
      console.log('📊 Weekly insights job completed (placeholder implementation)');
    } catch (error) {
      console.error('❌ Error in weekly insights generation:', error);
    }
  }

  async generateMonthlyAnalytics() {
    console.log('📊 Starting monthly analytics generation...');
    
    try {
      // This would generate monthly analytics reports
      // For now, just log that the job ran
      console.log('📈 Monthly analytics job completed (placeholder implementation)');
    } catch (error) {
      console.error('❌ Error in monthly analytics generation:', error);
    }
  }

  async cleanupOldQuotes() {
    console.log('🧹 Starting old quotes cleanup...');
    
    try {
      // Keep quotes for 90 days, then archive them
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      
      const result = await DailyQuote.updateMany(
        {
          createdAt: { $lt: cutoffDate },
          status: { $ne: 'archived' }
        },
        {
          $set: { status: 'archived' }
        }
      );

      console.log(`🗃️ Archived ${result.modifiedCount} old quotes`);
    } catch (error) {
      console.error('❌ Error in quotes cleanup:', error);
    }
  }

  // Manual job triggers for testing/admin use
  async triggerJob(jobName) {
    if (!this.jobs.has(jobName)) {
      throw new Error(`Job '${jobName}' not found`);
    }

    console.log(`🚀 Manually triggering job: ${jobName}`);
    
    switch (jobName) {
      case 'dailyQuotes':
        await this.generateDailyQuotesForAllUsers();
        break;
      case 'weeklyInsights':
        await this.generateWeeklyInsights();
        break;
      case 'monthlyAnalytics':
        await this.generateMonthlyAnalytics();
        break;
      case 'cleanupQuotes':
        await this.cleanupOldQuotes();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  // Get job status
  getJobStatus() {
    const jobs = [];
    
    for (const [name, job] of this.jobs) {
      jobs.push({
        name,
        running: job.running || false,
        scheduled: true,
        nextRun: job.nextDate ? job.nextDate() : null
      });
    }
    
    return {
      enabled: this.isEnabled,
      totalJobs: this.jobs.size,
      jobs
    };
  }

  // Stop all jobs
  stopAllJobs() {
    console.log('🛑 Stopping all scheduled jobs...');
    
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`⏹️ Stopped job: ${name}`);
    }
    
    this.jobs.clear();
  }

  // Start all jobs
  startAllJobs() {
    if (!this.isEnabled) {
      console.log('📵 Scheduled jobs are disabled');
      return;
    }

    console.log('▶️ Starting all scheduled jobs...');
    this.initializeJobs();
  }
}

module.exports = new SchedulerService();