const mongoose = require('mongoose');
const dotenv = require('dotenv');
// Load all models first
const User = require('./src/models/User');
const Journal = require('./src/models/Journal');
const Survey = require('./src/models/Survey');
const CheckIn = require('./src/models/CheckIn');
const WordFrequency = require('./src/models/WordFrequency');

dotenv.config();

// Simple stop words
const stopWords = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'up', 'of', 'in', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'with', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves'
]);

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wellness-backend');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Simple word extraction
const extractWords = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length >= 3 && 
      !stopWords.has(word) &&
      !/^\d+$/.test(word)
    );
};

// Simple word frequency analysis
const analyzeWords = (words) => {
  const wordCounts = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });

  return Object.entries(wordCounts)
    .map(([word, count]) => ({
      word,
      count,
      weight: Math.min(1, count / 10),
      sentiment: getSimpleSentiment(word)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
};

// Simple sentiment analysis
const getSimpleSentiment = (word) => {
  const positiveWords = ['happy', 'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome', 'love', 'enjoy', 'excited', 'motivated', 'grateful', 'thankful', 'success', 'achievement', 'progress', 'collaboration', 'teamwork', 'support', 'creative', 'innovation', 'growth', 'learning', 'opportunity'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'angry', 'frustrated', 'stressed', 'anxious', 'worried', 'sad', 'disappointed', 'overwhelmed', 'difficult', 'hard', 'struggle', 'problem', 'issue', 'concern', 'pressure', 'burnout', 'exhausted'];
  
  if (positiveWords.includes(word)) return 'positive';
  if (negativeWords.includes(word)) return 'negative';
  return 'neutral';
};

const processJournals = async () => {
  console.log('🔄 Processing journal entries...');
  
  try {
    const journals = await Journal.find({ 
      isDeleted: false,
      wordCount: { $gte: 20 }
    }).populate('userId');

    let processed = 0;
    for (const journal of journals) {
      // Check if already processed
      const existing = await WordFrequency.findOne({
        'source.type': 'journal',
        'source.id': journal._id
      });

      if (!existing && journal.userId) {
        const text = `${journal.title} ${journal.content}`;
        const words = extractWords(text);
        const wordAnalysis = analyzeWords(words);
        
        const topWords = wordAnalysis.slice(0, 5).map(w => ({
          word: w.word,
          frequency: w.count,
          sentiment: w.sentiment
        }));

        const wordFreq = new WordFrequency({
          userId: journal.userId._id,
          source: {
            type: 'journal',
            id: journal._id,
            date: journal.createdAt
          },
          words: wordAnalysis,
          topWords,
          analysis: {
            sentiment: {
              score: wordAnalysis.reduce((sum, w) => {
                if (w.sentiment === 'positive') return sum + 0.1;
                if (w.sentiment === 'negative') return sum - 0.1;
                return sum;
              }, 0),
              label: 'neutral'
            }
          },
          metadata: {
            totalWords: words.length,
            uniqueWords: wordAnalysis.length,
            department: journal.userId.department,
            mood: journal.mood,
            riskLevel: journal.userId.wellness?.riskLevel || 'low'
          },
          processed: true,
          processedAt: new Date()
        });

        await wordFreq.save();
        processed++;
      }
    }

    console.log(`✅ Processed ${processed} journal entries`);
    return processed;
  } catch (error) {
    console.error('Error processing journals:', error);
    throw error;
  }
};

const processSurveys = async () => {
  console.log('🔄 Processing survey responses...');
  
  try {
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
          const user = await User.findById(response.userId);
          if (!user) continue;

          // Extract text answers
          const textAnswers = [];
          if (response.answers) {
            for (const [questionId, answer] of response.answers) {
              if (typeof answer === 'string' && answer.trim().length > 10) {
                textAnswers.push(answer);
              }
            }
          }

          if (textAnswers.length > 0) {
            const text = textAnswers.join(' ');
            const words = extractWords(text);
            const wordAnalysis = analyzeWords(words);
            
            const topWords = wordAnalysis.slice(0, 5).map(w => ({
              word: w.word,
              frequency: w.count,
              sentiment: w.sentiment
            }));

            const wordFreq = new WordFrequency({
              userId: response.userId,
              source: {
                type: 'survey',
                id: survey._id,
                date: response.completedAt || new Date()
              },
              words: wordAnalysis,
              topWords,
              analysis: {
                sentiment: {
                  score: wordAnalysis.reduce((sum, w) => {
                    if (w.sentiment === 'positive') return sum + 0.1;
                    if (w.sentiment === 'negative') return sum - 0.1;
                    return sum;
                  }, 0),
                  label: 'neutral'
                }
              },
              metadata: {
                totalWords: words.length,
                uniqueWords: wordAnalysis.length,
                department: user.department,
                mood: user.wellness?.averageMood,
                riskLevel: user.wellness?.riskLevel || 'low'
              },
              processed: true,
              processedAt: new Date()
            });

            await wordFreq.save();
            processed++;
          }
        }
      }
    }

    console.log(`✅ Processed ${processed} survey responses`);
    return processed;
  } catch (error) {
    console.error('Error processing surveys:', error);
    throw error;
  }
};

const processCheckIns = async () => {
  console.log('🔄 Processing check-in feedback...');
  
  try {
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

      if (!existing && checkIn.feedback && checkIn.feedback.length >= 10 && checkIn.userId) {
        const words = extractWords(checkIn.feedback);
        const wordAnalysis = analyzeWords(words);
        
        const topWords = wordAnalysis.slice(0, 5).map(w => ({
          word: w.word,
          frequency: w.count,
          sentiment: w.sentiment
        }));

        const wordFreq = new WordFrequency({
          userId: checkIn.userId._id,
          source: {
            type: 'checkin',
            id: checkIn._id,
            date: checkIn.createdAt
          },
          words: wordAnalysis,
          topWords,
          analysis: {
            sentiment: {
              score: wordAnalysis.reduce((sum, w) => {
                if (w.sentiment === 'positive') return sum + 0.1;
                if (w.sentiment === 'negative') return sum - 0.1;
                return sum;
              }, 0),
              label: 'neutral'
            }
          },
          metadata: {
            totalWords: words.length,
            uniqueWords: wordAnalysis.length,
            department: checkIn.userId.department,
            mood: checkIn.mood,
            riskLevel: checkIn.userId.wellness?.riskLevel || 'low'
          },
          processed: true,
          processedAt: new Date()
        });

        await wordFreq.save();
        processed++;
      }
    }

    console.log(`✅ Processed ${processed} check-in feedbacks`);
    return processed;
  } catch (error) {
    console.error('Error processing check-ins:', error);
    throw error;
  }
};

const main = async () => {
  console.log('🚀 Starting simple word frequency analysis...\n');
  
  await connectDB();
  
  try {
    const journalsProcessed = await processJournals();
    const surveysProcessed = await processSurveys();
    const checkinsProcessed = await processCheckIns();
    
    console.log('\n🎉 Word frequency processing complete!');
    console.log('\n📊 Summary:');
    console.log(`📖 Journal entries processed: ${journalsProcessed}`);
    console.log(`📋 Survey responses processed: ${surveysProcessed}`);
    console.log(`✅ Check-in feedbacks processed: ${checkinsProcessed}`);
    console.log(`🔢 Total entries processed: ${journalsProcessed + surveysProcessed + checkinsProcessed}`);
    
  } catch (error) {
    console.error('❌ Error in word frequency processing:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };