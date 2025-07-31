const Survey = require('../models/Survey');
const User = require('../models/User');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');
const mongoose = require('mongoose');
const achievementService = require('../services/achievement.service');

const surveyController = {
  async createSurvey(req, res) {
    try {
      const { title, description, type, questions, schedule, targetAudience, rewards } = req.body;

      const survey = new Survey({
        title,
        description,
        type,
        questions,
        schedule,
        targetAudience,
        rewards,
        createdBy: req.user.id
      });

      await survey.save();

      sendSuccessResponse(res, {
        message: 'Survey created successfully',
        data: { survey }
      }, 201);
    } catch (error) {
      console.error('Error creating survey:', error);
      sendErrorResponse(res, 'Failed to create survey', 500);
    }
  },

  async getAllSurveys(req, res) {
    try {
      const { page = 1, limit = 10, type, status } = req.query;
      const skip = (page - 1) * limit;

      const query = {};
      if (type) query.type = type;
      if (status) query.status = status;

      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        query.createdBy = req.user.id;
      }

      const surveys = await Survey.find(query)
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Survey.countDocuments(query);

      sendSuccessResponse(res, {
        message: 'Surveys retrieved successfully',
        data: {
          surveys,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total,
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Error fetching surveys:', error);
      sendErrorResponse(res, 'Failed to fetch surveys', 500);
    }
  },

  async getSurvey(req, res) {
    try {
      const { id } = req.params;

      const survey = await Survey.findById(id)
        .populate('createdBy', 'name');

      if (!survey) {
        return sendErrorResponse(res, 'Survey not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' && 
          survey.createdBy._id.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      sendSuccessResponse(res, {
        message: 'Survey retrieved successfully',
        data: { survey }
      });
    } catch (error) {
      console.error('Error fetching survey:', error);
      sendErrorResponse(res, 'Failed to fetch survey', 500);
    }
  },

  async updateSurvey(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const survey = await Survey.findById(id);

      if (!survey) {
        return sendErrorResponse(res, 'Survey not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' && 
          survey.createdBy.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      if (survey.status === 'active' && survey.responses.length > 0) {
        return sendErrorResponse(res, 'Cannot update survey with existing responses', 400);
      }

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          survey[key] = updates[key];
        }
      });

      await survey.save();

      sendSuccessResponse(res, {
        message: 'Survey updated successfully',
        data: { survey }
      });
    } catch (error) {
      console.error('Error updating survey:', error);
      sendErrorResponse(res, 'Failed to update survey', 500);
    }
  },

  async deleteSurvey(req, res) {
    try {
      const { id } = req.params;

      const survey = await Survey.findById(id);

      if (!survey) {
        return sendErrorResponse(res, 'Survey not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' && 
          survey.createdBy.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      if (survey.status === 'active') {
        return sendErrorResponse(res, 'Cannot delete active survey', 400);
      }

      await Survey.findByIdAndDelete(id);

      sendSuccessResponse(res, {
        message: 'Survey deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting survey:', error);
      sendErrorResponse(res, 'Failed to delete survey', 500);
    }
  },

  async getActiveSurveysForUser(req, res) {
    try {
      const userId = req.user.id;

      const surveys = await Survey.getActiveSurveysForUser(userId);

      sendSuccessResponse(res, {
        message: 'Active surveys retrieved successfully',
        data: {
          surveys,
          count: surveys.length
        }
      });
    } catch (error) {
      console.error('Error fetching active surveys:', error);
      sendErrorResponse(res, 'Failed to fetch active surveys', 500);
    }
  },

  async submitSurveyResponse(req, res) {
    try {
      const { id } = req.params;
      const { answers } = req.body;
      const userId = req.user.id;

      const survey = await Survey.findById(id);

      if (!survey) {
        return sendErrorResponse(res, 'Survey not found', 404);
      }

      if (!survey.isCurrentlyActive) {
        return sendErrorResponse(res, 'Survey is not currently active', 400);
      }

      if (survey.hasUserResponded(userId)) {
        return sendErrorResponse(res, 'You have already responded to this survey', 400);
      }

      const requiredQuestions = survey.questions.filter(q => q.required);
      const providedAnswers = Object.keys(answers);

      for (const question of requiredQuestions) {
        if (!providedAnswers.includes(question.id)) {
          return sendErrorResponse(res, `Answer required for question: ${question.question}`, 400);
        }
      }

      survey.responses.push({
        userId,
        answers: new Map(Object.entries(answers)),
        completedAt: new Date()
      });

      await survey.calculateAnalytics();
      await survey.save();

      const user = await User.findById(userId);
      if (user && survey.rewards.happyCoins > 0) {
        user.wellness.happyCoins += survey.rewards.happyCoins;
        await user.save();
      }

      // Check achievements for survey completion in background
      setImmediate(async () => {
        try {
          await achievementService.checkAndAwardAchievements(
            userId,
            'survey_completion',
            { survey, user }
          );
        } catch (error) {
          console.error('Error checking achievements after survey completion:', error);
        }
      });

      sendSuccessResponse(res, {
        message: 'Survey response submitted successfully',
        data: {
          surveyId: survey._id,
          happyCoinsEarned: survey.rewards.happyCoins,
          totalHappyCoins: user.wellness.happyCoins
        }
      });
    } catch (error) {
      console.error('Error submitting survey response:', error);
      sendErrorResponse(res, 'Failed to submit survey response', 500);
    }
  },

  async getSurveyAnalytics(req, res) {
    try {
      const { id } = req.params;

      const survey = await Survey.findById(id)
        .populate('responses.userId', 'name department')
        .populate('createdBy', 'name');

      if (!survey) {
        return sendErrorResponse(res, 'Survey not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' && 
          survey.createdBy._id.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      const analytics = {
        survey: {
          id: survey._id,
          title: survey.title,
          type: survey.type,
          status: survey.status
        },
        statistics: survey.analytics,
        responses: {
          total: survey.responses.length,
          byDepartment: {},
          answers: {}
        }
      };

      survey.responses.forEach(response => {
        const dept = response.userId.department || 'Unknown';
        analytics.responses.byDepartment[dept] = (analytics.responses.byDepartment[dept] || 0) + 1;
      });

      survey.questions.forEach(question => {
        analytics.responses.answers[question.id] = {
          question: question.question,
          type: question.type,
          responses: []
        };

        survey.responses.forEach(response => {
          const answer = response.answers.get(question.id);
          if (answer !== undefined) {
            analytics.responses.answers[question.id].responses.push(answer);
          }
        });

        if (question.type === 'scale') {
          const answers = analytics.responses.answers[question.id].responses;
          if (answers.length > 0) {
            const average = answers.reduce((sum, val) => sum + val, 0) / answers.length;
            analytics.responses.answers[question.id].average = parseFloat(average.toFixed(2));
          }
        }
      });

      sendSuccessResponse(res, {
        message: 'Survey analytics retrieved successfully',
        data: analytics
      });
    } catch (error) {
      console.error('Error fetching survey analytics:', error);
      sendErrorResponse(res, 'Failed to fetch survey analytics', 500);
    }
  },

  async updateSurveyStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['draft', 'active', 'closed', 'archived'].includes(status)) {
        return sendErrorResponse(res, 'Invalid status', 400);
      }

      const survey = await Survey.findById(id);

      if (!survey) {
        return sendErrorResponse(res, 'Survey not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' && 
          survey.createdBy.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      const oldStatus = survey.status;
      survey.status = status;
      await survey.save();

      sendSuccessResponse(res, {
        message: `Survey status updated from ${oldStatus} to ${status}`,
        data: {
          surveyId: survey._id,
          oldStatus,
          newStatus: status
        }
      });
    } catch (error) {
      console.error('Error updating survey status:', error);
      sendErrorResponse(res, 'Failed to update survey status', 500);
    }
  },

  async getPulseSurveyTemplates(req, res) {
    try {
      const templates = [
        {
          id: 'weekly-engagement-pulse',
          title: 'Weekly Engagement Pulse',
          description: 'Quick weekly survey to measure employee engagement and satisfaction',
          type: 'pulse',
          priority: 'high',
          estimatedTime: 3,
          category: 'engagement',
          questions: [
            {
              id: 'enps_score',
              question: `On a scale of 0-10, how likely are you to recommend ${process.env.COMPANY_NAME || 'this company'} as a great place to work?`,
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
              id: 'engagement_level',
              question: 'How engaged do you feel at work today?',
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
              id: 'workload_satisfaction',
              question: 'How manageable is your current workload?',
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
              id: 'support_feeling',
              question: 'Do you feel supported by your immediate manager?',
              type: 'boolean',
              category: 'leadership',
              required: true
            },
            {
              id: 'improvement_suggestion',
              question: 'What one thing would improve your work experience this week?',
              type: 'text',
              category: 'feedback',
              required: false
            }
          ]
        },
        {
          id: 'comprehensive-engagement',
          title: 'Comprehensive Engagement Survey',
          description: 'Deep dive into employee engagement across all key dimensions',
          type: 'pulse',
          priority: 'normal',
          estimatedTime: 8,
          category: 'engagement',
          questions: [
            // Purpose & Values
            {
              id: 'purpose_alignment',
              question: 'I feel involved in and enthusiastic about my work',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Strongly disagree'], 
                  ['2', 'Disagree'],
                  ['3', 'Neutral'],
                  ['4', 'Agree'],
                  ['5', 'Strongly agree']
                ]) 
              },
              category: 'purpose',
              required: true
            },
            {
              id: 'values_alignment',
              question: 'My personal values align with the organization\'s values',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Strongly disagree'], 
                  ['5', 'Strongly agree']
                ]) 
              },
              category: 'purpose',
              required: true
            },
            // Leadership
            {
              id: 'manager_support',
              question: 'My direct manager provides me with the support I need',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Strongly disagree'], 
                  ['5', 'Strongly agree']
                ]) 
              },
              category: 'leadership',
              required: true
            },
            {
              id: 'recognition_frequency',
              question: 'I feel recognized and valued for my contributions',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Never'], 
                  ['2', 'Rarely'],
                  ['3', 'Sometimes'],
                  ['4', 'Often'],
                  ['5', 'Always']
                ]) 
              },
              category: 'appreciation',
              required: true
            },
            // Innovation & Creativity
            {
              id: 'innovation_encouragement',
              question: 'I feel empowered to take calculated risks and generate new ideas',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Strongly disagree'], 
                  ['5', 'Strongly agree']
                ]) 
              },
              category: 'innovation',
              required: true
            },
            // Teamwork
            {
              id: 'team_collaboration',
              question: 'I feel comfortable collaborating and communicating with my colleagues',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Strongly disagree'], 
                  ['5', 'Strongly agree']
                ]) 
              },
              category: 'teamwork',
              required: true
            },
            // Growth & Career Progression
            {
              id: 'growth_opportunities',
              question: 'I have opportunities to grow personally and professionally',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Strongly disagree'], 
                  ['5', 'Strongly agree']
                ]) 
              },
              category: 'growth',
              required: true
            },
            // Diversity, Equity & Inclusion
            {
              id: 'inclusion_feeling',
              question: 'I feel welcomed and treated equally regardless of my background',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Strongly disagree'], 
                  ['5', 'Strongly agree']
                ]) 
              },
              category: 'diversity',
              required: true
            },
            // Wellbeing
            {
              id: 'wellbeing_support',
              question: 'I feel supported in my physical, mental, and emotional well-being',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Strongly disagree'], 
                  ['5', 'Strongly agree']
                ]) 
              },
              category: 'wellbeing',
              required: true
            },
            // Psychological Safety
            {
              id: 'psychological_safety',
              question: 'I feel safe to admit mistakes, express opinions, and seek help without fear of judgment',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Strongly disagree'], 
                  ['5', 'Strongly agree']
                ]) 
              },
              category: 'psychological_safety',
              required: true
            },
            // eNPS
            {
              id: 'enps_detailed',
              question: `On a scale of 0-10, how likely are you to recommend ${process.env.COMPANY_NAME || 'this company'} as a great place to work?`,
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
              id: 'enps_reason',
              question: 'What is the main reason for your score above?',
              type: 'text',
              category: 'eNPS',
              required: false
            }
          ]
        },
        {
          id: 'wellness-focus',
          title: 'Wellness & Work-Life Balance Survey',
          description: 'Focus on employee wellness, stress levels, and work-life balance',
          type: 'pulse',
          priority: 'normal',
          estimatedTime: 5,
          category: 'wellbeing',
          questions: [
            {
              id: 'stress_level_detailed',
              question: 'How would you rate your current stress level at work?',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 10, 
                labels: new Map([
                  ['1', 'No stress'], 
                  ['5', 'Moderate stress'],
                  ['10', 'Extreme stress']
                ]) 
              },
              category: 'wellbeing',
              required: true
            },
            {
              id: 'work_life_balance',
              question: 'How satisfied are you with your current work-life balance?',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Very dissatisfied'], 
                  ['2', 'Dissatisfied'],
                  ['3', 'Neutral'],
                  ['4', 'Satisfied'],
                  ['5', 'Very satisfied']
                ]) 
              },
              category: 'wellbeing',
              required: true
            },
            {
              id: 'mental_health_support',
              question: 'Do you feel you have access to adequate mental health resources?',
              type: 'boolean',
              category: 'wellbeing',
              required: true
            },
            {
              id: 'workload_manageability',
              question: 'How often do you feel overwhelmed by your workload?',
              type: 'scale',
              scale: { 
                min: 1, 
                max: 5, 
                labels: new Map([
                  ['1', 'Never'], 
                  ['2', 'Rarely'],
                  ['3', 'Sometimes'],
                  ['4', 'Often'],
                  ['5', 'Always']
                ]) 
              },
              category: 'wellbeing',
              required: true
            },
            {
              id: 'wellness_priorities',
              question: 'Which wellness areas are most important to you? (Select up to 3)',
              type: 'multiple_choice',
              options: [
                'Physical fitness and exercise',
                'Mental health and stress management', 
                'Nutrition and healthy eating',
                'Sleep quality and rest',
                'Work-life balance',
                'Social connections',
                'Financial wellness',
                'Career development'
              ],
              category: 'wellbeing',
              required: false
            }
          ]
        }
      ];

      sendSuccessResponse(res, {
        message: 'Survey templates retrieved successfully',
        data: { templates }
      });
    } catch (error) {
      console.error('Error fetching survey templates:', error);
      sendErrorResponse(res, 'Failed to fetch survey templates', 500);
    }
  }
};

module.exports = surveyController;