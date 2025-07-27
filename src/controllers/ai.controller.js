const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const openaiService = require('../services/openai.service');
const { validationResult } = require('express-validator');

class AIController {
  // Test AI service connection
  async testConnection(req, res) {
    try {
      const result = await openaiService.testConnection();
      
      if (result.success) {
        res.json({
          success: true,
          message: 'AI service connection successful',
          data: {
            response: result.message,
            model: result.model,
            usage: result.usage,
            isEnabled: openaiService.isEnabled
          }
        });
      } else {
        res.status(503).json({
          success: false,
          message: 'AI service connection failed',
          error: result.error,
          code: result.code
        });
      }
    } catch (error) {
      console.error('AI connection test error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test AI service connection'
      });
    }
  }

  // Get personalized insights for user
  async getPersonalizedInsights(req, res) {
    try {
      const userId = req.user.id;
      
      // Get user data
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get recent check-ins (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentCheckIns = await CheckIn.find({
        userId,
        date: { $gte: sevenDaysAgo }
      }).sort({ date: -1 }).limit(7);

      // Calculate mood trend
      let moodTrend = 'stable';
      if (recentCheckIns.length >= 2) {
        const recentMoods = recentCheckIns.slice(0, 3).map(ci => ci.mood);
        const olderMoods = recentCheckIns.slice(-3).map(ci => ci.mood);
        const recentAvg = recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length;
        const olderAvg = olderMoods.reduce((a, b) => a + b, 0) / olderMoods.length;
        
        if (recentAvg > olderAvg + 0.5) moodTrend = 'improving';
        else if (recentAvg < olderAvg - 0.5) moodTrend = 'declining';
      }

      // Prepare data for AI analysis
      const userData = {
        user: {
          name: user.name,
          department: user.department,
          wellness: user.wellness
        },
        recentCheckIns: recentCheckIns.map(ci => ({
          date: ci.date.toISOString().split('T')[0],
          mood: ci.mood,
          feedback: ci.feedback
        })),
        moodTrend,
        onboardingAnswers: user.onboarding.answers
      };

      // Generate AI insights
      const insights = await openaiService.generatePersonalizedInsights(userData);
      
      if (!insights) {
        return res.status(503).json({
          success: false,
          message: 'AI service temporarily unavailable'
        });
      }

      res.json({
        success: true,
        message: 'Personalized insights generated successfully',
        data: {
          insights,
          metadata: {
            dataPoints: recentCheckIns.length,
            moodTrend,
            generatedAt: insights.generatedAt,
            usage: insights.usage
          }
        }
      });

    } catch (error) {
      console.error('Personalized insights error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate personalized insights'
      });
    }
  }

  // Analyze a specific check-in with AI
  async analyzeCheckIn(req, res) {
    try {
      const { checkInId } = req.params;
      const userId = req.user.id;

      // Get the check-in
      const checkIn = await CheckIn.findOne({ 
        _id: checkInId, 
        userId 
      });

      if (!checkIn) {
        return res.status(404).json({
          success: false,
          message: 'Check-in not found'
        });
      }

      // Get user data
      const user = await User.findById(userId);

      // Prepare data for AI analysis
      const checkInData = {
        mood: checkIn.mood,
        feedback: checkIn.feedback,
        user: {
          department: user.department,
          wellness: user.wellness
        }
      };

      // Analyze with AI
      const analysis = await openaiService.analyzeCheckIn(checkInData);
      
      if (!analysis) {
        return res.status(503).json({
          success: false,
          message: 'AI analysis service temporarily unavailable'
        });
      }

      // Update check-in with AI analysis
      await CheckIn.findByIdAndUpdate(checkInId, {
        'analysis.sentimentScore': analysis.sentimentScore,
        'analysis.emotions': analysis.emotions,
        'analysis.riskIndicators': analysis.riskIndicators,
        'analysis.personalizedMessage': analysis.personalizedMessage,
        'analysis.recommendations': analysis.recommendations,
        processed: true
      });

      res.json({
        success: true,
        message: 'Check-in analyzed successfully',
        data: {
          checkIn: {
            id: checkIn._id,
            date: checkIn.date,
            mood: checkIn.mood,
            feedback: checkIn.feedback
          },
          analysis: {
            sentimentScore: analysis.sentimentScore,
            emotions: analysis.emotions,
            riskIndicators: analysis.riskIndicators,
            personalizedMessage: analysis.personalizedMessage,
            recommendations: analysis.recommendations,
            processedAt: analysis.processedAt
          },
          metadata: {
            usage: analysis.usage
          }
        }
      });

    } catch (error) {
      console.error('Check-in analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze check-in'
      });
    }
  }

  // Generate weekly wellness summary
  async getWeeklySummary(req, res) {
    try {
      const userId = req.user.id;
      const { weeks = 1 } = req.query;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (weeks * 7));

      // Get user data
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get weekly check-ins
      const checkIns = await CheckIn.find({
        userId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: -1 });

      // Calculate weekly statistics
      const totalCheckIns = checkIns.length;
      const averageMood = totalCheckIns > 0 
        ? Math.round((checkIns.reduce((sum, ci) => sum + ci.mood, 0) / totalCheckIns) * 10) / 10
        : 0;
      const engagementRate = Math.round((totalCheckIns / (weeks * 7)) * 100);
      const happyCoinsEarned = checkIns.reduce((sum, ci) => sum + (ci.happyCoinsEarned || 0), 0);

      // Determine mood trend
      let moodTrend = 'stable';
      if (checkIns.length >= 4) {
        const firstHalf = checkIns.slice(-Math.floor(checkIns.length / 2));
        const secondHalf = checkIns.slice(0, Math.floor(checkIns.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, ci) => sum + ci.mood, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, ci) => sum + ci.mood, 0) / secondHalf.length;
        
        if (secondAvg > firstAvg + 0.3) moodTrend = 'improving';
        else if (secondAvg < firstAvg - 0.3) moodTrend = 'declining';
      }

      // Prepare data for AI analysis
      const weeklyData = {
        user: {
          name: user.name,
          department: user.department,
          wellness: user.wellness
        },
        weeklyStats: {
          totalCheckIns,
          averageMood,
          engagementRate,
          happyCoinsEarned
        },
        checkIns: checkIns.map(ci => ({
          date: ci.date.toISOString().split('T')[0],
          mood: ci.mood,
          feedback: ci.feedback
        })),
        moodTrend
      };

      // Generate AI summary
      const summary = await openaiService.generateWeeklySummary(weeklyData);
      
      if (!summary) {
        return res.status(503).json({
          success: false,
          message: 'AI summary service temporarily unavailable'
        });
      }

      res.json({
        success: true,
        message: 'Weekly summary generated successfully',
        data: {
          period: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            weeks: parseInt(weeks)
          },
          statistics: {
            totalCheckIns,
            averageMood,
            engagementRate: `${engagementRate}%`,
            happyCoinsEarned,
            moodTrend
          },
          aiSummary: {
            weekOverview: summary.weekOverview,
            highlights: summary.highlights,
            moodPatterns: summary.moodPatterns,
            progressAssessment: summary.progressAssessment,
            nextWeekRecommendations: summary.nextWeekRecommendations,
            motivationalNote: summary.motivationalNote,
            generatedAt: summary.generatedAt
          },
          metadata: {
            usage: summary.usage
          }
        }
      });

    } catch (error) {
      console.error('Weekly summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate weekly summary'
      });
    }
  }

  // Generate AI-powered risk assessment (HR/Admin only)
  async generateRiskAssessment(req, res) {
    try {
      // Check permissions
      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. HR or Admin role required.'
        });
      }

      const { userId } = req.params;

      // Get user data
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentCheckIns = await CheckIn.find({
        userId,
        date: { $gte: thirtyDaysAgo }
      }).sort({ date: -1 });

      // Identify risk factors
      const riskFactors = [];
      const averageMood = recentCheckIns.length > 0
        ? recentCheckIns.reduce((sum, ci) => sum + ci.mood, 0) / recentCheckIns.length
        : 0;

      if (averageMood < 2.5) riskFactors.push('Low average mood rating');
      if (recentCheckIns.length < 10) riskFactors.push('Infrequent check-ins');
      if (user.wellness.currentStreak === 0) riskFactors.push('No current engagement streak');
      
      const lowMoodCheckIns = recentCheckIns.filter(ci => ci.mood <= 2).length;
      if (lowMoodCheckIns >= 3) riskFactors.push('Multiple low mood check-ins');

      // Calculate recent activity metrics
      const recentActivity = {
        lastCheckIn: recentCheckIns[0]?.date || null,
        averageMood: Math.round(averageMood * 10) / 10,
        frequency: `${recentCheckIns.length} check-ins in 30 days`,
        engagementRate: Math.round((recentCheckIns.length / 30) * 100)
      };

      // Historical patterns analysis
      const historicalData = `
        - Current wellness streak: ${user.wellness.currentStreak} days
        - Overall average mood: ${user.wellness.averageMood || 'N/A'}/5
        - Happy coins earned: ${user.wellness.happyCoins}
        - Risk level: ${user.wellness.riskLevel}
      `;

      // Prepare data for AI analysis
      const riskData = {
        user: {
          name: user.name,
          department: user.department,
          wellness: user.wellness
        },
        riskFactors,
        recentActivity,
        historicalData
      };

      // Generate AI risk assessment
      const assessment = await openaiService.generateRiskAssessment(riskData);
      
      if (!assessment) {
        return res.status(503).json({
          success: false,
          message: 'AI risk assessment service temporarily unavailable'
        });
      }

      // Update user's risk level based on AI assessment
      await User.findByIdAndUpdate(userId, {
        'wellness.riskLevel': assessment.riskLevel,
        'wellness.riskScore': assessment.riskScore,
        'wellness.lastRiskAssessment': new Date()
      });

      res.json({
        success: true,
        message: 'AI risk assessment completed successfully',
        data: {
          employee: {
            id: user._id,
            name: user.name,
            department: user.department
          },
          assessment: {
            riskLevel: assessment.riskLevel,
            riskScore: assessment.riskScore,
            justification: assessment.justification,
            keyConcerns: assessment.keyConcerns,
            interventionRecommendations: assessment.interventionRecommendations,
            supportResources: assessment.supportResources,
            monitoringFrequency: assessment.monitoringFrequency,
            assessedAt: assessment.assessedAt
          },
          dataAnalyzed: {
            recentCheckIns: recentCheckIns.length,
            averageMood: recentActivity.averageMood,
            riskFactors: riskFactors,
            timeframe: '30 days'
          },
          metadata: {
            usage: assessment.usage
          }
        }
      });

    } catch (error) {
      console.error('AI risk assessment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate AI risk assessment'
      });
    }
  }

  // Get AI service status and usage statistics
  async getServiceStatus(req, res) {
    try {
      // Only HR/Admin can view detailed service status
      const isAuthorized = req.user.role === 'hr' || req.user.role === 'admin';
      
      const status = {
        isEnabled: openaiService.isEnabled,
        model: openaiService.model,
        maxTokens: openaiService.maxTokens,
        features: {
          checkInAnalysis: true,
          personalizedInsights: true,
          weeklySummaries: true,
          riskAssessments: isAuthorized
        }
      };

      if (isAuthorized) {
        // Get usage statistics from recent check-ins with AI analysis
        const recentAnalysisCount = await CheckIn.countDocuments({
          processed: true,
          'analysis.processedAt': { 
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        });

        status.usageStats = {
          recentAnalyses: recentAnalysisCount,
          timeframe: '24 hours'
        };
      }

      res.json({
        success: true,
        message: 'AI service status retrieved',
        data: status
      });

    } catch (error) {
      console.error('AI service status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve AI service status'
      });
    }
  }
}

module.exports = new AIController();