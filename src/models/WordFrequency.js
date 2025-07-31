const mongoose = require('mongoose');

const wordFrequencySchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Source information
  source: {
    type: {
      type: String,
      enum: ['journal', 'survey', 'checkin'],
      required: true
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    date: {
      type: Date,
      required: true
    }
  },
  
  // Word frequency data
  words: [{
    word: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    count: {
      type: Number,
      default: 1,
      min: 1
    },
    weight: {
      type: Number,
      default: 1,
      min: 0,
      max: 1
    }
  }],
  
  // Top words for quick access
  topWords: [{
    word: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    frequency: {
      type: Number,
      required: true
    },
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      default: 'neutral'
    }
  }],
  
  // AI Analysis
  analysis: {
    sentiment: {
      score: {
        type: Number,
        min: -1,
        max: 1
      },
      label: {
        type: String,
        enum: ['very_negative', 'negative', 'neutral', 'positive', 'very_positive']
      }
    },
    themes: [{
      theme: String,
      confidence: {
        type: Number,
        min: 0,
        max: 1
      }
    }],
    emotions: [{
      emotion: String,
      intensity: {
        type: Number,
        min: 0,
        max: 1
      }
    }],
    concerns: [String],
    strengths: [String]
  },
  
  // Metadata
  metadata: {
    totalWords: {
      type: Number,
      default: 0
    },
    uniqueWords: {
      type: Number,
      default: 0
    },
    department: String,
    mood: Number,
    riskLevel: String
  },
  
  // Processing status
  processed: {
    type: Boolean,
    default: false
  },
  processedAt: Date
  
}, {
  timestamps: true
});

// Indexes for performance
wordFrequencySchema.index({ userId: 1, createdAt: -1 });
wordFrequencySchema.index({ 'source.type': 1, 'source.date': -1 });
wordFrequencySchema.index({ userId: 1, 'source.type': 1, createdAt: -1 });
wordFrequencySchema.index({ 'metadata.department': 1, createdAt: -1 });
wordFrequencySchema.index({ 'analysis.sentiment.score': 1 });
wordFrequencySchema.index({ 'topWords.word': 1 });

// Static method to get aggregated word frequencies for a user
wordFrequencySchema.statics.getUserWordCloud = async function(userId, options = {}) {
  const {
    startDate,
    endDate,
    sourceTypes = ['journal', 'survey', 'checkin'],
    limit = 50
  } = options;
  
  const matchQuery = {
    userId: new mongoose.Types.ObjectId(userId),
    'source.type': { $in: sourceTypes }
  };
  
  if (startDate || endDate) {
    matchQuery['source.date'] = {};
    if (startDate) matchQuery['source.date'].$gte = new Date(startDate);
    if (endDate) matchQuery['source.date'].$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchQuery },
    { $unwind: '$words' },
    {
      $group: {
        _id: '$words.word',
        totalCount: { $sum: '$words.count' },
        avgWeight: { $avg: '$words.weight' },
        occurrences: { $sum: 1 }
      }
    },
    {
      $project: {
        word: '$_id',
        count: '$totalCount',
        weight: { $multiply: ['$avgWeight', { $log10: { $add: ['$totalCount', 1] } }] },
        occurrences: 1
      }
    },
    { $sort: { weight: -1 } },
    { $limit: limit }
  ]);
};

// Static method to get company-wide word frequencies (simplified for performance)
wordFrequencySchema.statics.getCompanyWordCloud = async function(options = {}) {
  console.log('🔍 WordFrequency Model: Starting getCompanyWordCloud aggregation');
  console.log('🔍 Aggregation options:', options);
  const {
    startDate,
    endDate,
    departments = [],
    sourceTypes = ['journal', 'survey', 'checkin'],
    limit = 100,
    minOccurrences = 5
  } = options;
  
  const matchQuery = {
    'source.type': { $in: sourceTypes }
  };
  
  if (departments.length > 0) {
    matchQuery['metadata.department'] = { $in: departments };
  }
  
  if (startDate || endDate) {
    matchQuery['source.date'] = {};
    if (startDate) matchQuery['source.date'].$gte = new Date(startDate);
    if (endDate) matchQuery['source.date'].$lte = new Date(endDate);
  }
  
  console.log('🔍 Match query:', JSON.stringify(matchQuery));
  console.log('🔍 Starting aggregation pipeline...');
  
  // Simplified aggregation for better performance
  const result = await this.aggregate([
    { $match: matchQuery },
    { $unwind: '$topWords' },
    {
      $group: {
        _id: '$topWords.word',
        totalFrequency: { $sum: '$topWords.frequency' },
        userCount: { $addToSet: '$userId' },
        sentiments: { $push: '$topWords.sentiment' }
      }
    },
    {
      $project: {
        word: '$_id',
        frequency: '$totalFrequency',
        userCount: { $size: '$userCount' },
        sentimentBreakdown: {
          positive: {
            $size: {
              $filter: {
                input: '$sentiments',
                cond: { $eq: ['$$this', 'positive'] }
              }
            }
          },
          negative: {
            $size: {
              $filter: {
                input: '$sentiments',
                cond: { $eq: ['$$this', 'negative'] }
              }
            }
          },
          neutral: {
            $size: {
              $filter: {
                input: '$sentiments',
                cond: { $eq: ['$$this', 'neutral'] }
              }
            }
          }
        }
      }
    },
    { $match: { frequency: { $gte: minOccurrences } } },
    { $sort: { frequency: -1 } },
    { $limit: limit }
  ]);
  
  console.log(`✅ Aggregation completed, returning ${result.length} words`);
  return result;
};

// Static method to get department word trends
wordFrequencySchema.statics.getDepartmentWordTrends = async function(department, options = {}) {
  const {
    startDate,
    endDate,
    limit = 20
  } = options;
  
  const matchQuery = {
    'metadata.department': department
  };
  
  if (startDate || endDate) {
    matchQuery['source.date'] = {};
    if (startDate) matchQuery['source.date'].$gte = new Date(startDate);
    if (endDate) matchQuery['source.date'].$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchQuery },
    { $unwind: '$topWords' },
    {
      $group: {
        _id: {
          word: '$topWords.word',
          week: {
            $dateToString: {
              format: '%Y-%U',
              date: '$source.date'
            }
          }
        },
        frequency: { $sum: '$topWords.frequency' },
        sentiment: { $first: '$topWords.sentiment' }
      }
    },
    {
      $group: {
        _id: '$_id.word',
        trend: {
          $push: {
            week: '$_id.week',
            frequency: '$frequency',
            sentiment: '$sentiment'
          }
        },
        totalFrequency: { $sum: '$frequency' }
      }
    },
    { $sort: { totalFrequency: -1 } },
    { $limit: limit },
    {
      $project: {
        word: '$_id',
        trend: { $sortArray: { input: '$trend', sortBy: { week: 1 } } },
        totalFrequency: 1
      }
    }
  ]);
};

// Instance method to extract top words
wordFrequencySchema.methods.extractTopWords = function(limit = 5) {
  if (!this.words || this.words.length === 0) return [];
  
  // Sort by count * weight and get top N
  const sorted = this.words
    .sort((a, b) => (b.count * b.weight) - (a.count * a.weight))
    .slice(0, limit);
  
  return sorted.map(w => ({
    word: w.word,
    frequency: w.count,
    sentiment: 'neutral' // Will be updated by AI analysis
  }));
};

module.exports = mongoose.model('WordFrequency', wordFrequencySchema);