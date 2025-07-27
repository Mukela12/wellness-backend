const User = require('../models/User');
const { validationResult } = require('express-validator');

// Onboarding questionnaire configuration
const ONBOARDING_QUESTIONS = {
  demographics: {
    title: "About You",
    questions: [
      {
        id: "ageRange",
        question: "What is your age range?",
        type: "select",
        required: true,
        options: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
      },
      {
        id: "department",
        question: "Which department do you work in?",
        type: "select",
        required: true,
        options: ["Engineering", "Marketing", "Sales", "HR", "Operations", "Finance", "Customer Support", "Design", "Product", "Other"]
      },
      {
        id: "workType",
        question: "What is your primary work arrangement?",
        type: "select",
        required: true,
        options: ["Remote", "Hybrid", "On-site", "Field work"]
      }
    ]
  },
  wellnessBaseline: {
    title: "Current Wellness",
    questions: [
      {
        id: "currentStressLevel",
        question: "How would you rate your current stress level?",
        type: "scale",
        required: true,
        scale: { min: 1, max: 5 },
        labels: { 1: "Very Low", 3: "Moderate", 5: "Very High" }
      },
      {
        id: "sleepQuality",
        question: "How would you rate your sleep quality?",
        type: "scale",
        required: true,
        scale: { min: 1, max: 5 },
        labels: { 1: "Very Poor", 3: "Fair", 5: "Excellent" }
      },
      {
        id: "exerciseFrequency",
        question: "How often do you exercise?",
        type: "select",
        required: true,
        options: ["Never", "Rarely (1-2 times/month)", "Sometimes (1-2 times/week)", "Regularly (3-4 times/week)", "Very often (5+ times/week)"]
      },
      {
        id: "workLifeBalance",
        question: "How satisfied are you with your work-life balance?",
        type: "scale",
        required: true,
        scale: { min: 1, max: 5 },
        labels: { 1: "Very Dissatisfied", 3: "Neutral", 5: "Very Satisfied" }
      }
    ]
  },
  preferences: {
    title: "Wellness Preferences",
    questions: [
      {
        id: "wellnessGoals",
        question: "What are your primary wellness goals?",
        type: "multiselect",
        required: true,
        max_selections: 3,
        options: [
          "Reduce stress",
          "Improve sleep",
          "Increase physical activity",
          "Better work-life balance",
          "Mental health support",
          "Nutrition improvement",
          "Social connections",
          "Mindfulness/meditation"
        ]
      },
      {
        id: "preferredActivities",
        question: "Which wellness activities interest you most?",
        type: "multiselect",
        required: false,
        max_selections: 5,
        options: [
          "Meditation/mindfulness",
          "Yoga",
          "Walking/hiking",
          "Team sports",
          "Gym workouts",
          "Mental health workshops",
          "Nutrition seminars",
          "Team building activities",
          "Stress management sessions",
          "Time management training"
        ]
      },
      {
        id: "reminderPreference",
        question: "How would you like to receive wellness reminders?",
        type: "select",
        required: true,
        options: ["Email", "SMS", "WhatsApp", "App notifications", "No reminders"]
      },
      {
        id: "bestReminderTime",
        question: "What's the best time for wellness reminders?",
        type: "select",
        required: false,
        options: ["Morning (8-10 AM)", "Mid-morning (10-12 PM)", "Afternoon (12-3 PM)", "Late afternoon (3-6 PM)", "Evening (6-9 PM)"]
      }
    ]
  },
  supportSeeking: {
    title: "Support & Resources",
    questions: [
      {
        id: "comfortSeeking",
        question: "How comfortable are you seeking help for mental health?",
        type: "scale",
        required: true,
        scale: { min: 1, max: 5 },
        labels: { 1: "Very Uncomfortable", 3: "Neutral", 5: "Very Comfortable" }
      },
      {
        id: "previousSupport",
        question: "Have you used mental health or wellness services before?",
        type: "select",
        required: false,
        options: ["Yes, very helpful", "Yes, somewhat helpful", "Yes, not helpful", "No, but interested", "No, not interested"]
      },
      {
        id: "additionalSupport",
        question: "What additional support would be most valuable?",
        type: "multiselect",
        required: false,
        max_selections: 3,
        options: [
          "Anonymous counseling",
          "Peer support groups",
          "Manager training",
          "Flexible work arrangements",
          "Mental health days",
          "Wellness stipend",
          "On-site wellness facilities",
          "Educational resources"
        ]
      }
    ]
  }
};

const onboardingController = {
  async getQuestionnaire(req, res) {
    try {
      const user = await User.findById(req.user.id).select('onboarding');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if already completed
      if (user.onboarding.completed) {
        return res.status(200).json({
          success: true,
          message: 'Onboarding already completed',
          data: {
            completed: true,
            completedAt: user.onboarding.completedAt,
            canRetake: true // Allow users to update their responses
          }
        });
      }

      res.json({
        success: true,
        message: 'Onboarding questionnaire retrieved successfully',
        data: {
          questionnaire: ONBOARDING_QUESTIONS,
          progress: {
            completed: false,
            totalSections: Object.keys(ONBOARDING_QUESTIONS).length,
            estimatedTime: "8-12 minutes"
          }
        }
      });

    } catch (error) {
      console.error('Get questionnaire error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve questionnaire'
      });
    }
  },

  async submitAnswers(req, res) {
    try {
      const { answers, sectionCompleted } = req.body;
      const userId = req.user.id;

      // The transformOnboardingData middleware should have ensured answers exists
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Answers object is required (middleware should have transformed this)',
          received: { bodyKeys: Object.keys(req.body || {}) }
        });
      }

      // Validate answers against questionnaire structure
      const validationErrors = validateAnswers(answers);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid questionnaire responses',
          errors: validationErrors
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Merge answers with existing responses
      const updatedAnswers = {
        ...user.onboarding.answers,
        ...answers
      };

      // Check if questionnaire is now complete
      const isComplete = isQuestionnaireComplete(updatedAnswers);
      const completionPercentage = calculateCompletionPercentage(updatedAnswers);

      // Update user's onboarding data
      user.onboarding.answers = updatedAnswers;
      user.onboarding.completed = isComplete;
      user.onboarding.completionPercentage = completionPercentage;
      
      if (isComplete && !user.onboarding.completedAt) {
        user.onboarding.completedAt = new Date();
        
        // Generate insights from responses
        const insights = generateInitialInsights(updatedAnswers);
        user.onboarding.insights = insights;
      }

      await user.save();

      res.json({
        success: true,
        message: isComplete ? 'Onboarding completed successfully!' : 'Progress saved successfully',
        data: {
          completed: isComplete,
          completionPercentage,
          completedAt: user.onboarding.completedAt,
          insights: user.onboarding.insights,
          nextSection: !isComplete ? getNextSection(updatedAnswers) : null
        }
      });

    } catch (error) {
      console.error('Submit answers error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save questionnaire responses'
      });
    }
  },

  async getStatus(req, res) {
    try {
      const user = await User.findById(req.user.id).select('onboarding');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const status = {
        completed: user.onboarding.completed,
        completionPercentage: user.onboarding.completionPercentage || 0,
        completedAt: user.onboarding.completedAt,
        insights: user.onboarding.insights || null,
        answers: user.onboarding.answers || {}
      };

      if (!status.completed) {
        status.nextSection = getNextSection(status.answers);
        status.totalSections = Object.keys(ONBOARDING_QUESTIONS).length;
      }

      res.json({
        success: true,
        message: 'Onboarding status retrieved successfully',
        data: status
      });

    } catch (error) {
      console.error('Get onboarding status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve onboarding status'
      });
    }
  }
};

// Helper function to validate answers
function validateAnswers(answers) {
  const errors = [];
  
  // Ensure answers is an object
  if (!answers || typeof answers !== 'object') {
    errors.push({
      field: 'answers',
      message: 'Answers must be an object'
    });
    return errors;
  }
  
  for (const [sectionKey, section] of Object.entries(ONBOARDING_QUESTIONS)) {
    for (const question of section.questions) {
      const answer = answers[question.id];
      
      // Check required questions
      if (question.required && (!answer || (Array.isArray(answer) && answer.length === 0))) {
        errors.push({
          field: question.id,
          message: `${question.question} is required`
        });
        continue;
      }

      if (answer) {
        // Validate based on question type
        switch (question.type) {
          case 'select':
            if (!question.options.includes(answer)) {
              errors.push({
                field: question.id,
                message: `Invalid option for ${question.question}`
              });
            }
            break;
            
          case 'multiselect':
            if (!Array.isArray(answer)) {
              errors.push({
                field: question.id,
                message: `${question.question} must be an array`
              });
            } else {
              const invalidOptions = answer.filter(opt => !question.options.includes(opt));
              if (invalidOptions.length > 0) {
                errors.push({
                  field: question.id,
                  message: `Invalid options for ${question.question}: ${invalidOptions.join(', ')}`
                });
              }
              if (question.max_selections && answer.length > question.max_selections) {
                errors.push({
                  field: question.id,
                  message: `Too many selections for ${question.question}. Maximum: ${question.max_selections}`
                });
              }
            }
            break;
            
          case 'scale':
            if (typeof answer !== 'number' || answer < question.scale.min || answer > question.scale.max) {
              errors.push({
                field: question.id,
                message: `${question.question} must be between ${question.scale.min} and ${question.scale.max}`
              });
            }
            break;
            
          case 'text':
            if (typeof answer !== 'string') {
              errors.push({
                field: question.id,
                message: `${question.question} must be text`
              });
            } else if (question.max_length && answer.length > question.max_length) {
              errors.push({
                field: question.id,
                message: `${question.question} exceeds maximum length of ${question.max_length} characters`
              });
            }
            break;
        }
      }
    }
  }
  
  return errors;
}

// Helper function to check if questionnaire is complete
function isQuestionnaireComplete(answers) {
  const requiredQuestions = [];
  
  for (const [sectionKey, section] of Object.entries(ONBOARDING_QUESTIONS)) {
    for (const question of section.questions) {
      if (question.required) {
        requiredQuestions.push(question.id);
      }
    }
  }
  
  return requiredQuestions.every(questionId => {
    const answer = answers[questionId];
    return answer && !(Array.isArray(answer) && answer.length === 0);
  });
}

// Helper function to calculate completion percentage
function calculateCompletionPercentage(answers) {
  const totalQuestions = Object.values(ONBOARDING_QUESTIONS)
    .reduce((total, section) => total + section.questions.length, 0);
  
  const answeredQuestions = Object.keys(answers).filter(key => {
    const answer = answers[key];
    return answer && !(Array.isArray(answer) && answer.length === 0);
  }).length;
  
  return Math.round((answeredQuestions / totalQuestions) * 100);
}

// Helper function to get next incomplete section
function getNextSection(answers) {
  for (const [sectionKey, section] of Object.entries(ONBOARDING_QUESTIONS)) {
    const sectionQuestions = section.questions.map(q => q.id);
    const answeredInSection = sectionQuestions.filter(qId => answers[qId]).length;
    
    if (answeredInSection < sectionQuestions.length) {
      return {
        key: sectionKey,
        title: section.title,
        progress: Math.round((answeredInSection / sectionQuestions.length) * 100)
      };
    }
  }
  
  return null;
}

// Helper function to generate initial insights
function generateInitialInsights(answers) {
  const insights = {
    riskFactors: [],
    strengths: [],
    recommendations: [],
    focusAreas: []
  };

  // Analyze stress level
  if (answers.currentStressLevel >= 4) {
    insights.riskFactors.push('High stress levels reported');
    insights.recommendations.push('Consider stress management techniques');
    insights.focusAreas.push('stress-management');
  }

  // Analyze sleep quality
  if (answers.sleepQuality <= 2) {
    insights.riskFactors.push('Poor sleep quality');
    insights.recommendations.push('Focus on sleep hygiene improvements');
    insights.focusAreas.push('sleep-improvement');
  }

  // Analyze exercise frequency
  if (answers.exerciseFrequency === 'Never' || answers.exerciseFrequency === 'Rarely (1-2 times/month)') {
    insights.recommendations.push('Incorporate regular physical activity');
    insights.focusAreas.push('physical-activity');
  } else {
    insights.strengths.push('Regular exercise routine');
  }

  // Analyze work-life balance
  if (answers.workLifeBalance <= 2) {
    insights.riskFactors.push('Poor work-life balance');
    insights.recommendations.push('Explore work-life balance strategies');
    insights.focusAreas.push('work-life-balance');
  }

  // Analyze comfort seeking help
  if (answers.comfortSeeking <= 2) {
    insights.recommendations.push('Consider building comfort with seeking support');
  } else {
    insights.strengths.push('Comfortable seeking help when needed');
  }

  return insights;
}

module.exports = onboardingController;
module.exports.ONBOARDING_QUESTIONS = ONBOARDING_QUESTIONS;