const User = require('../../models/User');
const Survey = require('../../models/Survey');
const CheckIn = require('../../models/CheckIn');
const notificationService = require('../notifications/notification.service');
const achievementService = require('../achievement.service');

class SlackSurveyService {
  constructor() {
    // Store temporary survey responses (in production, use Redis)
    this.pendingResponses = new Map();
  }

  /**
   * Send a survey to a user via Slack
   */
  async sendSurveyToUser(userId, surveyId) {
    try {
      const user = await User.findById(userId);
      const survey = await Survey.findById(surveyId).populate('questions');

      if (!user?.integrations?.slack?.isConnected) {
        console.log(`User ${userId} is not connected to Slack`);
        return false;
      }

      if (!survey || !survey.isActive) {
        console.log(`Survey ${surveyId} not found or not active`);
        return false;
      }

      const slackService = require('./slack.service');
      const blocks = this.formatSurveyForSlack(survey, user);
      
      await slackService.sendDirectMessage(
        user.integrations.slack.userId,
        `📋 ${survey.title}`,
        blocks
      );

      // Track notification sent
      await notificationService.create({
        userId: user._id,
        title: 'New Survey Available',
        message: survey.title,
        type: 'survey',
        channel: 'slack',
        metadata: {
          surveyId: survey._id,
          surveyTitle: survey.title
        }
      });

      console.log(`Survey ${survey.title} sent to user ${user.name} via Slack`);
      return true;
    } catch (error) {
      console.error('Error sending survey via Slack:', error);
      return false;
    }
  }

  /**
   * Format survey as Slack blocks
   */
  formatSurveyForSlack(survey, user) {
    const responseId = `${user._id}_${survey._id}_${Date.now()}`;
    
    // Store survey info for response handling
    this.pendingResponses.set(responseId, {
      userId: user._id,
      surveyId: survey._id,
      responses: new Map(),
      startedAt: new Date()
    });

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: survey.title,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: survey.description
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🎯 *Priority:* ${survey.priority} | 💰 *Reward:* ${survey.rewards?.happyCoins || 0} Happy Coins | ⏱️ *Est. time:* ${survey.estimatedTime || '5 min'}`
          }
        ]
      },
      {
        type: 'divider'
      }
    ];

    // Add questions
    survey.questions.forEach((question, index) => {
      blocks.push(this.formatQuestionBlock(question, index, responseId));
      
      if (index < survey.questions.length - 1) {
        blocks.push({ type: 'divider' });
      }
    });

    // Add submit button
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Submit Survey',
            emoji: true
          },
          style: 'primary',
          value: responseId,
          action_id: 'submit_survey'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Cancel',
            emoji: true
          },
          value: responseId,
          action_id: 'cancel_survey'
        }
      ]
    });

    return blocks;
  }

  /**
   * Format individual question as Slack block
   */
  formatQuestionBlock(question, index, responseId) {
    const questionId = question._id || question.id;
    const actionId = `q_${responseId}_${questionId}`;

    switch (question.type) {
      case 'scale':
        return {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${index + 1}. ${question.question}*${question.required ? ' *(Required)*' : ''}`
          },
          accessory: {
            type: 'static_select',
            placeholder: {
              type: 'plain_text',
              text: 'Select rating',
              emoji: true
            },
            options: this.generateScaleOptions(question.scale),
            action_id: actionId
          }
        };

      case 'multiple_choice':
        return {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${index + 1}. ${question.question}*${question.required ? ' *(Required)*' : ''}`
          },
          accessory: {
            type: 'static_select',
            placeholder: {
              type: 'plain_text',
              text: 'Choose option',
              emoji: true
            },
            options: question.options.map(option => ({
              text: {
                type: 'plain_text',
                text: option,
                emoji: true
              },
              value: option
            })),
            action_id: actionId
          }
        };

      case 'boolean':
        return {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${index + 1}. ${question.question}*${question.required ? ' *(Required)*' : ''}`
          },
          accessory: {
            type: 'radio_buttons',
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: '✅ Yes',
                  emoji: true
                },
                value: 'true'
              },
              {
                text: {
                  type: 'plain_text',
                  text: '❌ No',
                  emoji: true
                },
                value: 'false'
              }
            ],
            action_id: actionId
          }
        };

      case 'text':
        return {
          type: 'input',
          block_id: actionId,
          element: {
            type: 'plain_text_input',
            multiline: true,
            action_id: `${actionId}_input`,
            placeholder: {
              type: 'plain_text',
              text: 'Type your answer here...'
            }
          },
          label: {
            type: 'plain_text',
            text: `${index + 1}. ${question.question}${question.required ? ' (Required)' : ''}`,
            emoji: true
          },
          optional: !question.required
        };

      default:
        return {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${index + 1}. ${question.question}*`
          }
        };
    }
  }

  /**
   * Generate scale options
   */
  generateScaleOptions(scale) {
    const options = [];
    const min = scale?.min || 1;
    const max = scale?.max || 5;
    
    for (let i = min; i <= max; i++) {
      let emoji = '';
      if (max === 5) {
        emoji = ['😔', '😕', '😐', '🙂', '😊'][i - 1] || '';
      }
      
      const label = scale?.labels?.[i] || i.toString();
      options.push({
        text: {
          type: 'plain_text',
          text: `${emoji} ${i} - ${label}`.trim(),
          emoji: true
        },
        value: i.toString()
      });
    }
    return options;
  }

  /**
   * Handle survey response interaction
   */
  async handleSurveyResponse(payload) {
    try {
      const { user, actions, type } = payload;
      
      if (type === 'block_actions' && actions && actions[0]) {
        const action = actions[0];
        
        // Handle survey submission
        if (action.action_id === 'submit_survey') {
          return await this.submitSurvey(action.value, user.id);
        }
        
        // Handle survey cancellation
        if (action.action_id === 'cancel_survey') {
          this.pendingResponses.delete(action.value);
          return {
            response_action: 'update',
            text: 'Survey cancelled. You can take it again anytime using `/wellness-survey`.'
          };
        }
        
        // Handle question responses
        if (action.action_id.startsWith('q_')) {
          const parts = action.action_id.split('_');
          const responseId = parts[1];
          const questionId = parts.slice(2).join('_');
          
          const pendingResponse = this.pendingResponses.get(responseId);
          if (pendingResponse) {
            pendingResponse.responses.set(questionId, action.selected_option?.value || action.value);
            console.log(`Recorded response for question ${questionId}: ${action.selected_option?.value || action.value}`);
          }
          
          return {
            response_action: 'update',
            text: 'Response recorded. Please continue with the survey.'
          };
        }
      }
      
      // Handle text input submissions
      if (type === 'view_submission' || (payload.state && payload.state.values)) {
        const values = payload.state.values;
        for (const blockId in values) {
          if (blockId.startsWith('q_')) {
            const parts = blockId.split('_');
            const responseId = parts[1];
            const questionId = parts.slice(2).join('_');
            
            const pendingResponse = this.pendingResponses.get(responseId);
            if (pendingResponse && values[blockId]) {
              const inputValue = Object.values(values[blockId])[0]?.value;
              if (inputValue) {
                pendingResponse.responses.set(questionId, inputValue);
              }
            }
          }
        }
      }
      
      return { text: 'Response recorded' };
    } catch (error) {
      console.error('Error handling survey response:', error);
      return {
        text: 'Sorry, there was an error processing your response. Please try again.'
      };
    }
  }

  /**
   * Submit survey responses
   */
  async submitSurvey(responseId, slackUserId) {
    try {
      const pendingResponse = this.pendingResponses.get(responseId);
      if (!pendingResponse) {
        return {
          text: 'Survey session expired. Please start a new survey using `/wellness-survey`.'
        };
      }

      const { userId, surveyId, responses, startedAt } = pendingResponse;
      
      // Get user and survey
      const user = await User.findById(userId);
      const survey = await Survey.findById(surveyId).populate('questions');
      
      if (!user || !survey) {
        return {
          text: 'Survey or user not found. Please try again.'
        };
      }

      // Validate required questions
      const requiredQuestions = survey.questions.filter(q => q.required);
      const missingRequired = requiredQuestions.filter(q => !responses.has(q._id.toString()));
      
      if (missingRequired.length > 0) {
        return {
          text: `Please answer all required questions. Missing: ${missingRequired.map(q => q.question).join(', ')}`
        };
      }

      // Format responses
      const formattedResponses = [];
      survey.questions.forEach(question => {
        const questionId = question._id.toString();
        const answer = responses.get(questionId);
        
        if (answer !== undefined) {
          formattedResponses.push({
            questionId: question._id,
            question: question.question,
            answer: question.type === 'scale' || question.type === 'boolean' ? 
              (question.type === 'boolean' ? answer === 'true' : parseInt(answer)) : 
              answer,
            type: question.type
          });
        }
      });

      // Create check-in record
      const checkIn = await CheckIn.create({
        userId: user._id,
        surveyId: survey._id,
        surveyType: survey.type,
        responses: formattedResponses,
        completedAt: new Date(),
        duration: Math.round((Date.now() - startedAt.getTime()) / 1000), // in seconds
        source: 'slack',
        metadata: {
          slackUserId: user.integrations.slack.userId,
          responseId
        }
      });

      // Update user stats
      user.wellness.totalCheckIns += 1;
      user.wellness.lastCheckIn = new Date();
      
      // Calculate average mood if applicable
      const moodResponses = formattedResponses.filter(r => 
        r.question.toLowerCase().includes('mood') || 
        r.question.toLowerCase().includes('feeling')
      );
      
      if (moodResponses.length > 0 && typeof moodResponses[0].answer === 'number') {
        const allMoodCheckIns = await CheckIn.find({
          userId: user._id,
          'responses.question': { $regex: /mood|feeling/i }
        }).limit(10).sort('-createdAt');
        
        const moodValues = allMoodCheckIns.flatMap(ci => 
          ci.responses
            .filter(r => r.question.toLowerCase().includes('mood') || r.question.toLowerCase().includes('feeling'))
            .map(r => r.answer)
            .filter(a => typeof a === 'number')
        );
        
        if (moodValues.length > 0) {
          user.wellness.averageMood = moodValues.reduce((a, b) => a + b, 0) / moodValues.length;
        }
      }

      // Update streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const lastCheckInDate = user.wellness.lastCheckIn;
      
      if (lastCheckInDate && lastCheckInDate.toDateString() === yesterday.toDateString()) {
        user.wellness.currentStreak += 1;
        user.wellness.longestStreak = Math.max(user.wellness.currentStreak, user.wellness.longestStreak);
      } else if (!lastCheckInDate || lastCheckInDate.toDateString() !== new Date().toDateString()) {
        user.wellness.currentStreak = 1;
      }

      // Award happy coins
      const baseReward = survey.rewards?.happyCoins || 50;
      const streakBonus = user.wellness.currentStreak > 7 ? 25 : 0;
      const totalReward = baseReward + streakBonus;
      
      user.wellness.happyCoins += totalReward;
      await user.save();

      // Check for achievements
      await achievementService.checkAndAwardAchievements(user._id);

      // Clean up pending response
      this.pendingResponses.delete(responseId);

      // Send success message
      return {
        response_action: 'update',
        text: `✅ Survey completed successfully!\n\n🎉 You earned ${totalReward} Happy Coins${streakBonus > 0 ? ` (including ${streakBonus} streak bonus!)` : ''}!\n📊 Current streak: ${user.wellness.currentStreak} days\n💰 Total Happy Coins: ${user.wellness.happyCoins}\n\nGreat job taking care of your wellness! 💪`
      };
    } catch (error) {
      console.error('Error submitting survey:', error);
      return {
        text: 'Sorry, there was an error submitting your survey. Please try again.'
      };
    }
  }

  /**
   * Send weekly check-in survey
   */
  async sendWeeklyCheckIn(userId) {
    try {
      // Find or create weekly check-in survey
      let weeklyCheckIn = await Survey.findOne({
        type: 'pulse',
        title: { $regex: /weekly.*check.*in/i },
        isActive: true
      });

      if (!weeklyCheckIn) {
        // Create default weekly check-in if it doesn't exist
        weeklyCheckIn = await Survey.create({
          title: 'Weekly Wellness Check-In',
          description: 'How has your week been? This quick survey helps us understand your wellness trends.',
          type: 'pulse',
          category: 'wellness',
          priority: 'high',
          frequency: 'weekly',
          estimatedTime: '3 minutes',
          questions: [
            {
              question: 'Overall, how would you rate your mood this week?',
              type: 'scale',
              required: true,
              scale: { min: 1, max: 5 }
            },
            {
              question: 'How would you rate your energy levels this week?',
              type: 'scale',
              required: true,
              scale: { min: 1, max: 5 }
            },
            {
              question: 'How well did you manage stress this week?',
              type: 'scale',
              required: true,
              scale: { min: 1, max: 5 }
            },
            {
              question: 'Did you feel supported by your team this week?',
              type: 'boolean',
              required: true
            },
            {
              question: 'What went well this week? (Optional)',
              type: 'text',
              required: false
            },
            {
              question: 'Any concerns or challenges you\'d like to share?',
              type: 'text',
              required: false
            }
          ],
          rewards: {
            happyCoins: 75,
            streakBonus: 25
          },
          isActive: true
        });
      }

      return await this.sendSurveyToUser(userId, weeklyCheckIn._id);
    } catch (error) {
      console.error('Error sending weekly check-in:', error);
      return false;
    }
  }

  /**
   * Handle slash command for surveys
   */
  async handleSurveyCommand(slackUserId, text) {
    try {
      const user = await User.findOne({ 'integrations.slack.userId': slackUserId });
      
      if (!user) {
        return {
          text: 'Please connect your Slack account to your wellness profile first. Contact your HR admin for assistance.',
          response_type: 'ephemeral'
        };
      }

      // Get active surveys for user
      const surveys = await Survey.find({
        isActive: true,
        $or: [
          { targetAudience: 'all' },
          { targetDepartments: user.department },
          { targetUsers: user._id }
        ]
      }).sort('-priority -createdAt');

      if (surveys.length === 0) {
        return {
          text: 'No surveys available at the moment. Check back later!',
          response_type: 'ephemeral'
        };
      }

      // If specific survey ID provided
      if (text && text.trim()) {
        const survey = surveys.find(s => s._id.toString() === text.trim());
        if (survey) {
          await this.sendSurveyToUser(user._id, survey._id);
          return {
            text: `Survey "${survey.title}" has been sent to you. Check your DMs!`,
            response_type: 'ephemeral'
          };
        }
      }

      // Otherwise show survey list
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📋 Available Surveys',
            emoji: true
          }
        },
        {
          type: 'divider'
        }
      ];

      surveys.forEach((survey, index) => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${index + 1}. ${survey.title}*\n${survey.description}\n🎯 Priority: ${survey.priority} | 💰 Reward: ${survey.rewards?.happyCoins || 0} coins | ⏱️ Time: ${survey.estimatedTime || '5 min'}`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Take Survey',
              emoji: true
            },
            value: survey._id.toString(),
            action_id: `start_survey_${survey._id}`
          }
        });
      });

      return {
        blocks,
        response_type: 'ephemeral'
      };
    } catch (error) {
      console.error('Error handling survey command:', error);
      return {
        text: 'Sorry, something went wrong. Please try again.',
        response_type: 'ephemeral'
      };
    }
  }

  /**
   * Handle quick check-in command
   */
  async handleQuickCheckInCommand(slackUserId) {
    try {
      console.log('Quick check-in for Slack user:', slackUserId);
      
      // For now, skip user lookup and just return the check-in UI
      // This allows testing without user connection
      const responseId = `quick_${slackUserId}_${Date.now()}`;
      
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🌟 Quick Wellness Check-In',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'How are you feeling right now?'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '😊 Excellent',
                emoji: true
              },
              style: 'primary',
              value: `${responseId}_mood_5`,
              action_id: 'quick_mood_5'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🙂 Good',
                emoji: true
              },
              value: `${responseId}_mood_4`,
              action_id: 'quick_mood_4'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '😐 Neutral',
                emoji: true
              },
              value: `${responseId}_mood_3`,
              action_id: 'quick_mood_3'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '😕 Not Great',
                emoji: true
              },
              value: `${responseId}_mood_2`,
              action_id: 'quick_mood_2'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '😔 Poor',
                emoji: true
              },
              style: 'danger',
              value: `${responseId}_mood_1`,
              action_id: 'quick_mood_1'
            }
          ]
        }
      ];

      console.log('Returning quick check-in blocks');
      
      return {
        blocks,
        response_type: 'ephemeral'
      };
    } catch (error) {
      console.error('Error handling quick check-in:', error.message, error.stack);
      return {
        text: 'Sorry, something went wrong. Please try again.',
        response_type: 'ephemeral'
      };
    }
  }

  /**
   * Handle quick mood check-in response
   */
  async handleQuickMoodResponse(payload) {
    try {
      const { user, actions } = payload;
      const action = actions[0];
      const mood = parseInt(action.action_id.split('_').pop());
      
      console.log('Quick mood response:', {
        slackUserId: user.id,
        mood: mood,
        action: action.action_id
      });
      
      const slackUser = await User.findOne({ 'integrations.slack.userId': user.id });
      if (!slackUser) {
        console.log('User not found for Slack ID:', user.id);
        return {
          response_action: 'update',
          text: 'User not found. Please connect your Slack account.',
          response_type: 'ephemeral'
        };
      }

      // Create a quick check-in
      const checkIn = await CheckIn.create({
        userId: slackUser._id,
        mood,
        source: 'slack',
        responses: [{
          question: 'Quick mood check-in',
          answer: mood,
          type: 'scale'
        }],
        metadata: {
          type: 'quick_checkin',
          slackUserId: user.id
        }
      });

      // Update user stats
      slackUser.wellness.happyCoins += 25;
      slackUser.wellness.totalCheckIns += 1;
      slackUser.wellness.lastCheckIn = new Date();
      await slackUser.save();

      const moodEmoji = ['😔', '😕', '😐', '🙂', '😊'][mood - 1];
      
      console.log('Check-in created successfully:', {
        userId: slackUser._id,
        mood: mood,
        happyCoins: slackUser.wellness.happyCoins
      });
      
      return {
        response_action: 'update',
        text: `Thanks for checking in! ${moodEmoji}\n\n📊 Your mood: ${mood}/5\n💰 Happy Coins earned: +25\n💎 Total coins: ${slackUser.wellness.happyCoins}\n🔥 Current streak: ${slackUser.wellness.currentStreak} days\n\n${mood <= 2 ? '🤗 Remember, it\'s okay to have tough days. Consider reaching out to someone or taking a break.' : 'Keep up the great work! 💪'}`
      };
    } catch (error) {
      console.error('Error handling quick mood response:', error.message, error.stack);
      return {
        response_action: 'update',
        text: 'Sorry, there was an error recording your check-in. Please try again.'
      };
    }
  }
}

module.exports = new SlackSurveyService();