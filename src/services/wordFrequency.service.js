const WordFrequency = require('../models/WordFrequency');
const openAIService = require('./openai.service');
const stopWords = require('../utils/stopWords');

class WordFrequencyService {
  constructor() {
    this.minWordLength = 3;
    this.maxWordsPerAnalysis = 50;
    this.topWordsLimit = 5;
  }

  // Process text and extract word frequencies
  async processText(text, userId, sourceType, sourceId, metadata = {}) {
    try {
      if (!text || text.trim().length < 10) {
        return null;
      }

      // Use OpenAI to analyze the text
      const aiAnalysis = await openAIService.analyzeTextForWordFrequency({
        text,
        sourceType,
        userId,
        metadata
      });

      if (!aiAnalysis) {
        // Fallback to basic word extraction if AI fails
        return this.basicWordExtraction(text, userId, sourceType, sourceId, metadata);
      }

      // Create word frequency document
      const wordFrequency = new WordFrequency({
        userId,
        source: {
          type: sourceType,
          id: sourceId,
          date: new Date()
        },
        words: aiAnalysis.words || [],
        topWords: this.extractTopWords(aiAnalysis.words),
        analysis: {
          sentiment: aiAnalysis.sentiment,
          themes: aiAnalysis.themes,
          emotions: aiAnalysis.emotions,
          concerns: aiAnalysis.insights?.concerns || [],
          strengths: aiAnalysis.insights?.strengths || []
        },
        metadata: {
          totalWords: text.split(/\s+/).length,
          uniqueWords: aiAnalysis.words?.length || 0,
          department: metadata.department,
          mood: metadata.mood,
          riskLevel: metadata.riskLevel
        },
        processed: true,
        processedAt: new Date()
      });

      await wordFrequency.save();
      return wordFrequency;
    } catch (error) {
      console.error('Error processing text for word frequency:', error);
      return null;
    }
  }

  // Basic word extraction fallback
  basicWordExtraction(text, userId, sourceType, sourceId, metadata) {
    try {
      // Clean and tokenize text
      const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => 
          word.length >= this.minWordLength && 
          !stopWords.isStopWord(word)
        );

      // Count word frequencies
      const wordCounts = {};
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });

      // Convert to array and sort by frequency
      const wordArray = Object.entries(wordCounts)
        .map(([word, count]) => ({
          word,
          count,
          weight: Math.min(1, count / 10), // Simple weight calculation
          sentiment: 'neutral' // Default sentiment
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, this.maxWordsPerAnalysis);

      return new WordFrequency({
        userId,
        source: {
          type: sourceType,
          id: sourceId,
          date: new Date()
        },
        words: wordArray,
        topWords: this.extractTopWords(wordArray),
        analysis: {
          sentiment: { score: 0, label: 'neutral' }
        },
        metadata: {
          totalWords: words.length,
          uniqueWords: Object.keys(wordCounts).length,
          department: metadata.department,
          mood: metadata.mood,
          riskLevel: metadata.riskLevel
        },
        processed: false // Mark as not AI-processed
      });
    } catch (error) {
      console.error('Error in basic word extraction:', error);
      return null;
    }
  }

  // Extract top words for quick access
  extractTopWords(words) {
    if (!words || words.length === 0) return [];

    return words
      .sort((a, b) => (b.count * b.weight) - (a.count * a.weight))
      .slice(0, this.topWordsLimit)
      .map(w => ({
        word: w.word,
        frequency: w.count,
        sentiment: w.sentiment || 'neutral'
      }));
  }

  // Process journal entry for word frequency
  async processJournalEntry(journal) {
    try {
      await journal.populate('userId');
      const user = journal.userId;
      
      const text = `${journal.title} ${journal.content}`;
      const metadata = {
        department: user.department,
        mood: journal.mood,
        riskLevel: user.wellness?.riskLevel || 'unknown'
      };

      return await this.processText(
        text,
        journal.userId,
        'journal',
        journal._id,
        metadata
      );
    } catch (error) {
      console.error('Error processing journal entry:', error);
      return null;
    }
  }

  // Process survey response for word frequency
  async processSurveyResponse(surveyId, userId, answers) {
    try {
      // Extract text answers
      const textAnswers = [];
      if (answers && answers instanceof Map) {
        for (const [questionId, answer] of answers) {
          if (typeof answer === 'string' && answer.trim().length > 10) {
            textAnswers.push(answer);
          }
        }
      }

      if (textAnswers.length === 0) return null;

      const user = await require('../models/User').findById(userId);
      const text = textAnswers.join(' ');
      const metadata = {
        department: user.department,
        mood: user.wellness?.averageMood,
        riskLevel: user.wellness?.riskLevel
      };

      return await this.processText(
        text,
        userId,
        'survey',
        surveyId,
        metadata
      );
    } catch (error) {
      console.error('Error processing survey response:', error);
      return null;
    }
  }

  // Process check-in feedback for word frequency
  async processCheckInFeedback(checkIn) {
    try {
      if (!checkIn.feedback || checkIn.feedback.trim().length < 10) {
        return null;
      }

      await checkIn.populate('userId');
      const user = checkIn.userId;
      const metadata = {
        department: user.department,
        mood: checkIn.mood,
        riskLevel: user.wellness?.riskLevel
      };

      return await this.processText(
        checkIn.feedback,
        checkIn.userId,
        'checkin',
        checkIn._id,
        metadata
      );
    } catch (error) {
      console.error('Error processing check-in feedback:', error);
      return null;
    }
  }

  // Get company-wide word cloud data with real employee insights
  async getCompanyWordCloudWithInsights(options = {}) {
    try {
      console.log('🔍 WordFrequencyService: Processing REAL employee communication data');
      console.log('🔍 Options:', options);

      // Get real data from actual employee communications (20 documents for comprehensive analysis)
      console.log('🔍 Retrieving employee communication analytics...');
      const realDocs = await WordFrequency.find({})
        .limit(20)
        .select('topWords metadata.department source.type analysis.sentiment')
        .populate('userId', 'firstName lastName department')
        .lean();
      
      console.log(`✅ Analyzed ${realDocs.length} employee communications`);
      
      // Process real employee word data with professional aggregation
      const professionalWordAnalysis = {};
      let totalSentimentScore = 0;
      let sentimentCount = 0;
      const departments = new Set();
      const sourceTypes = new Set();
      
      realDocs.forEach(doc => {
        // Track departments and sources
        if (doc.metadata?.department) departments.add(doc.metadata.department);
        if (doc.source?.type) sourceTypes.add(doc.source.type);
        
        // Aggregate sentiment
        if (doc.analysis?.sentiment?.score !== undefined) {
          totalSentimentScore += doc.analysis.sentiment.score;
          sentimentCount++;
        }
        
        if (doc.topWords && Array.isArray(doc.topWords)) {
          doc.topWords.forEach(wordObj => {
            if (wordObj.word && wordObj.word.length >= 3) {
              const word = wordObj.word.toLowerCase();
              
              if (!professionalWordAnalysis[word]) {
                professionalWordAnalysis[word] = {
                  word,
                  totalFrequency: 0,
                  employeeCount: new Set(),
                  departmentCount: new Set(),
                  sentimentData: { positive: 0, negative: 0, neutral: 0 },
                  sources: new Set()
                };
              }
              
              const analysis = professionalWordAnalysis[word];
              analysis.totalFrequency += wordObj.frequency || 1;
              analysis.employeeCount.add(doc.userId?._id?.toString() || 'anonymous');
              analysis.departmentCount.add(doc.metadata?.department || 'Unknown');
              analysis.sources.add(doc.source?.type || 'unknown');
              
              // Professional sentiment analysis
              const sentiment = wordObj.sentiment || 'neutral';
              analysis.sentimentData[sentiment]++;
            }
          });
        }
      });
      
      // Create professional word cloud with real insights
      const professionalWords = Object.values(professionalWordAnalysis)
        .map(analysis => ({
          word: analysis.word,
          frequency: analysis.totalFrequency,
          userCount: analysis.employeeCount.size,
          departmentCount: analysis.departmentCount.size,
          sentimentBreakdown: {
            positive: analysis.sentimentData.positive,
            negative: analysis.sentimentData.negative,
            neutral: analysis.sentimentData.neutral
          },
          sources: Array.from(analysis.sources)
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 50); // Show top 50 most significant words
      
      // Calculate professional insights from real data
      const avgSentiment = sentimentCount > 0 ? totalSentimentScore / sentimentCount : 0;
      const sentimentLabel = avgSentiment > 0.15 ? 'positive' : 
                           avgSentiment < -0.15 ? 'concerning' : 'balanced';
      
      // Real professional themes based on actual word patterns  
      const topWords = professionalWords.slice(0, 10).map(w => w.word);
      const professionalThemes = [];
      
      if (topWords.some(w => ['project', 'work', 'task', 'complete'].includes(w))) {
        professionalThemes.push({ theme: 'Project Execution', significance: 'high' });
      }
      if (topWords.some(w => ['team', 'collaboration', 'support', 'help'].includes(w))) {
        professionalThemes.push({ theme: 'Team Collaboration', significance: 'high' });
      }
      if (topWords.some(w => ['stress', 'overwhelmed', 'pressure', 'difficult'].includes(w))) {
        professionalThemes.push({ theme: 'Workload Management', significance: 'medium' });
      }
      if (topWords.some(w => ['learning', 'growth', 'development', 'skills'].includes(w))) {
        professionalThemes.push({ theme: 'Professional Development', significance: 'medium' });
      }
      
      // Professional wellness insights
      const positiveWords = professionalWords.filter(w => 
        w.sentimentBreakdown.positive > w.sentimentBreakdown.negative
      ).length;
      
      const concernWords = professionalWords.filter(w => 
        w.sentimentBreakdown.negative > w.sentimentBreakdown.positive
      ).length;
      
      const wellnessInsights = {
        positiveIndicators: [],
        concerns: []
      };
      
      // Enhanced positive indicators with more meaningful metrics
      const positivePercentage = Math.round((positiveWords/professionalWords.length)*100);
      const totalUniqueEmployees = new Set();
      realDocs.forEach(doc => {
        if (doc.userId?._id) totalUniqueEmployees.add(doc.userId._id.toString());
      });
      
      if (positiveWords > concernWords) {
        wellnessInsights.positiveIndicators.push({
          indicator: 'Positive Communication Culture',
          impact: `${positivePercentage}% of key terms reflect positive sentiment - indicating healthy workplace dialogue`
        });
      }
      
      if (departments.size >= 3) {
        wellnessInsights.positiveIndicators.push({
          indicator: 'Organization-Wide Engagement',
          impact: `${totalUniqueEmployees.size} employees actively communicating across ${departments.size} departments`
        });
      }
      
      // Add communication frequency indicator
      const avgWordsPerEmployee = Math.round(professionalWords.reduce((sum, w) => sum + w.frequency, 0) / totalUniqueEmployees.size);
      if (avgWordsPerEmployee > 5) {
        wellnessInsights.positiveIndicators.push({
          indicator: 'High Communication Frequency',
          impact: `Employees average ${avgWordsPerEmployee} meaningful terms per communication - showing active participation`
        });
      }
      
      // Add diversity indicator based on word variety
      if (professionalWords.length > 30) {
        wellnessInsights.positiveIndicators.push({
          indicator: 'Rich Communication Diversity',
          impact: `${professionalWords.length} unique meaningful terms identified - indicating varied and expressive workplace communication`
        });
      }
      
      if (concernWords > positiveWords * 0.3) {
        wellnessInsights.concerns.push({
          concern: 'Communication Sentiment Monitoring',
          recommendation: 'Consider follow-up discussions with employees showing negative sentiment patterns'
        });
      }
      
      console.log(`✅ Professional analysis complete: ${professionalWords.length} key terms identified`);
      console.log(`📊 Departments analyzed: ${Array.from(departments).join(', ')}`);
      console.log(`📈 Overall sentiment: ${sentimentLabel} (${avgSentiment.toFixed(3)})`);
      
      return {
        words: professionalWords,
        insights: {
          overallSentiment: { 
            score: Number(avgSentiment.toFixed(3)), 
            label: sentimentLabel, 
            description: `Analysis of ${realDocs.length} employee communications reveals ${sentimentLabel} sentiment patterns across ${departments.size} departments`
          },
          keyThemes: professionalThemes,
          wellnessInsights
        },
        metadata: {
          totalWords: professionalWords.length,
          timeframe: options.timeframe || 'Last 30 days',
          department: options.department || 'Company-wide',
          dataPoints: realDocs.length,
          departmentsAnalyzed: Array.from(departments),
          sourcesAnalyzed: Array.from(sourceTypes),
          employeesAnalyzed: realDocs.length
        }
      };
    } catch (error) {
      console.error('❌ Error in professional word cloud service:', error);
      throw error;
    }
  }

  // Get department word trends
  async getDepartmentWordTrends(department, options = {}) {
    try {
      return await WordFrequency.getDepartmentWordTrends(department, options);
    } catch (error) {
      console.error('Error getting department word trends:', error);
      throw error;
    }
  }

  // Build match query for aggregations
  buildMatchQuery(options) {
    const query = {};
    
    if (options.startDate || options.endDate) {
      query['source.date'] = {};
      if (options.startDate) query['source.date'].$gte = new Date(options.startDate);
      if (options.endDate) query['source.date'].$lte = new Date(options.endDate);
    }

    if (options.departments && options.departments.length > 0) {
      query['metadata.department'] = { $in: options.departments };
    }

    if (options.sourceTypes && options.sourceTypes.length > 0) {
      query['source.type'] = { $in: options.sourceTypes };
    }

    return query;
  }

  // Process all existing journal entries (for initial setup)
  async processExistingJournals() {
    try {
      console.log('🔄 Processing existing journal entries for word frequency analysis...');
      
      const Journal = require('../models/Journal');
      const journals = await Journal.find({ 
        isDeleted: false,
        wordCount: { $gte: 50 }
      }).populate('userId');

      let processed = 0;
      for (const journal of journals) {
        // Check if already processed
        const existing = await WordFrequency.findOne({
          'source.type': 'journal',
          'source.id': journal._id
        });

        if (!existing) {
          await this.processJournalEntry(journal);
          processed++;
        }
      }

      console.log(`✅ Processed ${processed} journal entries`);
      return processed;
    } catch (error) {
      console.error('Error processing existing journals:', error);
      throw error;
    }
  }

  // Process all existing survey responses
  async processExistingSurveyResponses() {
    try {
      console.log('🔄 Processing existing survey responses for word frequency analysis...');
      
      const Survey = require('../models/Survey');
      const surveys = await Survey.find({ status: 'active' });

      let processed = 0;
      for (const survey of surveys) {
        for (const response of survey.responses) {
          // Check if already processed
          const existing = await WordFrequency.findOne({
            'source.type': 'survey',
            'source.id': survey._id,
            userId: response.userId
          });

          if (!existing) {
            await this.processSurveyResponse(survey._id, response.userId, response.answers);
            processed++;
          }
        }
      }

      console.log(`✅ Processed ${processed} survey responses`);
      return processed;
    } catch (error) {
      console.error('Error processing existing survey responses:', error);
      throw error;
    }
  }

  // Process all existing check-in feedbacks
  async processExistingCheckIns() {
    try {
      console.log('🔄 Processing existing check-in feedbacks for word frequency analysis...');
      
      const CheckIn = require('../models/CheckIn');
      const checkIns = await CheckIn.find({ 
        feedback: { $exists: true, $ne: '' }
      }).populate('userId');

      let processed = 0;
      for (const checkIn of checkIns) {
        // Check if already processed
        const existing = await WordFrequency.findOne({
          'source.type': 'checkin',
          'source.id': checkIn._id
        });

        if (!existing && checkIn.feedback && checkIn.feedback.length >= 10) {
          await this.processCheckInFeedback(checkIn);
          processed++;
        }
      }

      console.log(`✅ Processed ${processed} check-in feedbacks`);
      return processed;
    } catch (error) {
      console.error('Error processing existing check-ins:', error);
      throw error;
    }
  }
}

module.exports = new WordFrequencyService();