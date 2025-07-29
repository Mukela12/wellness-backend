const { validationResult } = require('express-validator');
const DailyQuote = require('../models/DailyQuote');
const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const Journal = require('../models/Journal');
const openaiService = require('../services/openai.service');
const notificationService = require('../services/notifications/notification.service');
const { HTTP_STATUS } = require('../config/constants');

class QuotesController {

  // Get today's quote for the user
  async getTodayQuote(req, res) {
    try {
      const userId = req.user._id;
      const today = new Date().toISOString().split('T')[0];

      // Check if user already has a quote for today
      let todayQuote = await DailyQuote.getTodayQuote(userId);

      if (!todayQuote) {
        // Generate new quote for today
        todayQuote = await quotesController.generateTodayQuote(userId);
        
        if (!todayQuote) {
          return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
            success: false,
            message: 'Unable to generate today\'s quote. Please try again later.'
          });
        }
      }

      // Mark as delivered if not already
      if (todayQuote.status === 'generated') {
        todayQuote.status = 'delivered';
        todayQuote.deliveredAt = new Date();
        await todayQuote.save();
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Today\'s quote retrieved successfully',
        data: {
          quote: {
            id: todayQuote._id,
            quote: todayQuote.quote,
            author: todayQuote.author,
            category: todayQuote.category,
            date: todayQuote.date,
            formattedDate: todayQuote.formattedDate,
            actionPrompt: todayQuote.actionPrompt,
            tags: todayQuote.tags,
            personalization: {
              moodMatch: todayQuote.personalization.moodMatch,
              relevance: todayQuote.personalization.relevance,
              intention: todayQuote.personalization.intention
            },
            engagement: {
              viewed: todayQuote.engagement.viewed,
              liked: todayQuote.engagement.liked,
              shared: todayQuote.engagement.shared
            },
            isNew: todayQuote.status === 'delivered' && !todayQuote.engagement.viewed
          }
        }
      });

    } catch (error) {
      console.error('Get today quote error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve today\'s quote'
      });
    }
  }

  // Get quote history for the user
  async getQuoteHistory(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { days = 30, page = 1, limit = 20 } = req.query;
      const userId = req.user._id;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - parseInt(days) * 24 * 60 * 60 * 1000);

      const quotes = await DailyQuote.find({
        userId,
        date: {
          $gte: startDate.toISOString().split('T')[0],
          $lte: endDate.toISOString().split('T')[0]
        }
      })
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('quote author category date formattedDate tags engagement userFeedback actionPrompt');

      const totalCount = await DailyQuote.countDocuments({
        userId,
        date: {
          $gte: startDate.toISOString().split('T')[0],
          $lte: endDate.toISOString().split('T')[0]
        }
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Quote history retrieved successfully',
        data: {
          quotes: quotes.map(quote => ({
            id: quote._id,
            quote: quote.quote,
            author: quote.author,
            category: quote.category,
            date: quote.date,
            formattedDate: quote.formattedDate,
            tags: quote.tags,
            actionPrompt: quote.actionPrompt,
            engagement: quote.engagement,
            userRating: quote.userFeedback?.rating,
            engagementScore: quote.engagementScore
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount,
            hasNext: skip + quotes.length < totalCount,
            hasPrev: parseInt(page) > 1
          },
          period: `${days} days`
        }
      });

    } catch (error) {
      console.error('Get quote history error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve quote history'
      });
    }
  }

  // Mark quote as viewed
  async markQuoteViewed(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { timeSpent = 0 } = req.body;
      const userId = req.user._id;

      const quote = await DailyQuote.findOne({ _id: id, userId });

      if (!quote) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Quote not found'
        });
      }

      await quote.markAsViewed(timeSpent);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Quote marked as viewed',
        data: {
          engagement: quote.engagement
        }
      });

    } catch (error) {
      console.error('Mark quote viewed error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to mark quote as viewed'
      });
    }
  }

  // Toggle quote like status
  async toggleQuoteLike(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const userId = req.user._id;

      const quote = await DailyQuote.findOne({ _id: id, userId });

      if (!quote) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Quote not found'
        });
      }

      await quote.toggleLike();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Quote ${quote.engagement.liked ? 'liked' : 'unliked'} successfully`,
        data: {
          liked: quote.engagement.liked,
          engagement: quote.engagement
        }
      });

    } catch (error) {
      console.error('Toggle quote like error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to toggle quote like'
      });
    }
  }

  // Share a quote
  async shareQuote(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { platform } = req.body;
      const userId = req.user._id;

      const quote = await DailyQuote.findOne({ _id: id, userId });

      if (!quote) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Quote not found'
        });
      }

      await quote.markAsShared();

      // Create shareable content
      const shareableContent = {
        text: `"${quote.quote}" - ${quote.author}`,
        hashtags: quote.tags.map(tag => `#${tag.replace(/\s+/g, '')}`).join(' '),
        url: `${process.env.FRONTEND_URL || 'https://app.wellness.com'}/quotes/${quote._id}`,
        actionPrompt: quote.actionPrompt
      };

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Quote prepared for sharing',
        data: {
          shared: true,
          shareableContent,
          platform,
          engagement: quote.engagement
        }
      });

    } catch (error) {
      console.error('Share quote error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to share quote'
      });
    }
  }

  // Submit feedback for a quote
  async submitQuoteFeedback(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { rating, helpful, comment } = req.body;
      const userId = req.user._id;

      const quote = await DailyQuote.findOne({ _id: id, userId });

      if (!quote) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Quote not found'
        });
      }

      await quote.addFeedback(rating, helpful, comment);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Feedback submitted successfully',
        data: {
          feedback: quote.userFeedback
        }
      });

    } catch (error) {
      console.error('Submit quote feedback error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to submit feedback'
      });
    }
  }

  // Get user's quote engagement statistics
  async getQuoteStats(req, res) {
    try {
      const { days = 30 } = req.query;
      const userId = req.user._id;

      const stats = await DailyQuote.getEngagementStats(userId, parseInt(days));
      const statsData = stats[0] || {
        totalQuotes: 0,
        viewedQuotes: 0,
        likedQuotes: 0,
        sharedQuotes: 0,
        viewRate: 0,
        likeRate: 0,
        avgRating: 0,
        avgTimePerQuote: 0,
        categoryDistribution: [],
        tags: []
      };

      // Calculate additional insights
      const recentQuotes = await DailyQuote.getQuoteHistory(userId, 7);
      const currentStreak = quotesController.calculateQuoteStreak(recentQuotes);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Quote statistics retrieved successfully',
        data: {
          period: `${days} days`,
          statistics: {
            ...statsData,
            currentStreak,
            categoryPreferences: quotesController.calculateCategoryPreferences(statsData.categoryDistribution),
            engagementTrend: quotesController.calculateEngagementTrend(recentQuotes)
          }
        }
      });

    } catch (error) {
      console.error('Get quote stats error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve quote statistics'
      });
    }
  }

  // Admin/HR: Get quotes system overview
  async getQuotesOverview(req, res) {
    try {
      const { period = 'month', department } = req.query;
      
      const overview = await quotesController.generateQuotesSystemOverview(period, department);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Quotes system overview retrieved successfully',
        data: overview
      });

    } catch (error) {
      console.error('Get quotes overview error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve quotes overview'
      });
    }
  }

  // Generate today's quote for a user
  async generateTodayQuote(userId) {
    try {
      if (!openaiService.isEnabled) {
        // Return a fallback quote if AI service is disabled
        return await quotesController.createFallbackQuote(userId);
      }

      // Get user context for personalization
      const user = await User.findById(userId);
      const recentCheckIns = await CheckIn.find({ userId })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('mood feedback createdAt');

      const recentJournals = await Journal.find({ userId, isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('category mood createdAt aiInsights.keyThemes');

      // Get recent quotes to avoid repetition
      const previousQuotes = await DailyQuote.getRecentQuotesForContext(userId, 14);

      // Prepare context for AI generation
      const quoteContext = {
        user: {
          name: user.name,
          department: user.department
        },
        currentMood: recentCheckIns.length > 0 ? recentCheckIns[0].mood : 3,
        recentMoods: recentCheckIns.map(ci => ci.mood),
        riskLevel: user.wellness?.riskLevel || 'low',
        recentThemes: [
          ...recentJournals.flatMap(j => j.aiInsights?.keyThemes || []),
          ...recentJournals.map(j => j.category)
        ].filter(Boolean),
        previousQuotes: previousQuotes.map(q => ({
          quote: q.quote,
          author: q.author,
          date: q.date
        }))
      };

      // Generate quote using AI
      const aiQuoteResult = await openaiService.generateDailyQuote(quoteContext);

      if (!aiQuoteResult) {
        return await quotesController.createFallbackQuote(userId);
      }

      // Create and save the quote
      const today = new Date().toISOString().split('T')[0];
      const dailyQuote = new DailyQuote({
        date: today,
        userId,
        quote: aiQuoteResult.quote,
        author: aiQuoteResult.author,
        category: aiQuoteResult.category,
        personalization: {
          moodMatch: aiQuoteResult.personalization?.moodMatch,
          relevance: aiQuoteResult.personalization?.relevance,
          intention: aiQuoteResult.personalization?.intention,
          basedOnMood: quoteContext.currentMood,
          basedOnRisk: quoteContext.riskLevel,
          recentThemes: quoteContext.recentThemes.slice(0, 5)
        },
        actionPrompt: aiQuoteResult.actionPrompt,
        tags: aiQuoteResult.tags || [],
        aiGeneration: {
          model: 'gpt-4o-mini',
          temperature: 0.8,
          usage: aiQuoteResult.usage,
          generatedAt: new Date(),
          previousQuotesConsidered: quoteContext.previousQuotes
        }
      });

      await dailyQuote.save();

      // Send notification about new quote
      setImmediate(async () => {
        try {
          await notificationService.createNotification(userId, {
            type: 'DAILY_CONTENT',
            title: 'Your Daily Motivation is Ready! ✨',
            message: `Start your day with inspiration: "${aiQuoteResult.quote.substring(0, 80)}${aiQuoteResult.quote.length > 80 ? '...' : ''}"`,
            data: {
              quoteId: dailyQuote._id,
              category: dailyQuote.category,
              author: dailyQuote.author
            },
            priority: 'medium',
            icon: 'quote',
            actionType: 'navigate',
            actionData: { route: '/quotes/today' },
            source: 'daily-quotes'
          });
        } catch (error) {
          console.error('Error creating quote notification:', error);
        }
      });

      return dailyQuote;

    } catch (error) {
      console.error('Error generating today\'s quote:', error);
      return await quotesController.createFallbackQuote(userId);
    }
  }

  // Create a fallback quote when AI is unavailable
  async createFallbackQuote(userId) {
    try {
      const fallbackQuotes = [
        {
          quote: "The only way to do great work is to love what you do.",
          author: "Steve Jobs",
          category: "motivation",
          actionPrompt: "Reflect on what you love about your work today.",
          tags: ["work", "passion", "greatness"]
        },
        {
          quote: "Your limitation—it's only your imagination.",
          author: "Unknown",
          category: "growth",
          actionPrompt: "Challenge one limiting belief you have about yourself.",
          tags: ["mindset", "growth", "potential"]
        },
        {
          quote: "Wellness is not a destination, but a journey of self-discovery.",
          author: "Unknown",
          category: "wellness",
          actionPrompt: "Take 5 minutes to check in with yourself and your needs.",
          tags: ["wellness", "self-care", "journey"]
        },
        {
          quote: "Progress, not perfection, is the goal.",
          author: "Unknown",
          category: "resilience",
          actionPrompt: "Celebrate one small step you took toward your goals today.",
          tags: ["progress", "growth", "self-compassion"]
        }
      ];

      const randomQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
      const today = new Date().toISOString().split('T')[0];

      const dailyQuote = new DailyQuote({
        date: today,
        userId,
        ...randomQuote,
        personalization: {
          moodMatch: "This quote is designed to provide general motivation and encouragement.",
          relevance: "Universal wisdom that applies to personal and professional growth.",
          intention: "To inspire and motivate continued progress on your wellness journey.",
          basedOnMood: 3,
          basedOnRisk: 'low',
          recentThemes: ['general-wellness']
        }
      });

      await dailyQuote.save();
      return dailyQuote;

    } catch (error) {
      console.error('Error creating fallback quote:', error);
      return null;
    }
  }

  // Helper methods
  calculateQuoteStreak(recentQuotes) {
    if (!recentQuotes || recentQuotes.length === 0) {
      return { current: 0, longest: 0 };
    }

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const today = new Date();
    
    // Check current streak (consecutive days with viewed quotes)
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const quote = recentQuotes.find(q => q.date === dateStr);
      if (quote && quote.engagement.viewed) {
        if (i === 0 || currentStreak > 0) {
          currentStreak++;
        }
      } else if (i === 0) {
        // If today's quote isn't viewed, current streak is 0
        currentStreak = 0;
        break;
      } else {
        break;
      }
    }

    // Calculate longest streak from all quotes
    recentQuotes.forEach(quote => {
      if (quote.engagement.viewed) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });

    return { current: currentStreak, longest: longestStreak };
  }

  calculateCategoryPreferences(categories) {
    const categoryCount = {};
    categories.forEach(cat => {
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const sortedCategories = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .map(([category, count]) => ({ category, count }));

    return sortedCategories.slice(0, 3); // Top 3 preferred categories
  }

  calculateEngagementTrend(recentQuotes) {
    if (recentQuotes.length < 2) return 'insufficient_data';

    const recent = recentQuotes.slice(0, 3);
    const older = recentQuotes.slice(3, 6);

    const recentEngagement = recent.reduce((sum, q) => sum + q.engagementScore, 0) / recent.length;
    const olderEngagement = older.length > 0 ? older.reduce((sum, q) => sum + q.engagementScore, 0) / older.length : 0;

    if (recentEngagement > olderEngagement * 1.1) return 'improving';
    if (recentEngagement < olderEngagement * 0.9) return 'declining';
    return 'stable';
  }

  async generateQuotesSystemOverview(period, department) {
    // Implementation for admin overview - basic version
    const dateRange = quotesController.calculateDateRange(period);
    
    try {
      const totalQuotes = await DailyQuote.countDocuments({
        createdAt: { $gte: dateRange.start, $lte: dateRange.end }
      });

      const engagementStats = await DailyQuote.aggregate([
        {
          $match: {
            createdAt: { $gte: dateRange.start, $lte: dateRange.end }
          }
        },
        {
          $group: {
            _id: null,
            totalQuotes: { $sum: 1 },
            totalViewed: { $sum: { $cond: ['$engagement.viewed', 1, 0] } },
            totalLiked: { $sum: { $cond: ['$engagement.liked', 1, 0] } },
            avgRating: { $avg: '$userFeedback.rating' },
            categories: { $push: '$category' }
          }
        }
      ]);

      const stats = engagementStats[0] || {
        totalQuotes: 0,
        totalViewed: 0,
        totalLiked: 0,
        avgRating: 0,
        categories: []
      };

      return {
        period,
        department: department || 'all',
        overview: {
          totalQuotesGenerated: totalQuotes,
          viewRate: totalQuotes > 0 ? Math.round((stats.totalViewed / totalQuotes) * 100) : 0,
          likeRate: stats.totalViewed > 0 ? Math.round((stats.totalLiked / stats.totalViewed) * 100) : 0,
          averageRating: Math.round(stats.avgRating * 100) / 100 || 0,
          categoryDistribution: quotesController.calculateCategoryPreferences(stats.categories)
        },
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error generating quotes system overview:', error);
      return {
        error: 'Failed to generate overview',
        generatedAt: new Date()
      };
    }
  }

  calculateDateRange(period) {
    const now = new Date();
    let start;

    switch (period) {
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterStart, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end: now };
  }
}

const quotesController = new QuotesController();
module.exports = quotesController;