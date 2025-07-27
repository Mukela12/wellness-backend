const Survey = require('../models/Survey');
const User = require('../models/User');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');
const mongoose = require('mongoose');

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
          id: 'weekly-wellness',
          title: 'Weekly Wellness Check',
          description: 'Standard weekly pulse survey for employee wellness',
          questions: [
            {
              id: 'overall_satisfaction',
              question: 'How satisfied are you with your work this week?',
              type: 'scale',
              scale: { min: 1, max: 5, labels: new Map([['1', 'Very Dissatisfied'], ['5', 'Very Satisfied']]) },
              required: true
            },
            {
              id: 'stress_level',
              question: 'How would you rate your stress level this week?',
              type: 'scale',
              scale: { min: 1, max: 5, labels: new Map([['1', 'Very Low'], ['5', 'Very High']]) },
              required: true
            },
            {
              id: 'work_life_balance',
              question: 'How well did you maintain work-life balance this week?',
              type: 'scale',
              scale: { min: 1, max: 5, labels: new Map([['1', 'Very Poor'], ['5', 'Excellent']]) },
              required: true
            },
            {
              id: 'team_support',
              question: 'Do you feel supported by your team?',
              type: 'boolean',
              required: true
            },
            {
              id: 'feedback',
              question: 'Any additional feedback or suggestions?',
              type: 'text',
              required: false
            }
          ]
        },
        {
          id: 'monthly-engagement',
          title: 'Monthly Engagement Survey',
          description: 'Comprehensive monthly engagement assessment',
          questions: [
            {
              id: 'job_satisfaction',
              question: 'How satisfied are you with your current role?',
              type: 'scale',
              scale: { min: 1, max: 10, labels: new Map([['1', 'Not at all'], ['10', 'Extremely']]) },
              required: true
            },
            {
              id: 'growth_opportunities',
              question: 'Rate the growth opportunities available to you',
              type: 'scale',
              scale: { min: 1, max: 5, labels: new Map([['1', 'Very Poor'], ['5', 'Excellent']]) },
              required: true
            },
            {
              id: 'challenges_faced',
              question: 'What challenges did you face this month?',
              type: 'checkbox',
              options: ['Heavy workload', 'Unclear expectations', 'Lack of resources', 'Communication issues', 'Technical problems', 'Other'],
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