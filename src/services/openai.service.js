const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    this.client = null;
    this.isEnabled = false;
    this.isVerified = false;
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
  }

  async initialize() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OpenAI API key not configured. AI features will be disabled.');
      return;
    }

    try {
      console.log('🤖 Initializing OpenAI service...');
      
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      // Verify the API key by making a simple request
      console.log('🤖 Verifying OpenAI connection...');
      const verification = await this.testConnection();
      
      if (verification.success) {
        this.isEnabled = true;
        this.isVerified = true;
        console.log('✅ OpenAI service connected and verified successfully');
      } else {
        throw new Error(verification.error);
      }
    } catch (error) {
      console.error('❌ OpenAI service initialization failed:', error.message);
      console.warn('⚠️  AI features will be disabled');
      this.isEnabled = false;
      this.isVerified = false;
    }
  }

  // Test OpenAI API connection
  async testConnection() {
    if (!this.client) {
      return { success: false, error: 'OpenAI client not initialized' };
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

  // =============================================================================
  // JOURNALING AI METHODS
  // =============================================================================

  // Generate personalized journal prompts
  async generateJournalPrompts(promptData) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const {
        user,
        promptType = 'reflection',
        currentMood,
        recentMoods = [],
        riskLevel = 'low',
        recentThemes = [],
        count = 3
      } = promptData;

      const prompt = `
You are a wellness AI assistant generating personalized journal prompts for an employee.

Employee Context:
- Department: ${user.department || 'Unknown'}
- Current Mood: ${currentMood}/5
- Recent Moods: ${recentMoods.join(', ') || 'No recent data'}
- Risk Level: ${riskLevel}
- Recent Journal Themes: ${recentThemes.join(', ') || 'None'}
- Prompt Type: ${promptType}

Generate ${count} personalized, thoughtful journal prompts that:
1. Match the requested prompt type (${promptType})
2. Are appropriate for the user's current mood and situation
3. Encourage meaningful self-reflection
4. Are engaging and not repetitive
5. Consider the user's context and recent patterns

Prompt Types:
- reflection: Self-examination and introspection
- gratitude: Appreciation and thankfulness
- goal-setting: Future planning and aspirations
- stress-relief: Coping and relaxation
- mindfulness: Present-moment awareness
- creativity: Imagination and expression
- growth: Learning and development
- challenge: Overcoming obstacles

Respond in valid JSON format only:
{
  "prompts": [
    {
      "id": "unique_id",
      "text": "The prompt text here",
      "category": "${promptType}",
      "difficulty": "easy|medium|deep",
      "estimatedTime": "5-10 minutes",
      "tags": ["tag1", "tag2"],
      "moodAppropriate": [1,2,3,4,5]
    }
  ],
  "personalizationNote": "Brief explanation of how these were personalized"
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a wellness AI assistant specializing in journaling. Create thoughtful, engaging prompts that encourage meaningful reflection.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.8 // Higher temperature for creative prompts
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      try {
        const result = JSON.parse(content);
        return {
          ...result,
          usage: response.usage,
          generatedAt: new Date(),
          basedOnMood: currentMood,
          promptType
        };
      } catch (parseError) {
        console.error('Failed to parse journal prompts:', content);
        return null;
      }
    } catch (error) {
      console.error('Journal prompt generation failed:', error.message);
      return null;
    }
  }

  // Analyze journal entry for insights
  async analyzeJournalEntry(journalData) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const { title, content, mood, category, user } = journalData;

      const prompt = `
You are a wellness AI assistant analyzing a journal entry for insights and patterns.

Journal Entry:
- Title: "${title}"
- Content: "${content}"
- Mood When Written: ${mood}/5
- Category: ${category}
- Word Count: ${content.split(' ').length}

User Context:
- Department: ${user.department || 'Unknown'}
- Current Risk Level: ${user.wellness?.riskLevel || 'unknown'}

Analyze this journal entry and provide:
1. Sentiment analysis (-1 to 1 scale)
2. Key emotions detected
3. Main themes and topics
4. Personal insights and patterns
5. Recommendations for follow-up reflection
6. Any wellness concerns or positive indicators

Respond in valid JSON format only:
{
  "sentimentScore": number_between_-1_and_1,
  "emotions": [
    {
      "emotion": "emotion_name",
      "intensity": number_between_0_and_1,
      "confidence": number_between_0_and_1
    }
  ],
  "keyThemes": ["theme1", "theme2", "theme3"],
  "insights": [
    {
      "type": "pattern|strength|concern|growth",
      "description": "insight description",
      "confidence": number_between_0_and_1
    }
  ],
  "recommendations": [
    {
      "type": "reflection|action|resource",
      "suggestion": "specific recommendation",
      "priority": "high|medium|low"
    }
  ],
  "wellnessIndicators": {
    "positive": ["indicator1", "indicator2"],
    "concerns": ["concern1"],
    "overall": "positive|neutral|concerning"
  },
  "followUpPrompts": ["prompt1", "prompt2"]
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional wellness AI assistant analyzing journal entries. Be thorough, empathetic, and provide actionable insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.4 // Moderate temperature for consistent analysis
      });

      const analysisContent = response.choices[0]?.message?.content?.trim();
      
      try {
        const analysis = JSON.parse(analysisContent);
        return {
          ...analysis,
          usage: response.usage,
          analyzedAt: new Date(),
          entryMood: mood,
          entryCategory: category
        };
      } catch (parseError) {
        console.error('Failed to parse journal analysis:', analysisContent);
        return null;
      }
    } catch (error) {
      console.error('Journal entry analysis failed:', error.message);
      return null;
    }
  }

  // Generate insights from multiple journal entries
  async generateJournalInsights(journalEntries) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const entriesSummary = journalEntries.map(entry => ({
        date: entry.createdAt.toISOString().split('T')[0],
        mood: entry.mood,
        category: entry.category,
        wordCount: entry.wordCount,
        themes: entry.aiInsights?.keyThemes || [],
        contentSample: entry.content.substring(0, 200) + '...'
      }));

      const prompt = `
You are a wellness AI assistant analyzing multiple journal entries to identify patterns and generate comprehensive insights.

Journal Entries Summary (${journalEntries.length} entries):
${entriesSummary.map(entry => 
  `Date: ${entry.date}, Mood: ${entry.mood}/5, Category: ${entry.category}, Words: ${entry.wordCount}
  Sample: "${entry.contentSample}"`
).join('\n\n')}

Analyze these journal entries and provide:
1. Overall patterns and trends
2. Mood progression analysis
3. Recurring themes and topics
4. Personal growth indicators
5. Areas of concern or strength
6. Recommendations for continued journaling
7. Insights about writing habits and consistency

Respond in valid JSON format only:
{
  "overallSummary": "comprehensive summary of the journal entries",
  "patterns": {
    "moodTrends": "description of mood patterns",
    "recurringThemes": ["theme1", "theme2", "theme3"],
    "writingStyle": "analysis of writing patterns",
    "consistency": "assessment of journaling frequency and quality"
  },
  "insights": [
    {
      "category": "growth|concern|strength|pattern",
      "title": "insight title",
      "description": "detailed description",
      "evidence": ["supporting evidence"],
      "significance": "high|medium|low"
    }
  ],
  "recommendations": {
    "immediate": ["recommendation1", "recommendation2"],
    "ongoing": ["recommendation1", "recommendation2"],
    "resources": ["resource1", "resource2"]
  },
  "wellnessAssessment": {
    "overallTrend": "improving|stable|declining",
    "keyStrengths": ["strength1", "strength2"],
    "areasForGrowth": ["area1", "area2"],
    "riskIndicators": ["indicator1"] or []
  },
  "motivationalMessage": "encouraging message based on the analysis"
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional wellness AI assistant providing comprehensive journal insights. Be thorough, supportive, and focus on actionable patterns and recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens * 1.5, // More tokens for comprehensive analysis
        temperature: 0.5
      });

      const insightsContent = response.choices[0]?.message?.content?.trim();
      
      try {
        const insights = JSON.parse(insightsContent);
        return {
          ...insights,
          usage: response.usage,
          generatedAt: new Date(),
          entriesAnalyzed: journalEntries.length,
          analysisTimeframe: {
            startDate: journalEntries[journalEntries.length - 1]?.createdAt,
            endDate: journalEntries[0]?.createdAt
          }
        };
      } catch (parseError) {
        console.error('Failed to parse journal insights:', insightsContent);
        return null;
      }
    } catch (error) {
      console.error('Journal insights generation failed:', error.message);
      return null;
    }
  }

  // Analyze text for word frequency and sentiment
  async analyzeTextForWordFrequency(textData) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const { text, sourceType, userId, metadata = {} } = textData;

      const prompt = `
You are a wellness AI assistant analyzing text for word frequency, sentiment, and themes.

Text to Analyze:
"${text}"

Source Type: ${sourceType}
User Context:
- Department: ${metadata.department || 'Unknown'}
- Current Mood: ${metadata.mood || 'N/A'}
- Risk Level: ${metadata.riskLevel || 'unknown'}

Analyze this text and provide:
1. Extract the 10-15 most meaningful words (excluding common stop words)
2. Assign sentiment to each word (positive/negative/neutral)
3. Calculate overall sentiment score (-1 to 1)
4. Identify key themes and emotions
5. Detect any wellness concerns or strengths

Guidelines:
- Focus on emotionally significant words
- Include professional/workplace terms if relevant
- Weight words by emotional intensity and relevance
- Consider context when assigning sentiment

Respond in valid JSON format only:
{
  "words": [
    {
      "word": "word_here",
      "count": number,
      "weight": number_0_to_1,
      "sentiment": "positive|negative|neutral",
      "category": "emotion|work|wellness|general"
    }
  ],
  "sentiment": {
    "score": number_-1_to_1,
    "label": "very_negative|negative|neutral|positive|very_positive"
  },
  "themes": [
    {
      "theme": "theme_name",
      "confidence": number_0_to_1
    }
  ],
  "emotions": [
    {
      "emotion": "emotion_name",
      "intensity": number_0_to_1
    }
  ],
  "insights": {
    "concerns": ["concern1", "concern2"],
    "strengths": ["strength1", "strength2"],
    "summary": "brief analysis summary"
  }
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a wellness AI analyzing text for word frequency and sentiment. Focus on meaningful, emotionally significant words while excluding common stop words.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3 // Low temperature for consistent analysis
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      try {
        const analysis = JSON.parse(content);
        return {
          ...analysis,
          usage: response.usage,
          analyzedAt: new Date()
        };
      } catch (parseError) {
        console.error('Failed to parse word frequency analysis:', content);
        return null;
      }
    } catch (error) {
      console.error('Word frequency analysis failed:', error.message);
      return null;
    }
  }

  // Generate insights from aggregated word frequency data
  async generateWordCloudInsights(wordCloudData) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const { topWords, timeframe, department, totalUsers } = wordCloudData;

      const prompt = `
You are a wellness AI assistant analyzing company-wide word frequency data to provide insights about employee sentiment and wellness.

Word Frequency Data (Top 20 words):
${topWords.map(w => `- "${w.word}": ${w.frequency} occurrences, ${w.userCount} users, sentiment: ${w.sentimentBreakdown ? JSON.stringify(w.sentimentBreakdown) : 'unknown'}`).join('\n')}

Context:
- Time Period: ${timeframe}
- Department: ${department || 'Company-wide'}
- Total Active Users: ${totalUsers}

Analyze this word frequency data and provide:
1. Overall company sentiment assessment
2. Key themes and patterns
3. Wellness insights based on word usage
4. Potential areas of concern
5. Positive indicators and strengths
6. Actionable recommendations for HR

Consider:
- Frequency of positive vs negative words
- Work-related stress indicators
- Team/collaboration mentions
- Wellness and health-related terms
- Professional development themes

Respond in valid JSON format only:
{
  "overallSentiment": {
    "score": number_-1_to_1,
    "label": "very_negative|negative|neutral|positive|very_positive",
    "description": "detailed assessment"
  },
  "keyThemes": [
    {
      "theme": "theme_name",
      "description": "theme description",
      "relatedWords": ["word1", "word2"],
      "significance": "high|medium|low"
    }
  ],
  "wellnessInsights": {
    "positiveIndicators": [
      {
        "indicator": "indicator_name",
        "evidence": ["word1", "word2"],
        "impact": "description of positive impact"
      }
    ],
    "concerns": [
      {
        "concern": "concern_name",
        "evidence": ["word1", "word2"],
        "severity": "high|medium|low",
        "recommendation": "specific action"
      }
    ]
  },
  "departmentSpecific": {
    "strengths": ["strength1", "strength2"],
    "challenges": ["challenge1", "challenge2"],
    "culture": "brief culture description based on words"
  },
  "recommendations": [
    {
      "priority": "high|medium|low",
      "action": "specific recommendation",
      "rationale": "why this is important",
      "expectedImpact": "what this will achieve"
    }
  ],
  "summary": "Executive summary of the word analysis insights"
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional wellness AI providing insights from word frequency analysis. Be thorough, data-driven, and focused on actionable recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1200,
        temperature: 0.5
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      try {
        const insights = JSON.parse(content);
        return {
          ...insights,
          usage: response.usage,
          generatedAt: new Date(),
          dataAnalyzed: {
            wordCount: topWords.length,
            timeframe,
            department: department || 'Company-wide'
          }
        };
      } catch (parseError) {
        console.error('Failed to parse word cloud insights:', content);
        return null;
      }
    } catch (error) {
      console.error('Word cloud insights generation failed:', error.message);
      return null;
    }
  }

  // Generate personalized daily motivational quotes
  async generateDailyQuote(quoteData) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const {
        user,
        currentMood,
        recentMoods = [],
        riskLevel = 'low',
        recentThemes = [],
        previousQuotes = []
      } = quoteData;

      const prompt = `
You are a wellness AI assistant generating a personalized daily motivational quote for an employee.

Employee Context:
- Name: ${user.name || 'Employee'}
- Department: ${user.department || 'Unknown'}
- Current Mood: ${currentMood}/5
- Recent Moods (last 7 days): ${recentMoods.join(', ') || 'No recent data'}
- Risk Level: ${riskLevel}
- Recent Focus Areas: ${recentThemes.join(', ') || 'General wellness'}

Previous Quotes (to avoid repetition):
${previousQuotes.map(q => `"${q.quote}" - ${q.author}`).join('\n') || 'None'}

Generate a personalized motivational quote that:
1. Is appropriate for their current mood and situation
2. Addresses their risk level (higher support for higher risk)
3. Is not repetitive of previous quotes
4. Is genuinely inspiring and actionable
5. Feels personal and relevant
6. Is professional and workplace-appropriate

Consider these guidelines:
- Low risk + good mood: Encouraging continued growth
- Low risk + neutral mood: Gentle motivation
- Low risk + low mood: Supportive and uplifting
- Medium/High risk: Extra supportive, focusing on strength and resilience

Respond in valid JSON format only:
{
  "quote": "The motivational quote text",
  "author": "Real or attributed author name",
  "category": "motivation|resilience|growth|wellness|mindfulness|strength",
  "personalization": {
    "moodMatch": "explanation of how it matches their mood",
    "relevance": "why this quote is relevant to their situation",
    "intention": "what this quote is meant to achieve"
  },
  "actionPrompt": "A brief suggestion of how to apply this quote today",
  "tags": ["tag1", "tag2", "tag3"]
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a wellness AI assistant creating personalized daily motivational quotes. Be inspiring, genuine, and appropriately supportive based on the user\'s current state.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.8 // Higher temperature for creative quote generation
      });

      const quoteContent = response.choices[0]?.message?.content?.trim();
      
      try {
        const quoteResult = JSON.parse(quoteContent);
        return {
          ...quoteResult,
          usage: response.usage,
          generatedAt: new Date(),
          basedOnMood: currentMood,
          basedOnRisk: riskLevel,
          date: new Date().toISOString().split('T')[0]
        };
      } catch (parseError) {
        console.error('Failed to parse daily quote:', quoteContent);
        return null;
      }
    } catch (error) {
      console.error('Daily quote generation failed:', error.message);
      return null;
    }
  }
}

module.exports = new OpenAIService();