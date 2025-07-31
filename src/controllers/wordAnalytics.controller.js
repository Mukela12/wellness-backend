const wordFrequencyService = require('../services/wordFrequency.service');
const WordFrequency = require('../models/WordFrequency');
const { validationResult } = require('express-validator');
const User = require('../models/User');

// Get company-wide word cloud with AI insights
const getCompanyWordCloud = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      startDate,
      endDate,
      departments,
      sourceTypes,
      timeframe,
      limit = 50,
      minOccurrences = 3
    } = req.query;

    const options = {
      limit: parseInt(limit),
      minOccurrences: parseInt(minOccurrences),
      timeframe: timeframe || 'Last 30 days'
    };

    // Add date filters
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    // Add department filter
    if (departments) {
      options.departments = Array.isArray(departments) ? departments : [departments];
    }

    // Add source type filter
    if (sourceTypes) {
      options.sourceTypes = Array.isArray(sourceTypes) ? sourceTypes : [sourceTypes];
    } else {
      options.sourceTypes = ['journal', 'survey', 'checkin'];
    }

    const result = await wordFrequencyService.getCompanyWordCloudWithInsights(options);

    res.json({
      success: true,
      data: result,
      meta: {
        totalWords: result.words.length,
        hasInsights: !!result.insights,
        filters: options
      }
    });
  } catch (error) {
    console.error('Error getting company word cloud:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve word cloud data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user-specific word cloud
const getUserWordCloud = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      startDate,
      endDate,
      sourceTypes,
      limit = 30
    } = req.query;

    const options = { limit: parseInt(limit) };

    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    
    if (sourceTypes) {
      options.sourceTypes = Array.isArray(sourceTypes) ? sourceTypes : [sourceTypes];
    }

    const wordCloud = await WordFrequency.getUserWordCloud(userId, options);

    res.json({
      success: true,
      data: {
        words: wordCloud,
        userId,
        totalWords: wordCloud.length
      }
    });
  } catch (error) {
    console.error('Error getting user word cloud:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user word cloud',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get department word trends
const getDepartmentWordTrends = async (req, res) => {
  try {
    const { department } = req.params;
    const {
      startDate,
      endDate,
      limit = 20
    } = req.query;

    const options = { limit: parseInt(limit) };
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const trends = await wordFrequencyService.getDepartmentWordTrends(department, options);

    res.json({
      success: true,
      data: {
        department,
        trends,
        totalTrends: trends.length
      }
    });
  } catch (error) {
    console.error('Error getting department word trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department word trends',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get word analytics summary
const getWordAnalyticsSummary = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      department
    } = req.query;

    const matchQuery = {};
    
    if (startDate || endDate) {
      matchQuery['source.date'] = {};
      if (startDate) matchQuery['source.date'].$gte = new Date(startDate);
      if (endDate) matchQuery['source.date'].$lte = new Date(endDate);
    }

    if (department) {
      matchQuery['metadata.department'] = department;
    }

    // Aggregate summary data
    const summary = await WordFrequency.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalWords: { $sum: '$metadata.totalWords' },
          uniqueWords: { $sum: '$metadata.uniqueWords' },
          averageSentiment: { $avg: '$analysis.sentiment.score' },
          sourceBreakdown: {
            $push: '$source.type'
          },
          departmentBreakdown: {
            $push: '$metadata.department'
          },
          sentimentLabels: {
            $push: '$analysis.sentiment.label'
          }
        }
      },
      {
        $project: {
          totalEntries: 1,
          totalWords: 1,
          uniqueWords: 1,
          averageSentiment: { $round: ['$averageSentiment', 3] },
          sourceStats: {
            journal: {
              $size: {
                $filter: {
                  input: '$sourceBreakdown',
                  cond: { $eq: ['$$this', 'journal'] }
                }
              }
            },
            survey: {
              $size: {
                $filter: {
                  input: '$sourceBreakdown',
                  cond: { $eq: ['$$this', 'survey'] }
                }
              }
            },
            checkin: {
              $size: {
                $filter: {
                  input: '$sourceBreakdown',
                  cond: { $eq: ['$$this', 'checkin'] }
                }
              }
            }
          },
          sentimentBreakdown: {
            positive: {
              $size: {
                $filter: {
                  input: '$sentimentLabels',
                  cond: { $in: ['$$this', ['positive', 'very_positive']] }
                }
              }
            },
            negative: {
              $size: {
                $filter: {
                  input: '$sentimentLabels',
                  cond: { $in: ['$$this', ['negative', 'very_negative']] }
                }
              }
            },
            neutral: {
              $size: {
                $filter: {
                  input: '$sentimentLabels',
                  cond: { $eq: ['$$this', 'neutral'] }
                }
              }
            }
          }
        }
      }
    ]);

    // Get active users count for context
    const activeUsersQuery = { isActive: true, role: 'employee' };
    if (department) {
      activeUsersQuery.department = department;
    }
    const activeUsers = await User.countDocuments(activeUsersQuery);

    res.json({
      success: true,
      data: {
        summary: summary[0] || {
          totalEntries: 0,
          totalWords: 0,
          uniqueWords: 0,
          averageSentiment: 0,
          sourceStats: { journal: 0, survey: 0, checkin: 0 },
          sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 }
        },
        activeUsers,
        participationRate: summary[0] ? 
          Math.round((summary[0].totalEntries / activeUsers) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error getting word analytics summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get top themes across company
const getTopThemes = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      department,
      limit = 10
    } = req.query;

    const matchQuery = {};
    
    if (startDate || endDate) {
      matchQuery['source.date'] = {};
      if (startDate) matchQuery['source.date'].$gte = new Date(startDate);
      if (endDate) matchQuery['source.date'].$lte = new Date(endDate);
    }

    if (department) {
      matchQuery['metadata.department'] = department;
    }

    const themes = await WordFrequency.aggregate([
      { $match: matchQuery },
      { $unwind: '$analysis.themes' },
      {
        $group: {
          _id: '$analysis.themes.theme',
          count: { $sum: 1 },
          averageConfidence: { $avg: '$analysis.themes.confidence' },
          departments: { $addToSet: '$metadata.department' },
          users: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          theme: '$_id',
          count: 1,
          averageConfidence: { $round: ['$averageConfidence', 2] },
          departmentCount: { $size: '$departments' },
          userCount: { $size: '$users' },
          departments: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: {
        themes,
        totalThemes: themes.length
      }
    });
  } catch (error) {
    console.error('Error getting top themes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve top themes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Process existing data for word frequency
const processExistingData = async (req, res) => {
  try {
    // Check if user has admin permissions
    if (req.user.role !== 'admin' && req.user.role !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or HR role required.'
      });
    }

    const { dataTypes } = req.body;
    const results = {};

    if (!dataTypes || dataTypes.includes('journals')) {
      results.journalsProcessed = await wordFrequencyService.processExistingJournals();
    }

    if (!dataTypes || dataTypes.includes('surveys')) {
      results.surveysProcessed = await wordFrequencyService.processExistingSurveyResponses();
    }

    if (!dataTypes || dataTypes.includes('checkins')) {
      results.checkinsProcessed = await wordFrequencyService.processExistingCheckIns();
    }

    res.json({
      success: true,
      message: 'Successfully processed existing data for word frequency analysis',
      data: results
    });
  } catch (error) {
    console.error('Error processing existing data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process existing data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getCompanyWordCloud,
  getUserWordCloud,
  getDepartmentWordTrends,
  getWordAnalyticsSummary,
  getTopThemes,
  processExistingData
};