const mongoose = require('mongoose');

const dailyQuoteSchema = new mongoose.Schema({
  // Date for which this quote is generated (one quote per user per day)
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    index: true
  },

  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Quote content
  quote: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },

  author: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  // Categorization
  category: {
    type: String,
    enum: ['motivation', 'resilience', 'growth', 'wellness', 'mindfulness', 'strength', 'inspiration'],
    default: 'motivation'
  },

  // Personalization context
  personalization: {
    moodMatch: String, // Explanation of how it matches their mood
    relevance: String, // Why this quote is relevant to their situation
    intention: String, // What this quote is meant to achieve
    basedOnMood: {
      type: Number,
      min: 1,
      max: 5
    },
    basedOnRisk: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    recentThemes: [String] // Themes from recent check-ins or journals
  },

  // Action suggestion
  actionPrompt: {
    type: String,
    trim: true,
    maxlength: 200
  },

  // Tags for categorization and search
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  // Engagement metrics
  engagement: {
    viewed: {
      type: Boolean,
      default: false
    },
    viewedAt: Date,
    liked: {
      type: Boolean,
      default: false
    },
    likedAt: Date,
    shared: {
      type: Boolean,
      default: false
    },
    sharedAt: Date,
    timeSpentViewing: {
      type: Number, // in seconds
      default: 0
    }
  },

  // AI generation metadata
  aiGeneration: {
    model: String,
    prompt: String,
    temperature: Number,
    usage: {
      promptTokens: Number,
      completionTokens: Number,
      totalTokens: Number
    },
    generatedAt: {
      type: Date,
      default: Date.now
    },
    previousQuotesConsidered: [{
      quote: String,
      author: String,
      date: String
    }]
  },

  // Status and delivery
  status: {
    type: String,
    enum: ['generated', 'delivered', 'viewed', 'archived'],
    default: 'generated'
  },

  deliveredAt: Date,

  // Feedback and rating
  userFeedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    helpful: Boolean,
    comment: String,
    submittedAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for unique quote per user per day
dailyQuoteSchema.index({ userId: 1, date: 1 }, { unique: true });

// Index for efficient querying
dailyQuoteSchema.index({ date: -1, status: 1 });
dailyQuoteSchema.index({ userId: 1, createdAt: -1 });
dailyQuoteSchema.index({ category: 1, tags: 1 });
dailyQuoteSchema.index({ 'personalization.basedOnMood': 1, 'personalization.basedOnRisk': 1 });

// Virtual for formatted date
dailyQuoteSchema.virtual('formattedDate').get(function() {
  const dateObj = new Date(this.date + 'T00:00:00.000Z');
  return dateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
});

// Virtual for quote length
dailyQuoteSchema.virtual('quoteLength').get(function() {
  return this.quote.length;
});

// Virtual for engagement score
dailyQuoteSchema.virtual('engagementScore').get(function() {
  let score = 0;
  if (this.engagement.viewed) score += 1;
  if (this.engagement.liked) score += 2;
  if (this.engagement.shared) score += 3;
  if (this.userFeedback.rating >= 4) score += 2;
  return score;
});

// Pre-save middleware
dailyQuoteSchema.pre('save', function(next) {
  // Ensure date is in YYYY-MM-DD format
  if (this.isModified('date')) {
    const dateStr = new Date(this.date).toISOString().split('T')[0];
    this.date = dateStr;
  }

  // Update status based on engagement
  if (this.engagement.viewed && this.status === 'delivered') {
    this.status = 'viewed';
  }

  next();
});

// Static method to get today's quote for a user
dailyQuoteSchema.statics.getTodayQuote = function(userId) {
  const today = new Date().toISOString().split('T')[0];
  return this.findOne({ userId, date: today });
};

// Static method to get quote history for a user
dailyQuoteSchema.statics.getQuoteHistory = function(userId, days = 7) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  
  return this.find({
    userId,
    date: {
      $gte: startDate.toISOString().split('T')[0],
      $lte: endDate.toISOString().split('T')[0]
    }
  }).sort({ date: -1 });
};

// Static method to get recent quotes for AI context (to avoid repetition)
dailyQuoteSchema.statics.getRecentQuotesForContext = function(userId, days = 14) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  
  return this.find({
    userId,
    date: {
      $gte: startDate.toISOString().split('T')[0],
      $lte: endDate.toISOString().split('T')[0]
    }
  })
  .select('quote author category tags date')
  .sort({ date: -1 })
  .limit(7); // Last 7 quotes for context
};

// Static method to get engagement statistics
dailyQuoteSchema.statics.getEngagementStats = function(userId, days = 30) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: {
          $gte: startDate.toISOString().split('T')[0],
          $lte: endDate.toISOString().split('T')[0]
        }
      }
    },
    {
      $group: {
        _id: null,
        totalQuotes: { $sum: 1 },
        viewedQuotes: { $sum: { $cond: ['$engagement.viewed', 1, 0] } },
        likedQuotes: { $sum: { $cond: ['$engagement.liked', 1, 0] } },
        sharedQuotes: { $sum: { $cond: ['$engagement.shared', 1, 0] } },
        avgRating: { $avg: '$userFeedback.rating' },
        totalTimeSpent: { $sum: '$engagement.timeSpentViewing' },
        categories: { $push: '$category' },
        mostUsedTags: { $push: '$tags' }
      }
    },
    {
      $project: {
        _id: 0,
        totalQuotes: 1,
        viewedQuotes: 1,
        likedQuotes: 1,
        sharedQuotes: 1,
        viewRate: { 
          $cond: [
            { $gt: ['$totalQuotes', 0] },
            { $multiply: [{ $divide: ['$viewedQuotes', '$totalQuotes'] }, 100] },
            0
          ]
        },
        likeRate: {
          $cond: [
            { $gt: ['$viewedQuotes', 0] },
            { $multiply: [{ $divide: ['$likedQuotes', '$viewedQuotes'] }, 100] },
            0
          ]
        },
        avgRating: { $round: ['$avgRating', 2] },
        avgTimePerQuote: {
          $cond: [
            { $gt: ['$viewedQuotes', 0] },
            { $divide: ['$totalTimeSpent', '$viewedQuotes'] },
            0
          ]
        },
        categoryDistribution: '$categories',
        tags: '$mostUsedTags'
      }
    }
  ]);
};

// Instance method to mark as viewed
dailyQuoteSchema.methods.markAsViewed = function(timeSpent = 0) {
  this.engagement.viewed = true;
  this.engagement.viewedAt = new Date();
  this.engagement.timeSpentViewing += timeSpent;
  this.status = 'viewed';
  return this.save();
};

// Instance method to toggle like
dailyQuoteSchema.methods.toggleLike = function() {
  this.engagement.liked = !this.engagement.liked;
  if (this.engagement.liked) {
    this.engagement.likedAt = new Date();
  }
  return this.save();
};

// Instance method to mark as shared
dailyQuoteSchema.methods.markAsShared = function() {
  this.engagement.shared = true;
  this.engagement.sharedAt = new Date();
  return this.save();
};

// Instance method to add user feedback
dailyQuoteSchema.methods.addFeedback = function(rating, helpful, comment) {
  this.userFeedback = {
    rating,
    helpful,
    comment: comment || '',
    submittedAt: new Date()
  };
  return this.save();
};

module.exports = mongoose.model('DailyQuote', dailyQuoteSchema);