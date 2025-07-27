const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['wellness', 'food', 'entertainment', 'fitness', 'education', 'merchandise', 'experience', 'donation'],
    required: true
  },
  type: {
    type: String,
    enum: ['physical', 'digital', 'service', 'discount', 'voucher'],
    required: true
  },
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  value: {
    type: Number, // Actual monetary value
    required: true
  },
  merchant: {
    name: String,
    logo: String,
    website: String
  },
  availability: {
    quantity: {
      type: Number,
      default: -1 // -1 means unlimited
    },
    startDate: Date,
    endDate: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  redemptionDetails: {
    instructions: String,
    code: String, // For digital rewards
    expiryDays: {
      type: Number,
      default: 30 // Days after redemption
    },
    termsAndConditions: [String]
  },
  images: [String],
  tags: [String],
  analytics: {
    totalRedemptions: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    viewCount: {
      type: Number,
      default: 0
    }
  },
  featured: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
rewardSchema.index({ category: 1, 'availability.isActive': 1 });
rewardSchema.index({ cost: 1 });
rewardSchema.index({ featured: -1, sortOrder: 1 });
rewardSchema.index({ tags: 1 });

// Virtual for checking if reward is available
rewardSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  return this.availability.isActive &&
         (this.availability.quantity === -1 || this.availability.quantity > 0) &&
         (!this.availability.startDate || this.availability.startDate <= now) &&
         (!this.availability.endDate || this.availability.endDate >= now);
});

// Method to check if user can afford
rewardSchema.methods.canUserAfford = function(userHappyCoins) {
  return userHappyCoins >= this.cost;
};

// Static method to get featured rewards
rewardSchema.statics.getFeaturedRewards = function(limit = 6) {
  return this.find({
    featured: true,
    'availability.isActive': true
  })
  .sort({ sortOrder: 1 })
  .limit(limit);
};

// Static method to get rewards by category
rewardSchema.statics.getByCategory = function(category, options = {}) {
  const { page = 1, limit = 20, sortBy = 'sortOrder' } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    category,
    'availability.isActive': true
  })
  .sort({ [sortBy]: 1 })
  .skip(skip)
  .limit(limit);
};

// =====================
// Redemption Schema
// =====================
const redemptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rewardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reward',
    required: true
  },
  reward: {
    name: String,
    category: String,
    cost: Number,
    value: Number
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'fulfilled', 'expired', 'cancelled'],
    default: 'pending'
  },
  happyCoinsSpent: {
    type: Number,
    required: true
  },
  redemptionCode: {
    type: String,
    unique: true,
    sparse: true
  },
  voucherDetails: {
    code: String,
    expiryDate: Date,
    instructions: String
  },
  fulfillment: {
    method: {
      type: String,
      enum: ['email', 'pickup', 'delivery', 'digital'],
      required: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    email: String,
    phone: String,
    notes: String
  },
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: Date
  },
  timeline: {
    requestedAt: {
      type: Date,
      default: Date.now
    },
    approvedAt: Date,
    fulfilledAt: Date,
    expiredAt: Date,
    cancelledAt: Date
  },
  adminNotes: String
}, {
  timestamps: true
});

// Indexes
redemptionSchema.index({ userId: 1, status: 1 });
redemptionSchema.index({ rewardId: 1 });
redemptionSchema.index({ redemptionCode: 1 });
redemptionSchema.index({ 'timeline.requestedAt': -1 });

// Generate unique redemption code
redemptionSchema.methods.generateRedemptionCode = function() {
  const prefix = 'WA';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  this.redemptionCode = `${prefix}-${timestamp}-${random}`;
  return this.redemptionCode;
};

// Calculate expiry date
redemptionSchema.methods.calculateExpiryDate = function(expiryDays) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  return expiryDate;
};

// =====================
// Achievement Badge Schema
// =====================
const achievementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['streak', 'checkin', 'mood', 'engagement', 'milestone', 'special'],
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  criteria: {
    type: {
      type: String,
      enum: ['streak_days', 'total_checkins', 'consecutive_good_mood', 'survey_completion', 'peer_recognition', 'custom'],
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    description: String
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  happyCoinsReward: {
    type: Number,
    default: 0
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// User Achievement Schema (tracking earned badges)
const userAchievementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  achievementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true
  },
  achievement: {
    name: String,
    description: String,
    icon: String,
    category: String,
    rarity: String
  },
  earnedAt: {
    type: Date,
    default: Date.now
  },
  progress: {
    current: Number,
    target: Number,
    percentage: Number
  },
  happyCoinsEarned: Number
});

// Compound index to ensure unique achievements per user
userAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
userAchievementSchema.index({ userId: 1, earnedAt: -1 });

// =====================
// Peer Recognition Schema
// =====================
const recognitionSchema = new mongoose.Schema({
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['kudos', 'thank_you', 'great_job', 'team_player', 'innovation', 'leadership'],
    required: true
  },
  message: {
    type: String,
    required: true,
    maxLength: 500
  },
  category: {
    type: String,
    enum: ['collaboration', 'innovation', 'leadership', 'support', 'achievement', 'other'],
    default: 'other'
  },
  value: {
    happyCoins: {
      type: Number,
      default: 25 // Coins awarded to recipient
    },
    points: {
      type: Number,
      default: 1 // Recognition points for leaderboard
    }
  },
  visibility: {
    type: String,
    enum: ['public', 'team', 'private'],
    default: 'team'
  },
  isAnonymous: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
recognitionSchema.index({ toUserId: 1, createdAt: -1 });
recognitionSchema.index({ fromUserId: 1, createdAt: -1 });
recognitionSchema.index({ visibility: 1, createdAt: -1 });

// Prevent self-recognition
recognitionSchema.pre('save', function(next) {
  if (this.fromUserId.toString() === this.toUserId.toString()) {
    next(new Error('Cannot recognize yourself'));
  }
  next();
});

// Export models
const Reward = mongoose.model('Reward', rewardSchema);
const Redemption = mongoose.model('Redemption', redemptionSchema);
const Achievement = mongoose.model('Achievement', achievementSchema);
const UserAchievement = mongoose.model('UserAchievement', userAchievementSchema);
const Recognition = mongoose.model('Recognition', recognitionSchema);

module.exports = {
  Reward,
  Redemption,
  Achievement,
  UserAchievement,
  Recognition
};