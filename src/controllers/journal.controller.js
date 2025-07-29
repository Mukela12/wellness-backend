const { validationResult } = require('express-validator');
const Journal = require('../models/Journal');
const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const openaiService = require('../services/openai.service');
const notificationService = require('../services/notifications/notification.service');
const { HTTP_STATUS } = require('../config/constants');

class JournalController {
  
  // Get user's journal entries with pagination and filtering
  async getJournals(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        page = 1,
        limit = 20,
        category,
        mood,
        startDate,
        endDate,
        tags,
        search
      } = req.query;

      const userId = req.user._id;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build query
      const query = {
        userId,
        isDeleted: false
      };

      if (category) query.category = category;
      if (mood) query.mood = parseInt(mood);
      if (tags) {
        const tagArray = tags.split(',').map(tag => tag.trim().toLowerCase());
        query.tags = { $in: tagArray };
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      // Execute query
      const journals = await Journal.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-content'); // Exclude full content for list view

      const totalCount = await Journal.countDocuments(query);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Journals retrieved successfully',
        data: {
          journals: journals.map(journal => ({
            id: journal._id,
            title: journal.title,
            summary: journal.getSummary(100),
            mood: journal.mood,
            moodLabel: journal.moodLabel,
            category: journal.category,
            tags: journal.tags,
            wordCount: journal.wordCount,
            readingTime: journal.readingTime,
            privacy: journal.privacy,
            createdAt: journal.createdAt,
            dateFormatted: journal.dateFormatted,
            canEdit: journal.canEdit()
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount,
            hasNext: skip + journals.length < totalCount,
            hasPrev: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      console.error('Get journals error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve journals'
      });
    }
  }

  // Create a new journal entry
  async createJournal(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { title, content, mood, category, tags, privacy, aiPromptId } = req.body;
      const userId = req.user._id;

      // Get AI prompt details if provided
      let aiPromptData = null;
      if (aiPromptId) {
        // This would be retrieved from a prompts cache or generation service
        // For now, we'll create a basic structure
        aiPromptData = {
          promptText: 'AI-generated prompt was used',
          promptType: 'reflection',
          generatedAt: new Date(),
          basedOnMood: mood
        };
      }

      // Create journal entry
      const journal = new Journal({
        userId,
        title: title.trim(),
        content: content.trim(),
        mood,
        category: category || 'personal',
        tags: tags || [],
        privacy: privacy || 'private',
        aiPrompt: aiPromptData
      });

      await journal.save();

      // Update user's journaling statistics
      const user = await User.findById(userId);
      if (user.wellness.journaling) {
        user.wellness.journaling.totalEntries = (user.wellness.journaling.totalEntries || 0) + 1;
        user.wellness.journaling.lastEntryDate = new Date();
      } else {
        user.wellness.journaling = {
          totalEntries: 1,
          lastEntryDate: new Date()
        };
      }
      await user.save();

      // Create notification about journal completion
      setImmediate(async () => {
        try {
          await notificationService.createNotification(userId, {
            type: 'MILESTONE_ACHIEVED',
            title: 'Journal Entry Completed!',
            message: `You've successfully completed a journal entry titled "${title}". Keep up the great work!`,
            data: {
              journalId: journal._id,
              wordCount: journal.wordCount,
              category: journal.category
            },
            priority: 'low',
            icon: 'journal',
            actionType: 'navigate',
            actionData: { route: `/journals/${journal._id}` },
            source: 'journaling'
          });
        } catch (error) {
          console.error('Error creating journal notification:', error);
        }
      });

      // Trigger AI analysis in background if service is available
      if (openaiService.isEnabled && journal.content.length > 50) {
        setImmediate(async () => {
          try {
            await journalController.performAIAnalysis(journal);
          } catch (error) {
            console.error('Background AI analysis failed:', error);
          }
        });
      }

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Journal entry created successfully',
        data: {
          journal: {
            id: journal._id,
            title: journal.title,
            content: journal.content,
            mood: journal.mood,
            moodLabel: journal.moodLabel,
            category: journal.category,
            tags: journal.tags,
            wordCount: journal.wordCount,
            readingTime: journal.readingTime,
            privacy: journal.privacy,
            createdAt: journal.createdAt,
            dateFormatted: journal.dateFormatted,
            canEdit: journal.canEdit()
          }
        }
      });

    } catch (error) {
      console.error('Create journal error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to create journal entry'
      });
    }
  }

  // Get user's journaling statistics
  async getJournalingStats(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { startDate, endDate, period } = req.query;
      const userId = req.user._id;

      // Calculate date range based on period
      let dateRange = {};
      if (period) {
        const now = new Date();
        switch (period) {
          case 'week':
            dateRange.startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            dateRange.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            const quarterStart = Math.floor(now.getMonth() / 3) * 3;
            dateRange.startDate = new Date(now.getFullYear(), quarterStart, 1);
            break;
          case 'year':
            dateRange.startDate = new Date(now.getFullYear(), 0, 1);
            break;
        }
        dateRange.endDate = now;
      } else {
        if (startDate) dateRange.startDate = startDate;
        if (endDate) dateRange.endDate = endDate;
      }

      // Get statistics from database
      const stats = await Journal.getUserStats(userId, dateRange.startDate, dateRange.endDate);
      const statsData = stats[0] || {
        totalEntries: 0,
        totalWords: 0,
        averageMood: 0,
        averageWordCount: 0,
        totalReadingTime: 0,
        categoriesUsed: [],
        promptTypesUsed: [],
        moodCounts: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        uniqueTags: 0
      };

      // Calculate journaling streak
      const streakData = await Journal.calculateJournalingStreak(userId);
      const journalingStreak = journalController.calculateStreakFromDates(streakData[0]?.dates || []);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Journaling statistics retrieved successfully',
        data: {
          period: period || 'custom',
          dateRange: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          },
          statistics: {
            ...statsData,
            streak: journalingStreak,
            consistency: statsData.totalEntries > 0 ? 
              Math.round((journalingStreak.current / Math.max(1, Math.ceil((new Date() - new Date(dateRange.startDate || '2024-01-01')) / (1000 * 60 * 60 * 24)))) * 100) : 0
          }
        }
      });

    } catch (error) {
      console.error('Get journaling stats error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve journaling statistics'
      });
    }
  }

  // Get AI-generated writing prompts
  async getAIPrompts(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      if (!openaiService.isEnabled) {
        return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
          success: false,
          message: 'AI service is not available',
          data: {
            fallbackPrompts: journalController.getFallbackPrompts(req.query.type || 'reflection')
          }
        });
      }

      const { type = 'reflection', mood, count = 3 } = req.query;
      const userId = req.user._id;

      // Get user context for personalized prompts
      const user = await User.findById(userId);
      const recentCheckIns = await CheckIn.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('mood feedback createdAt');

      const recentJournals = await Journal.getRecentForAnalysis(userId, 7, 3);

      // Generate prompts using AI
      const prompts = await journalController.generatePersonalizedPrompts({
        type,
        mood: mood || (recentCheckIns.length > 0 ? recentCheckIns[0].mood : 3),
        count: parseInt(count),
        userContext: {
          recentMoods: recentCheckIns.map(ci => ci.mood),
          riskLevel: user.wellness.riskLevel || 'low',
          recentThemes: recentJournals.map(j => j.category),
          department: user.department
        }
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'AI prompts generated successfully',
        data: {
          prompts,
          type,
          basedOnMood: mood || (recentCheckIns.length > 0 ? recentCheckIns[0].mood : null),
          personalized: true
        }
      });

    } catch (error) {
      console.error('Get AI prompts error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to generate AI prompts',
        data: {
          fallbackPrompts: journalController.getFallbackPrompts(req.query.type || 'reflection')
        }
      });
    }
  }

  // Get AI-powered insights from user's journal entries
  async getJournalInsights(req, res) {
    try {
      const { days = 30 } = req.query;
      const userId = req.user._id;

      if (!openaiService.isEnabled) {
        return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
          success: false,
          message: 'AI service is not available'
        });
      }

      // Get recent journal entries
      const recentJournals = await Journal.getRecentForAnalysis(userId, parseInt(days), 10);

      if (recentJournals.length === 0) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'No journal entries found for analysis',
          data: {
            insights: {
              summary: 'Start journaling to see personalized insights!',
              patterns: [],
              recommendations: [
                'Begin with simple daily reflections',
                'Try writing about three things you\'re grateful for',
                'Reflect on your goals and progress'
              ]
            }
          }
        });
      }

      // Generate insights using AI
      const insights = await journalController.generateJournalInsights(recentJournals);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Journal insights generated successfully',
        data: {
          insights,
          analyzedEntries: recentJournals.length,
          period: `${days} days`
        }
      });

    } catch (error) {
      console.error('Get journal insights error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to generate journal insights'
      });
    }
  }

  // Get journaling streak information
  async getJournalingStreak(req, res) {
    try {
      const userId = req.user._id;

      const streakData = await Journal.calculateJournalingStreak(userId);
      const dates = streakData[0]?.dates || [];
      const streak = journalController.calculateStreakFromDates(dates);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Journaling streak retrieved successfully',
        data: {
          streak,
          totalDaysJournaled: dates.length,
          suggestions: streak.current === 0 ? [
            'Start your journaling journey today!',
            'Even 5 minutes of writing can make a difference',
            'Try using one of our AI-generated prompts'
          ] : streak.current >= 7 ? [
            'Amazing consistency! Keep it up!',
            'Consider exploring different types of journal prompts',
            'Share your insights with our community (anonymously)'
          ] : [
            'You\'re building a great habit!',
            'Try to journal at the same time each day',
            'Quality over quantity - focus on meaningful reflection'
          ]
        }
      });

    } catch (error) {
      console.error('Get journaling streak error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve journaling streak'
      });
    }
  }

  // Search through user's journal entries
  async searchJournals(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { q, page = 1, limit = 20, category, mood } = req.query;
      const userId = req.user._id;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build search query
      const query = {
        userId,
        isDeleted: false,
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { content: { $regex: q, $options: 'i' } },
          { tags: { $in: [new RegExp(q, 'i')] } }
        ]
      };

      if (category) query.category = category;
      if (mood) query.mood = parseInt(mood);

      const journals = await Journal.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('title content mood category tags createdAt wordCount');

      const totalCount = await Journal.countDocuments(query);

      // Highlight search terms in results
      const highlightedResults = journals.map(journal => ({
        id: journal._id,
        title: journalController.highlightSearchTerm(journal.title, q),
        summary: journalController.highlightSearchTerm(journal.getSummary(150), q),
        mood: journal.mood,
        moodLabel: journal.moodLabel,
        category: journal.category,
        tags: journal.tags,
        wordCount: journal.wordCount,
        createdAt: journal.createdAt,
        dateFormatted: journal.dateFormatted
      }));

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Search completed successfully',
        data: {
          query: q,
          results: highlightedResults,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount,
            hasNext: skip + journals.length < totalCount,
            hasPrev: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      console.error('Search journals error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to search journals'
      });
    }
  }

  // Get a specific journal entry
  async getJournal(req, res) {
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

      const journal = await Journal.findOne({
        _id: id,
        userId,
        isDeleted: false
      });

      if (!journal) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Journal entry not found'
        });
      }

      // Update analytics
      journal.analytics.lastViewedAt = new Date();
      await journal.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Journal entry retrieved successfully',
        data: {
          journal: {
            id: journal._id,
            title: journal.title,
            content: journal.content,
            mood: journal.mood,
            moodLabel: journal.moodLabel,
            category: journal.category,
            tags: journal.tags,
            wordCount: journal.wordCount,
            readingTime: journal.readingTime,
            privacy: journal.privacy,
            aiPrompt: journal.aiPrompt,
            aiInsights: journal.aiInsights,
            analytics: journal.analytics,
            createdAt: journal.createdAt,
            updatedAt: journal.updatedAt,
            dateFormatted: journal.dateFormatted,
            canEdit: journal.canEdit()
          }
        }
      });

    } catch (error) {
      console.error('Get journal error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve journal entry'
      });
    }
  }

  // Update a journal entry (within 24 hours)
  async updateJournal(req, res) {
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
      const { title, content, mood, category, tags, privacy } = req.body;
      const userId = req.user._id;

      const journal = await Journal.findOne({
        _id: id,
        userId,
        isDeleted: false
      });

      if (!journal) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Journal entry not found'
        });
      }

      if (!journal.canEdit()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Journal entries can only be edited within 24 hours of creation'
        });
      }

      // Update fields
      if (title !== undefined) journal.title = title.trim();
      if (content !== undefined) journal.content = content.trim();
      if (mood !== undefined) journal.mood = mood;
      if (category !== undefined) journal.category = category;
      if (tags !== undefined) journal.tags = tags;
      if (privacy !== undefined) journal.privacy = privacy;

      await journal.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Journal entry updated successfully',
        data: {
          journal: {
            id: journal._id,
            title: journal.title,
            content: journal.content,
            mood: journal.mood,
            moodLabel: journal.moodLabel,
            category: journal.category,
            tags: journal.tags,
            wordCount: journal.wordCount,
            readingTime: journal.readingTime,
            privacy: journal.privacy,
            updatedAt: journal.updatedAt,
            canEdit: journal.canEdit()
          }
        }
      });

    } catch (error) {
      console.error('Update journal error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to update journal entry'
      });
    }
  }

  // Soft delete a journal entry
  async deleteJournal(req, res) {
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

      const journal = await Journal.findOne({
        _id: id,
        userId,
        isDeleted: false
      });

      if (!journal) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Journal entry not found'
        });
      }

      journal.isDeleted = true;
      await journal.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Journal entry deleted successfully'
      });

    } catch (error) {
      console.error('Delete journal error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to delete journal entry'
      });
    }
  }

  // Request AI analysis of a specific journal entry
  async analyzeJournalEntry(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const journal = await Journal.findOne({
        _id: id,
        userId,
        isDeleted: false
      });

      if (!journal) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Journal entry not found'
        });
      }

      if (!openaiService.isEnabled) {
        return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
          success: false,
          message: 'AI service is not available'
        });
      }

      // Perform AI analysis
      const analysis = await journalController.performAIAnalysis(journal);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Journal entry analyzed successfully',
        data: {
          analysis: journal.aiInsights
        }
      });

    } catch (error) {
      console.error('Analyze journal entry error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to analyze journal entry'
      });
    }
  }

  // Export user's journal data
  async exportJournalData(req, res) {
    try {
      const { format = 'json', startDate, endDate } = req.query;
      const userId = req.user._id;

      const query = {
        userId,
        isDeleted: false
      };

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const journals = await Journal.find(query)
        .sort({ createdAt: -1 })
        .select('title content mood category tags createdAt wordCount');

      let exportData;
      let contentType;
      let filename;

      switch (format) {
        case 'csv':
          exportData = journalController.convertToCSV(journals);
          contentType = 'text/csv';
          filename = `journal-export-${Date.now()}.csv`;
          break;
        case 'txt':
          exportData = journalController.convertToText(journals);
          contentType = 'text/plain';
          filename = `journal-export-${Date.now()}.txt`;
          break;
        default:
          exportData = JSON.stringify(journals, null, 2);
          contentType = 'application/json';
          filename = `journal-export-${Date.now()}.json`;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);

    } catch (error) {
      console.error('Export journal data error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to export journal data'
      });
    }
  }

  // Import journal data for user (data migration)
  async importJournalData(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { entries } = req.body;
      const userId = req.user._id;
      let imported = 0;
      let failed = 0;

      for (const entry of entries) {
        try {
          const journal = new Journal({
            userId,
            title: entry.title || 'Imported Entry',
            content: entry.content,
            mood: entry.mood || 3,
            category: entry.category || 'personal',
            tags: entry.tags || [],
            privacy: entry.privacy || 'private',
            createdAt: entry.date ? new Date(entry.date) : new Date()
          });

          await journal.save();
          imported++;
        } catch (error) {
          console.error('Failed to import entry:', error);
          failed++;
        }
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Journal data import completed',
        data: {
          imported,
          failed,
          total: entries.length
        }
      });

    } catch (error) {
      console.error('Import journal data error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to import journal data'
      });
    }
  }

  // Admin/HR: Get journaling system overview
  async getJournalingOverview(req, res) {
    try {
      const overview = await journalController.generateSystemOverview();
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Journaling overview retrieved successfully',
        data: overview
      });

    } catch (error) {
      console.error('Get journaling overview error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve journaling overview'
      });
    }
  }

  // Admin/HR: Get journaling trends and patterns
  async getJournalingTrends(req, res) {
    try {
      const { period = 'month', department } = req.query;
      
      const trends = await journalController.generateTrendsAnalysis(period, department);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Journaling trends retrieved successfully',
        data: trends
      });

    } catch (error) {
      console.error('Get journaling trends error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve journaling trends'
      });
    }
  }

  // Helper methods
  async performAIAnalysis(journal) {
    try {
      const analysisPrompt = `
        Analyze this journal entry for sentiment, emotions, and themes:
        
        Title: ${journal.title}
        Content: ${journal.content}
        Mood (1-5): ${journal.mood}
        Category: ${journal.category}
        
        Provide analysis in this JSON format:
        {
          "sentimentScore": number between -1 and 1,
          "emotions": [{"emotion": "string", "confidence": number}],
          "keyThemes": ["theme1", "theme2"],
          "recommendations": ["recommendation1", "recommendation2"]
        }
      `;

      const response = await openaiService.client.chat.completions.create({
        model: openaiService.model,
        messages: [{ role: 'user', content: analysisPrompt }],
        max_tokens: 500,
        temperature: 0.3
      });

      // Clean the response content by removing markdown code blocks
      let responseContent = response.choices[0].message.content.trim();
      if (responseContent.startsWith('```json')) {
        responseContent = responseContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (responseContent.startsWith('```')) {
        responseContent = responseContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const analysis = JSON.parse(responseContent);
      
      // Update journal with analysis
      journal.aiInsights = {
        ...analysis,
        analyzed: true,
        analyzedAt: new Date()
      };
      
      await journal.save();
      return analysis;

    } catch (error) {
      console.error('AI analysis error:', error);
      throw error;
    }
  }

  async generatePersonalizedPrompts(params) {
    const { type, mood, count, userContext } = params;
    
    const promptContext = `
      Generate ${count} personalized journal prompts for:
      - Type: ${type}
      - Current mood: ${mood}/5
      - User context: ${JSON.stringify(userContext)}
      
      Return as JSON array of objects with: id, text, category, estimatedTime
    `;

    try {
      const response = await openaiService.client.chat.completions.create({
        model: openaiService.model,
        messages: [{ role: 'user', content: promptContext }],
        max_tokens: 800,
        temperature: 0.7
      });

      // Clean the response content by removing markdown code blocks
      let responseContent = response.choices[0].message.content.trim();
      if (responseContent.startsWith('```json')) {
        responseContent = responseContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (responseContent.startsWith('```')) {
        responseContent = responseContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      return JSON.parse(responseContent);
    } catch (error) {
      console.error('Error generating personalized prompts:', error);
      return journalController.getFallbackPrompts(type);
    }
  }

  getFallbackPrompts(type) {
    const prompts = {
      reflection: [
        { id: 1, text: 'What was the most meaningful part of your day?', category: 'reflection', estimatedTime: '5-10 minutes' },
        { id: 2, text: 'Describe a challenge you faced and how you handled it.', category: 'reflection', estimatedTime: '10-15 minutes' },
        { id: 3, text: 'What did you learn about yourself today?', category: 'reflection', estimatedTime: '5-10 minutes' }
      ],
      gratitude: [
        { id: 1, text: 'List three things you\'re grateful for today and why.', category: 'gratitude', estimatedTime: '5 minutes' },
        { id: 2, text: 'Write about someone who made a positive impact on your day.', category: 'gratitude', estimatedTime: '10 minutes' },
        { id: 3, text: 'What aspects of your health and well-being are you thankful for?', category: 'gratitude', estimatedTime: '5-10 minutes' }
      ],
      'goal-setting': [
        { id: 1, text: 'What progress did you make toward your goals today?', category: 'goal-setting', estimatedTime: '10-15 minutes' },
        { id: 2, text: 'Describe one small step you can take tomorrow to move closer to your dreams.', category: 'goal-setting', estimatedTime: '5-10 minutes' },
        { id: 3, text: 'What obstacles are preventing you from achieving your goals, and how can you overcome them?', category: 'goal-setting', estimatedTime: '15-20 minutes' }
      ]
    };

    return prompts[type] || prompts.reflection;
  }

  calculateStreakFromDates(dates) {
    if (!dates || dates.length === 0) {
      return { current: 0, longest: 0 };
    }

    // Sort dates in descending order
    const sortedDates = dates.sort((a, b) => new Date(b) - new Date(a));
    
    let currentStreak = 0;
    let longestStreak = 0;
    let currentCount = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check for current streak
    for (let i = 0; i < sortedDates.length; i++) {
      const date = new Date(sortedDates[i]);
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      
      if (date.getTime() === expectedDate.getTime()) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Calculate longest streak
    let tempStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i]);
      const previousDate = new Date(sortedDates[i - 1]);
      const dayDiff = (previousDate - currentDate) / (1000 * 60 * 60 * 24);
      
      if (dayDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    
    return { current: currentStreak, longest: longestStreak };
  }

  highlightSearchTerm(text, term) {
    if (!text || !term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  convertToCSV(journals) {
    const headers = ['Date', 'Title', 'Content', 'Mood', 'Category', 'Tags', 'Word Count'];
    const csvRows = [headers.join(',')];
    
    journals.forEach(journal => {
      const row = [
        journal.createdAt.toISOString().split('T')[0],
        `"${journal.title.replace(/"/g, '""')}"`,
        `"${journal.content.replace(/"/g, '""')}"`,
        journal.mood,
        journal.category,
        `"${journal.tags.join(', ')}"`,
        journal.wordCount
      ];
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }

  convertToText(journals) {
    return journals.map(journal => 
      `Date: ${journal.createdAt.toISOString().split('T')[0]}\n` +
      `Title: ${journal.title}\n` +
      `Mood: ${journal.mood}/5\n` +
      `Category: ${journal.category}\n` +
      `Tags: ${journal.tags.join(', ')}\n` +
      `Word Count: ${journal.wordCount}\n\n` +
      `${journal.content}\n\n` +
      '---\n\n'
    ).join('');
  }

  async generateSystemOverview() {
    try {
      // Get overall system statistics
      const totalJournals = await Journal.countDocuments({ isDeleted: false });
      const activeUsers = await Journal.distinct('userId', { 
        isDeleted: false,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentStats = await Journal.aggregate([
        { $match: { isDeleted: false, createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalWords: { $sum: '$wordCount' },
            averageMood: { $avg: '$mood' },
            categories: { $push: '$category' },
            privacySettings: { $push: '$privacy' }
          }
        }
      ]);

      const stats = recentStats[0] || {
        totalEntries: 0,
        totalWords: 0,
        averageMood: 0,
        categories: [],
        privacySettings: []
      };

      return {
        overview: {
          totalJournalEntries: totalJournals,
          activeUsersLastMonth: activeUsers.length,
          last30Days: {
            totalEntries: stats.totalEntries,
            totalWords: stats.totalWords,
            averageMood: Math.round(stats.averageMood * 100) / 100,
            avgWordsPerEntry: stats.totalEntries > 0 ? Math.round(stats.totalWords / stats.totalEntries) : 0
          }
        },
        engagement: {
          categoryDistribution: journalController.calculateDistribution(stats.categories),
          privacyPreferences: journalController.calculateDistribution(stats.privacySettings)
        },
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error generating system overview:', error);
      return {
        overview: { error: 'Failed to generate overview' },
        generatedAt: new Date()
      };
    }
  }

  async generateTrendsAnalysis(period, department) {
    try {
      const dateRange = journalController.calculateDateRange(period);
      const matchQuery = {
        isDeleted: false,
        createdAt: { $gte: dateRange.start, $lte: dateRange.end }
      };

      // If department filter is specified, we'd need to join with User model
      // For now, returning basic trends without department filtering
      
      const trends = await Journal.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              mood: '$mood'
            },
            count: { $sum: 1 },
            totalWords: { $sum: '$wordCount' }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            entries: { $sum: '$count' },
            totalWords: { $sum: '$totalWords' },
            moodDistribution: {
              $push: {
                mood: '$_id.mood',
                count: '$count'
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return {
        period,
        department: department || 'all',
        trends: trends.map(day => ({
          date: day._id,
          entries: day.entries,
          totalWords: day.totalWords,
          avgWordsPerEntry: Math.round(day.totalWords / day.entries),
          moodDistribution: day.moodDistribution
        })),
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error generating trends analysis:', error);
      return {
        error: 'Failed to generate trends analysis',
        generatedAt: new Date()
      };
    }
  }

  calculateDistribution(items) {
    const distribution = {};
    items.forEach(item => {
      distribution[item] = (distribution[item] || 0) + 1;
    });
    return distribution;
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

  async generateJournalInsights(journalEntries) {
    try {
      return await openaiService.generateJournalInsights(journalEntries);
    } catch (error) {
      console.error('Error generating journal insights:', error);
      return {
        overallSummary: 'Unable to generate insights at this time.',
        patterns: {
          moodTrends: 'Insufficient data for analysis',
          recurringThemes: [],
          writingStyle: 'Analysis unavailable',
          consistency: 'Analysis unavailable'
        },
        insights: [],
        recommendations: {
          immediate: ['Continue journaling regularly'],
          ongoing: ['Focus on meaningful reflection'],
          resources: ['Check our journaling guides']
        },
        wellnessAssessment: {
          overallTrend: 'stable',
          keyStrengths: ['Regular writing practice'],
          areasForGrowth: ['Expand on themes'],
          riskIndicators: []
        },
        motivationalMessage: 'Keep up your journaling practice!'
      };
    }
  }
}

const journalController = new JournalController();
module.exports = journalController;