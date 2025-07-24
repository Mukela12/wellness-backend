const mongoose = require('mongoose');
const { MOOD_SCALE, HAPPY_COINS } = require('../config/constants');

const checkInSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },

  // Check-in date (stored as start of day for uniqueness)
  date: {
    type: Date,
    required: [true, 'Check-in date is required'],
    index: true,
    set: function(value) {
      // Always store as start of day in UTC for consistency
      const date = new Date(value);
      date.setUTCHours(0, 0, 0, 0);
      return date;
    }
  },

  // Mood rating (1-5 scale)
  mood: {
    type: Number,
    required: [true, 'Mood rating is required'],
    min: [MOOD_SCALE.MIN, `Mood must be at least ${MOOD_SCALE.MIN}`],
    max: [MOOD_SCALE.MAX, `Mood cannot exceed ${MOOD_SCALE.MAX}`],
    validate: {
      validator: Number.isInteger,
      message: 'Mood must be a whole number'
    }
  },

  // Optional feedback text
  feedback: {
    type: String,
    trim: true,
    maxlength: [500, 'Feedback cannot exceed 500 characters']
  },

  // Source of check-in
  source: {
    type: String,
    enum: {
      values: ['web', 'whatsapp', 'mobile'],
      message: '{VALUE} is not a valid source'
    },
    default: 'web'
  },

  // Happy Coins earned for this check-in
  happyCoinsEarned: {
    type: Number,
    default: 0,
    min: [0, 'Happy coins earned cannot be negative']
  },

  // AI Analysis results
  analysis: {
    // Sentiment analysis score (-1 to 1)
    sentimentScore: {
      type: Number,
      min: -1,
      max: 1
    },
    
    // Extracted keywords from feedback
    keywords: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    
    // Emotion analysis (Google Cloud Natural Language)
    emotions: {
      joy: { type: Number, min: 0, max: 1 },
      sadness: { type: Number, min: 0, max: 1 },
      anger: { type: Number, min: 0, max: 1 },
      fear: { type: Number, min: 0, max: 1 },
      surprise: { type: Number, min: 0, max: 1 }
    },
    
    // Risk indicators detected
    riskIndicators: [{
      type: String,
      enum: [
        'low_mood_consecutive',
        'negative_sentiment',
        'stress_keywords',
        'burnout_indicators',
        'isolation_signs',
        'workload_concerns'
      ]
    }],
    
    // AI-generated personalized message
    personalizedMessage: {
      type: String,
      maxlength: 200
    }
  },

  // Processing status
  processed: {
    type: Boolean,
    default: false
  },

  // Streak information at time of check-in
  streakAtCheckIn: {
    type: Number,
    default: 0,
    min: 0
  },

  // Location data (optional, for future features)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
checkInSchema.index({ userId: 1, date: -1 });
checkInSchema.index({ date: -1, mood: 1 });
checkInSchema.index({ userId: 1, processed: 1 });
checkInSchema.index({ 'analysis.riskIndicators': 1 });

// Ensure one check-in per user per day
checkInSchema.index({ userId: 1, date: 1 }, { unique: true });

// Virtual for mood label
checkInSchema.virtual('moodLabel').get(function() {
  return MOOD_SCALE.LABELS[this.mood] || 'Unknown';
});

// Virtual for formatted date
checkInSchema.virtual('dateFormatted').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Pre-save middleware to calculate happy coins
checkInSchema.pre('save', function(next) {
  if (this.isNew) {
    // Base coins for checking in
    let coins = HAPPY_COINS.DAILY_CHECKIN;
    
    // Bonus for positive mood (4 or 5)
    if (this.mood >= 4) {
      coins += HAPPY_COINS.POSITIVE_MOOD_BONUS;
    }
    
    // Bonus for providing feedback
    if (this.feedback && this.feedback.trim().length > 0) {
      coins += 10; // Small bonus for engagement
    }
    
    this.happyCoinsEarned = coins;
  }
  next();
});

// Pre-save middleware to set streak information
checkInSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      // Get user's current streak
      const User = mongoose.model('User');
      const user = await User.findById(this.userId);
      
      if (user) {
        this.streakAtCheckIn = user.wellness.currentStreak + 1; // Will be the new streak
      }
    } catch (error) {
      console.error('Error setting streak in check-in:', error);
    }
  }
  next();
});

// Post-save middleware to update user's wellness data
checkInSchema.post('save', async function(doc) {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(doc.userId);
    
    if (!user) return;

    // Update happy coins
    user.wellness.happyCoins += doc.happyCoinsEarned;
    
    // Update last check-in date
    user.wellness.lastCheckIn = new Date();
    
    // Calculate and update average mood
    const recentCheckIns = await this.constructor.find({
      userId: doc.userId,
      date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    }).sort({ date: -1 }).limit(30);
    
    if (recentCheckIns.length > 0) {
      const totalMood = recentCheckIns.reduce((sum, checkIn) => sum + checkIn.mood, 0);
      user.wellness.averageMood = Math.round((totalMood / recentCheckIns.length) * 10) / 10;
    }

    // Update streak (this is handled in User model pre-save)
    await user.save();
    
  } catch (error) {
    console.error('Error updating user wellness data:', error);
  }
});

// Static Methods
checkInSchema.statics.findByUser = function(userId, options = {}) {
  const {
    startDate,
    endDate,
    limit = 30,
    sort = { date: -1 }
  } = options;

  let query = this.find({ userId });
  
  if (startDate || endDate) {
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    query = query.where('date', dateFilter);
  }
  
  return query.sort(sort).limit(limit);
};

checkInSchema.statics.findTodaysCheckIn = function(userId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  return this.findOne({
    userId,
    date: today
  });
};

checkInSchema.statics.getUserMoodTrend = async function(userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setUTCHours(0, 0, 0, 0);
  
  return this.find({
    userId,
    date: { $gte: startDate }
  }).sort({ date: 1 }).select('date mood');
};

checkInSchema.statics.getAnalytics = async function(filter = {}) {
  try {
    // Get basic stats
    const basicStats = await this.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCheckIns: { $sum: 1 },
          averageMood: { $avg: '$mood' },
          totalHappyCoins: { $sum: '$happyCoinsEarned' },
          moods: { $push: '$mood' }
        }
      }
    ]);

    if (!basicStats || basicStats.length === 0) {
      return {
        totalCheckIns: 0,
        averageMood: 0,
        totalHappyCoins: 0,
        moodDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
      };
    }

    const stats = basicStats[0];
    
    // Calculate mood distribution manually
    const moodDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    if (stats.moods) {
      stats.moods.forEach(mood => {
        moodDistribution[mood.toString()] = (moodDistribution[mood.toString()] || 0) + 1;
      });
    }

    return {
      totalCheckIns: stats.totalCheckIns || 0,
      averageMood: Math.round((stats.averageMood || 0) * 100) / 100,
      totalHappyCoins: stats.totalHappyCoins || 0,
      moodDistribution
    };
  } catch (error) {
    console.error('Analytics aggregation error:', error);
    return {
      totalCheckIns: 0,
      averageMood: 0,
      totalHappyCoins: 0,
      moodDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    };
  }
};

// Instance Methods
checkInSchema.methods.isPositive = function() {
  return this.mood >= 4;
};

checkInSchema.methods.requiresAttention = function() {
  return this.mood <= 2 || 
         (this.analysis && this.analysis.riskIndicators && this.analysis.riskIndicators.length > 0);
};

module.exports = mongoose.model('CheckIn', checkInSchema);