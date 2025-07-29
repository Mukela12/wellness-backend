const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Journal entry content
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10000
  },
  
  // Current mood when writing (1-5 scale)
  mood: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  
  // AI prompt that inspired this journal entry
  aiPrompt: {
    promptText: {
      type: String,
      trim: true
    },
    promptType: {
      type: String,
      enum: ['reflection', 'gratitude', 'goal-setting', 'stress-relief', 'mindfulness', 'creativity', 'growth', 'challenge'],
      default: 'reflection'
    },
    generatedAt: {
      type: Date
    },
    basedOnMood: {
      type: Number,
      min: 1,
      max: 5
    },
    basedOnRisk: {
      type: String,
      enum: ['low', 'medium', 'high']
    }
  },
  
  // Privacy and sharing settings
  privacy: {
    type: String,
    enum: ['private', 'anonymous_share', 'team_share'],
    default: 'private'
  },
  
  // Categorization and organization
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  category: {
    type: String,
    enum: ['personal', 'work', 'wellness', 'goals', 'gratitude', 'challenges', 'reflection'],
    default: 'personal'
  },
  
  // Metadata
  wordCount: {
    type: Number,
    default: 0
  },
  
  readingTime: {
    type: Number, // in minutes
    default: 1
  },
  
  // Engagement and analytics
  analytics: {
    timeSpent: {
      type: Number, // in seconds
      default: 0
    },
    editCount: {
      type: Number,
      default: 0
    },
    lastViewedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // AI insights and analysis
  aiInsights: {
    sentimentScore: {
      type: Number,
      min: -1,
      max: 1
    },
    emotions: [{
      emotion: String,
      confidence: Number
    }],
    keyThemes: [String],
    recommendations: [String],
    analyzed: {
      type: Boolean,
      default: false
    },
    analyzedAt: Date
  },
  
  // Status and workflow
  status: {
    type: String,
    enum: ['draft', 'completed', 'archived'],
    default: 'completed'
  },
  
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
journalSchema.index({ userId: 1, createdAt: -1 });
journalSchema.index({ userId: 1, mood: 1 });
journalSchema.index({ userId: 1, category: 1, createdAt: -1 });
journalSchema.index({ userId: 1, tags: 1 });
journalSchema.index({ userId: 1, 'aiPrompt.promptType': 1 });
journalSchema.index({ createdAt: -1 }, { partialFilterExpression: { privacy: { $ne: 'private' } } });

// Virtual for formatted date
journalSchema.virtual('dateFormatted').get(function() {
  return this.createdAt.toISOString().split('T')[0];
});

// Virtual for reading time estimation
journalSchema.virtual('estimatedReadingTime').get(function() {
  return Math.max(1, Math.ceil(this.wordCount / 200)); // 200 words per minute
});

// Virtual for mood label
journalSchema.virtual('moodLabel').get(function() {
  const moodLabels = {
    1: 'Very Low',
    2: 'Low', 
    3: 'Neutral',
    4: 'Good',
    5: 'Excellent'
  };
  return moodLabels[this.mood] || 'Unknown';
});

// Pre-save middleware to calculate word count and reading time
journalSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Calculate word count
    this.wordCount = this.content.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    // Calculate reading time (200 words per minute)
    this.readingTime = Math.max(1, Math.ceil(this.wordCount / 200));
    
    // Increment edit count if content changed and not new document
    if (!this.isNew) {
      this.analytics.editCount += 1;
    }
  }
  next();
});

// Static method to get user's journal statistics
journalSchema.statics.getUserStats = function(userId, startDate = null, endDate = null) {
  const matchQuery = { 
    userId: new mongoose.Types.ObjectId(userId),
    isDeleted: false 
  };
  
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        totalWords: { $sum: '$wordCount' },
        averageMood: { $avg: '$mood' },
        averageWordCount: { $avg: '$wordCount' },
        totalReadingTime: { $sum: '$readingTime' },
        moodDistribution: {
          $push: '$mood'
        },
        categoriesUsed: {
          $addToSet: '$category'
        },
        tagsUsed: {
          $push: '$tags'
        },
        promptTypesUsed: {
          $addToSet: '$aiPrompt.promptType'
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalEntries: 1,
        totalWords: 1,
        averageMood: { $round: ['$averageMood', 2] },
        averageWordCount: { $round: ['$averageWordCount', 0] },
        totalReadingTime: 1,
        categoriesUsed: 1,
        promptTypesUsed: 1,
        moodCounts: {
          $arrayToObject: {
            $map: {
              input: [1, 2, 3, 4, 5],
              as: 'mood',
              in: {
                k: { $toString: '$$mood' },
                v: {
                  $size: {
                    $filter: {
                      input: '$moodDistribution',
                      cond: { $eq: ['$$this', '$$mood'] }
                    }
                  }
                }
              }
            }
          }
        },
        uniqueTags: {
          $size: {
            $setUnion: {
              $reduce: {
                input: '$tagsUsed',
                initialValue: [],
                in: { $setUnion: ['$$value', '$$this'] }
              }
            }
          }
        }
      }
    }
  ]);
};

// Static method to find entries by mood range
journalSchema.statics.findByMoodRange = function(userId, minMood, maxMood, limit = 10) {
  return this.find({
    userId,
    mood: { $gte: minMood, $lte: maxMood },
    isDeleted: false
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .select('title mood createdAt category tags');
};

// Static method to get recent entries for AI analysis
journalSchema.statics.getRecentForAnalysis = function(userId, days = 7, limit = 5) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({
    userId,
    createdAt: { $gte: cutoffDate },
    isDeleted: false,
    wordCount: { $gte: 50 } // Only entries with substantial content
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .select('content mood category aiPrompt.promptType createdAt aiInsights');
};

// Static method for journaling streak calculation
journalSchema.statics.calculateJournalingStreak = function(userId) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt'
          }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: -1 }
    },
    {
      $group: {
        _id: null,
        dates: { $push: '$_id' }
      }
    }
  ]);
};

// Instance method to check if entry can be edited
journalSchema.methods.canEdit = function() {
  const hoursSinceCreation = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceCreation <= 24; // Can edit within 24 hours
};

// Instance method to generate summary
journalSchema.methods.getSummary = function(maxLength = 150) {
  if (!this.content || typeof this.content !== 'string') {
    return 'No content available';
  }
  
  if (this.content.length <= maxLength) {
    return this.content;
  }
  
  const truncated = this.content.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return lastSpace > 0 
    ? truncated.substring(0, lastSpace) + '...'
    : truncated + '...';
};

// Instance method to add tags
journalSchema.methods.addTags = function(newTags) {
  const existingTags = new Set(this.tags);
  newTags.forEach(tag => {
    if (tag && tag.trim()) {
      existingTags.add(tag.trim().toLowerCase());
    }
  });
  this.tags = Array.from(existingTags);
  return this.save();
};

module.exports = mongoose.model('Journal', journalSchema);