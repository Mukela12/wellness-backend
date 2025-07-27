const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OpenAI API key not configured. AI features will be disabled.');
      this.isEnabled = false;
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
      this.isEnabled = true;
      console.log('✅ OpenAI service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI service:', error.message);
      this.isEnabled = false;
    }
  }

  // Test OpenAI API connection
  async testConnection() {
    if (!this.isEnabled) {
      return { success: false, error: 'OpenAI service not enabled' };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: 'Say "OpenAI connection test successful" if you can read this message.'
          }
        ],
        max_tokens: 50,
        temperature: 0
      });

      const result = response.choices[0]?.message?.content?.trim();
      
      return {
        success: true,
        message: result,
        usage: response.usage,
        model: this.model
      };
    } catch (error) {
      console.error('OpenAI connection test failed:', error.message);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  // Analyze check-in sentiment and provide insights
  async analyzeCheckIn(checkInData) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const { mood, feedback, user } = checkInData;
      
      const prompt = `
You are a wellness AI assistant analyzing an employee's daily check-in. Provide a brief, empathetic analysis and personalized insights.

Employee Check-in Data:
- Mood Rating: ${mood}/5 (1=Very Bad, 2=Bad, 3=Neutral, 4=Good, 5=Excellent)
- Feedback: "${feedback || 'No feedback provided'}"
- Current Streak: ${user.wellness?.currentStreak || 0} days
- Department: ${user.department || 'Unknown'}

Please provide:
1. Sentiment score (-1 to 1, where -1 is very negative, 0 is neutral, 1 is very positive)
2. Key emotions detected (max 3)
3. Risk indicators (if any)
4. A personalized message (2-3 sentences, supportive and professional)
5. 2-3 actionable recommendations

Respond in valid JSON format only:
{
  "sentimentScore": number,
  "emotions": ["emotion1", "emotion2"],
  "riskIndicators": ["indicator1"],
  "personalizedMessage": "message here",
  "recommendations": ["recommendation1", "recommendation2"]
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional wellness AI assistant. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.7
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      try {
        const analysis = JSON.parse(content);
        
        // Validate the response structure
        if (typeof analysis.sentimentScore !== 'number' || 
            !Array.isArray(analysis.emotions) ||
            !Array.isArray(analysis.riskIndicators) ||
            !Array.isArray(analysis.recommendations) ||
            typeof analysis.personalizedMessage !== 'string') {
          throw new Error('Invalid response structure');
        }

        return {
          ...analysis,
          usage: response.usage,
          processedAt: new Date()
        };
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', content);
        return null;
      }
    } catch (error) {
      console.error('Check-in analysis failed:', error.message);
      return null;
    }
  }

  // Generate personalized wellness insights
  async generatePersonalizedInsights(userData) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const {
        user,
        recentCheckIns,
        moodTrend,
        onboardingAnswers
      } = userData;

      const prompt = `
You are a wellness AI assistant generating personalized insights for an employee based on their wellness data.

Employee Profile:
- Name: ${user.name}
- Department: ${user.department}
- Current Streak: ${user.wellness?.currentStreak || 0} days
- Average Mood: ${user.wellness?.averageMood || 'N/A'}/5
- Risk Level: ${user.wellness?.riskLevel || 'unknown'}

Recent Check-ins (last 7 days):
${recentCheckIns?.map(ci => `- ${ci.date}: Mood ${ci.mood}/5 - "${ci.feedback || 'No feedback'}"`).join('\n') || 'No recent check-ins'}

Mood Trend: ${moodTrend || 'No trend data available'}

Onboarding Preferences:
- Stress Level: ${onboardingAnswers?.currentStressLevel || 'Unknown'}/5
- Wellness Goals: ${onboardingAnswers?.wellnessGoals?.join(', ') || 'Not specified'}
- Stress Factors: ${onboardingAnswers?.stressFactors?.join(', ') || 'Not specified'}

Generate personalized wellness insights including:
1. Overall wellness assessment
2. Pattern analysis
3. Specific recommendations
4. Motivational message
5. Areas of strength
6. Areas for improvement

Respond in valid JSON format only:
{
  "overallAssessment": "assessment here",
  "patterns": ["pattern1", "pattern2"],
  "recommendations": [
    {
      "category": "category",
      "title": "title",
      "description": "description",
      "priority": "high|medium|low"
    }
  ],
  "motivationalMessage": "message here",
  "strengths": ["strength1", "strength2"],
  "improvementAreas": ["area1", "area2"]
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional wellness AI assistant. Always respond with valid JSON only. Be empathetic, supportive, and actionable.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens * 2, // More tokens for detailed insights
        temperature: 0.8
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      try {
        const insights = JSON.parse(content);
        
        return {
          ...insights,
          usage: response.usage,
          generatedAt: new Date()
        };
      } catch (parseError) {
        console.error('Failed to parse personalized insights:', content);
        return null;
      }
    } catch (error) {
      console.error('Personalized insights generation failed:', error.message);
      return null;
    }
  }

  // Generate weekly wellness summary
  async generateWeeklySummary(weeklyData) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const {
        user,
        weeklyStats,
        checkIns,
        moodTrend
      } = weeklyData;

      const prompt = `
Generate a weekly wellness summary for an employee.

Employee: ${user.name} (${user.department})

Weekly Statistics:
- Total Check-ins: ${weeklyStats.totalCheckIns}
- Average Mood: ${weeklyStats.averageMood}/5
- Engagement Rate: ${weeklyStats.engagementRate}%
- Happy Coins Earned: ${weeklyStats.happyCoinsEarned}
- Current Streak: ${user.wellness?.currentStreak || 0} days

Daily Check-ins:
${checkIns?.map(ci => `${ci.date}: Mood ${ci.mood}/5`).join('\n') || 'No check-ins this week'}

Mood Trend: ${moodTrend}

Generate a comprehensive weekly summary with:
1. Week overview
2. Key highlights
3. Mood patterns
4. Progress assessment
5. Next week recommendations

Respond in valid JSON format only:
{
  "weekOverview": "overview here",
  "highlights": ["highlight1", "highlight2"],
  "moodPatterns": "patterns description",
  "progressAssessment": "assessment here",
  "nextWeekRecommendations": ["recommendation1", "recommendation2"],
  "motivationalNote": "encouraging message"
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional wellness AI assistant providing weekly summaries. Be encouraging and data-driven.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.7
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      try {
        const summary = JSON.parse(content);
        return {
          ...summary,
          usage: response.usage,
          generatedAt: new Date()
        };
      } catch (parseError) {
        console.error('Failed to parse weekly summary:', content);
        return null;
      }
    } catch (error) {
      console.error('Weekly summary generation failed:', error.message);
      return null;
    }
  }

  // Generate risk assessment insights
  async generateRiskAssessment(riskData) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const {
        user,
        riskFactors,
        recentActivity,
        historicalData
      } = riskData;

      const prompt = `
Analyze an employee's wellness data for mental health risk assessment.

Employee: ${user.name} (${user.department})
Current Risk Level: ${user.wellness?.riskLevel || 'unknown'}

Risk Factors:
${riskFactors?.map(factor => `- ${factor}`).join('\n') || 'No specific risk factors identified'}

Recent Activity:
- Last Check-in: ${recentActivity?.lastCheckIn || 'Unknown'}
- Average Mood: ${recentActivity?.averageMood || 'N/A'}/5
- Check-in Frequency: ${recentActivity?.frequency || 'Unknown'}

Historical Patterns:
${historicalData || 'Limited historical data available'}

Provide a professional risk assessment with:
1. Risk level justification
2. Key concerns
3. Intervention recommendations
4. Support resources
5. Monitoring frequency

Respond in valid JSON format only:
{
  "riskLevel": "low|medium|high",
  "riskScore": number_0_to_10,
  "justification": "detailed explanation",
  "keyConcerns": ["concern1", "concern2"],
  "interventionRecommendations": [
    {
      "type": "immediate|short-term|long-term",
      "action": "action description",
      "priority": "high|medium|low"
    }
  ],
  "supportResources": ["resource1", "resource2"],
  "monitoringFrequency": "daily|weekly|bi-weekly"
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional wellness AI providing risk assessments. Be thorough, professional, and focused on actionable recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.3 // Lower temperature for more consistent risk assessment
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      try {
        const assessment = JSON.parse(content);
        return {
          ...assessment,
          usage: response.usage,
          assessedAt: new Date()
        };
      } catch (parseError) {
        console.error('Failed to parse risk assessment:', content);
        return null;
      }
    } catch (error) {
      console.error('Risk assessment generation failed:', error.message);
      return null;
    }
  }
}

module.exports = new OpenAIService();