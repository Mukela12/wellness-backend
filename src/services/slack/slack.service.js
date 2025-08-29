const { WebClient } = require('@slack/web-api');
const crypto = require('crypto');
const User = require('../../models/User');
const Survey = require('../../models/Survey');
const notificationService = require('../notifications/notification.service');

class SlackService {
  constructor() {
    this.clientId = process.env.SLACK_CLIENT_ID;
    this.clientSecret = process.env.SLACK_CLIENT_SECRET;
    this.signingSecret = process.env.SLACK_SIGNING_SECRET;
    this.botToken = process.env.SLACK_BOT_TOKEN;
    this.redirectUri = process.env.SLACK_REDIRECT_URI;
    
    this.client = null;
    this.isConfigured = false;
    this.isVerified = false;
  }

  async initialize() {
    if (!this.clientId || !this.clientSecret || !this.signingSecret) {
      console.warn('⚠️ Slack Service: Missing required environment variables');
      return;
    }

    try {
      console.log('💡 Initializing Slack service...');
      
      // Initialize Slack Web API client
      this.client = new WebClient(this.botToken);
      
      if (this.botToken) {
        // Verify the bot token by testing authentication
        console.log('💡 Verifying Slack connection...');
        const auth = await this.client.auth.test();
        
        this.isConfigured = true;
        this.isVerified = true;
        console.log('✅ Slack service connected and verified successfully');
        console.log(`💡 Bot User: ${auth.user} in workspace: ${auth.team}`);
      } else {
        // OAuth mode - no bot token yet
        this.isConfigured = true;
        this.isVerified = false;
        console.log('💡 Slack OAuth configured (awaiting workspace installations)');
      }
    } catch (error) {
      console.error('❌ Slack service initialization failed:', error.message);
      console.warn('⚠️  Slack functionality will be limited');
      this.isConfigured = false;
      this.isVerified = false;
    }
  }

  // Verify Slack request signature
  verifySlackRequest(req) {
    const timestamp = req.headers['x-slack-request-timestamp'];
    const slackSignature = req.headers['x-slack-signature'];
    
    if (!timestamp || !slackSignature) {
      console.error('Missing Slack headers:', { timestamp: !!timestamp, signature: !!slackSignature });
      return false;
    }
    
    // Check if request is older than 5 minutes
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > 60 * 5) {
      console.error('Slack request timestamp too old:', { timestamp, currentTime });
      return false;
    }
    
    // Create signature base string
    let bodyStr;
    if (req.rawBody) {
      bodyStr = req.rawBody;
    } else if (typeof req.body === 'string') {
      bodyStr = req.body;
    } else {
      // Fallback: reconstruct URL-encoded body
      const params = new URLSearchParams();
      Object.keys(req.body).forEach(key => {
        params.append(key, req.body[key]);
      });
      bodyStr = params.toString();
    }
    
    const sigBasestring = `v0:${timestamp}:${bodyStr}`;
    
    // Create HMAC SHA256 hash
    const mySignature = 'v0=' + crypto
      .createHmac('sha256', this.signingSecret)
      .update(sigBasestring, 'utf8')
      .digest('hex');
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Slack signature verification:', {
        receivedSig: slackSignature,
        calculatedSig: mySignature,
        signingSecret: this.signingSecret ? 'present' : 'missing'
      });
    }
    
    // Compare signatures
    try {
      return crypto.timingSafeEqual(
        Buffer.from(mySignature, 'utf8'),
        Buffer.from(slackSignature, 'utf8')
      );
    } catch (error) {
      console.error('Signature comparison error:', error);
      return false;
    }
  }

  // OAuth flow - exchange code for token
  async handleOAuthCallback(code) {
    try {
      const result = await this.client.oauth.v2.access({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri
      });
      
      if (!result.ok) {
        throw new Error(result.error || 'OAuth failed');
      }
      
      // Store the access token and other details
      // In production, encrypt and store securely
      const { access_token, team, authed_user, bot_user_id } = result;
      
      return {
        accessToken: access_token,
        teamId: team.id,
        teamName: team.name,
        userId: authed_user.id,
        botUserId: bot_user_id
      };
    } catch (error) {
      console.error('Slack OAuth error:', error);
      throw error;
    }
  }

  // Send a direct message
  async sendDirectMessage(userId, message, blocks = null) {
    try {
      // Open a conversation with the user
      const conversation = await this.openConversation(userId);
      
      const payload = {
        channel: conversation.channel.id,
        text: message
      };
      
      if (blocks) {
        payload.blocks = blocks;
      }
      
      const result = await this.client.chat.postMessage(payload);
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to send message');
      }
      
      return result;
    } catch (error) {
      console.error('Slack send message error:', error);
      throw error;
    }
  }

  // Open a conversation with a user
  async openConversation(userId) {
    try {
      const result = await this.client.conversations.open({
        users: userId
      });
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to open conversation');
      }
      
      return result;
    } catch (error) {
      console.error('Slack open conversation error:', error);
      throw error;
    }
  }

  // Format survey as Slack blocks
  formatSurveyAsBlocks(survey) {
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
            text: `🎯 *Priority:* ${survey.priority} | 💰 *Reward:* ${survey.rewards.happyCoins} Happy Coins | ⏱️ *Questions:* ${survey.questions.length}`
          }
        ]
      },
      {
        type: 'divider'
      }
    ];

    // Add questions
    survey.questions.forEach((question, index) => {
      blocks.push(this.formatQuestionBlock(question, survey._id, index));
      
      if (index < survey.questions.length - 1) {
        blocks.push({ type: 'divider' });
      }
    });

    // Add submit action
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
          value: survey._id.toString(),
          action_id: 'submit_survey'
        }
      ]
    });

    return blocks;
  }

  // Format individual question as block
  formatQuestionBlock(question, surveyId, questionIndex) {
    const baseBlock = {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${questionIndex + 1}. ${question.question}*${question.required ? ' (Required)' : ''}`
      }
    };

    switch (question.type) {
      case 'scale':
        return {
          ...baseBlock,
          accessory: {
            type: 'static_select',
            placeholder: {
              type: 'plain_text',
              text: 'Select rating',
              emoji: true
            },
            options: this.generateScaleOptions(question.scale),
            action_id: `survey_${surveyId}_q_${question.id}`
          }
        };

      case 'multiple_choice':
        return {
          ...baseBlock,
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
            action_id: `survey_${surveyId}_q_${question.id}`
          }
        };

      case 'boolean':
        return {
          ...baseBlock,
          accessory: {
            type: 'radio_buttons',
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: 'Yes',
                  emoji: true
                },
                value: 'true'
              },
              {
                text: {
                  type: 'plain_text',
                  text: 'No',
                  emoji: true
                },
                value: 'false'
              }
            ],
            action_id: `survey_${surveyId}_q_${question.id}`
          }
        };

      case 'text':
        return {
          type: 'input',
          element: {
            type: 'plain_text_input',
            multiline: true,
            action_id: `survey_${surveyId}_q_${question.id}`
          },
          label: {
            type: 'plain_text',
            text: `${questionIndex + 1}. ${question.question}`,
            emoji: true
          },
          optional: !question.required
        };

      default:
        return baseBlock;
    }
  }

  // Generate scale options
  generateScaleOptions(scale) {
    const options = [];
    for (let i = scale.min; i <= scale.max; i++) {
      const label = scale.labels?.get(i.toString()) || i.toString();
      options.push({
        text: {
          type: 'plain_text',
          text: `${i} - ${label}`,
          emoji: true
        },
        value: i.toString()
      });
    }
    return options;
  }

  // Handle slash commands
  async handleSlashCommand(command, text, userId, responseUrl) {
    try {
      switch (command) {
        case '/wellness-survey':
          return await this.handleSurveyCommand(text, userId, responseUrl);
        
        case '/quick-checkin':
          return await this.handleQuickCheckInCommand(userId, responseUrl);
        
        default:
          return {
            text: 'Unknown command',
            response_type: 'ephemeral'
          };
      }
    } catch (error) {
      console.error('Slash command error:', error);
      return {
        text: 'Sorry, something went wrong. Please try again.',
        response_type: 'ephemeral'
      };
    }
  }

  // Handle survey slash command
  async handleSurveyCommand(surveyId, slackUserId, responseUrl) {
    // Find user by Slack ID
    const user = await User.findOne({ slackUserId });
    if (!user) {
      return {
        text: 'Please link your Slack account first. Visit the wellness portal to connect.',
        response_type: 'ephemeral'
      };
    }

    // Get active surveys for user
    const surveys = await Survey.getActiveSurveysForUser(user._id);
    
    if (surveys.length === 0) {
      return {
        text: 'No active surveys available at the moment.',
        response_type: 'ephemeral'
      };
    }

    // If specific survey ID provided, show that survey
    if (surveyId) {
      const survey = surveys.find(s => s._id.toString() === surveyId);
      if (survey) {
        const blocks = this.formatSurveyAsBlocks(survey);
        return {
          blocks,
          response_type: 'ephemeral'
        };
      }
    }

    // Otherwise, show list of available surveys
    return {
      blocks: this.formatSurveyList(surveys),
      response_type: 'ephemeral'
    };
  }

  // Format survey list
  formatSurveyList(surveys) {
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

    surveys.forEach(survey => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${survey.title}*\n${survey.description}\n🎯 Priority: ${survey.priority} | 💰 Reward: ${survey.rewards.happyCoins} coins`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Take Survey',
            emoji: true
          },
          value: survey._id.toString(),
          action_id: 'start_survey'
        }
      });
    });

    return blocks;
  }

  // Handle quick check-in command
  async handleQuickCheckInCommand(slackUserId, responseUrl) {
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
          text: 'How are you feeling today?'
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
            value: '5',
            action_id: 'quick_mood_5'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🙂 Good',
              emoji: true
            },
            value: '4',
            action_id: 'quick_mood_4'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '😐 Neutral',
              emoji: true
            },
            value: '3',
            action_id: 'quick_mood_3'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '😕 Poor',
              emoji: true
            },
            value: '2',
            action_id: 'quick_mood_2'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '😔 Very Poor',
              emoji: true
            },
            style: 'danger',
            value: '1',
            action_id: 'quick_mood_1'
          }
        ]
      }
    ];

    return {
      blocks,
      response_type: 'ephemeral'
    };
  }

  // Handle interactive components (button clicks, select menus, etc.)
  async handleInteraction(payload) {
    const { user, actions, type } = payload;
    
    // Handle different interaction types
    if (type === 'block_actions') {
      const action = actions[0];
      
      // Handle survey start
      if (action.action_id === 'start_survey') {
        return await this.startSurvey(action.value, user.id);
      }
      
      // Handle quick mood check-in
      if (action.action_id.startsWith('quick_mood_')) {
        return await this.handleQuickMoodCheckIn(user.id, action.value);
      }
      
      // Handle survey submission
      if (action.action_id === 'submit_survey') {
        return await this.submitSurvey(action.value, user.id, payload);
      }
      
      // Handle survey question responses
      if (action.action_id.startsWith('survey_')) {
        // Store response temporarily (you might want to use Redis or similar)
        return {
          response_action: 'update',
          text: 'Response recorded. Continue with the survey.'
        };
      }
    }
    
    return { text: 'Interaction received' };
  }

  // Start a survey
  async startSurvey(surveyId, slackUserId) {
    const user = await User.findOne({ slackUserId });
    if (!user) {
      return {
        text: 'Please link your Slack account first.',
        response_type: 'ephemeral'
      };
    }

    const survey = await Survey.findById(surveyId);
    if (!survey || !survey.isCurrentlyActive) {
      return {
        text: 'This survey is no longer available.',
        response_type: 'ephemeral'
      };
    }

    const blocks = this.formatSurveyAsBlocks(survey);
    return {
      blocks,
      response_type: 'ephemeral'
    };
  }

  // Handle quick mood check-in
  async handleQuickMoodCheckIn(slackUserId, mood) {
    try {
      const user = await User.findOne({ slackUserId });
      if (!user) {
        return {
          text: 'Please link your Slack account first.',
          response_type: 'ephemeral'
        };
      }

      // Create a check-in
      const CheckIn = require('../../models/CheckIn');
      const checkIn = await CheckIn.create({
        userId: user._id,
        mood: parseInt(mood),
        energy: 3, // Default values
        stress: 3,
        productivity: 3,
        workload: 3,
        source: 'slack',
        notes: 'Quick check-in via Slack'
      });

      const moodEmoji = ['😔', '😕', '😐', '🙂', '😊'][mood - 1];
      
      return {
        text: `Thanks for checking in! ${moodEmoji}\n\nYour mood: ${mood}/5\nHappy Coins earned: +${checkIn.happyCoinsEarned || 50}\nCurrent streak: ${user.wellness.currentStreak} days\n\nWant to add more details? Use \`/wellness-survey\` to take a full survey.`,
        response_type: 'ephemeral'
      };
    } catch (error) {
      console.error('Quick check-in error:', error);
      return {
        text: 'Sorry, I couldn\'t record your check-in. Please try again.',
        response_type: 'ephemeral'
      };
    }
  }

  // Get Slack user info
  async getSlackUserInfo(slackUserId) {
    try {
      const result = await this.client.users.info({
        user: slackUserId
      });
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to get user info');
      }
      
      return result.user;
    } catch (error) {
      console.error('Get Slack user info error:', error);
      throw error;
    }
  }

  // Send survey reminder
  async sendSurveyReminder(userId, survey) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.slackUserId) {
        return false;
      }

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🔔 Survey Reminder',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Hi ${user.name.split(' ')[0]}! You have a pending survey:\n\n*${survey.title}*\n${survey.description}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `⏰ Due: ${survey.dueDate ? new Date(survey.dueDate).toLocaleDateString() : 'Soon'} | 💰 Reward: ${survey.rewards.happyCoins} Happy Coins`
            }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Take Survey Now',
                emoji: true
              },
              style: 'primary',
              value: survey._id.toString(),
              action_id: 'start_survey'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Remind Me Later',
                emoji: true
              },
              value: `remind_${survey._id}`,
              action_id: 'remind_later'
            }
          ]
        }
      ];

      await this.sendDirectMessage(user.slackUserId, 'Survey reminder', blocks);
      return true;
    } catch (error) {
      console.error('Send survey reminder error:', error);
      return false;
    }
  }

  // Get service status
  getStatus() {
    return {
      configured: !!(this.clientId && this.clientSecret && this.signingSecret),
      connected: !!this.botToken,
      features: {
        surveys: true,
        quickCheckIn: true,
        reminders: true,
        interactiveMessages: true,
        slashCommands: true
      }
    };
  }

  // Send a message to a channel
  async sendMessage(channel, text, blocks = null) {
    try {
      const payload = {
        channel: channel,
        text: text
      };
      
      if (blocks) {
        payload.blocks = blocks;
      }
      
      const result = await this.client.chat.postMessage(payload);
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to send message');
      }
      
      return result;
    } catch (error) {
      console.error('Slack send message error:', error);
      throw error;
    }
  }

  // Send delayed response (for slash commands and interactions)
  async sendDelayedResponse(responseUrl, message) {
    try {
      const axios = require('axios');
      await axios.post(responseUrl, message);
    } catch (error) {
      console.error('Slack delayed response error:', error);
    }
  }
}

module.exports = new SlackService();