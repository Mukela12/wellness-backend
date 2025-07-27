const mongoose = require('mongoose');

const challengeParticipantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  progress: {
    current: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    milestones: [{
      milestone: Number,
      achievedAt: Date,
      happyCoinsEarned: Number
    }]
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'dropped'],
    default: 'active'
  },
  completedAt: Date,
  finalScore: Number
});

const challengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  shortDescription: {
    type: String,
    maxLength: 150
  },
  category: {
    type: String,
    enum: ['mindfulness', 'fitness', 'nutrition', 'sleep', 'social', 'learning', 'habit', 'team'],
    required: true
  },
  type: {
    type: String,
    enum: ['individual', 'team', 'company_wide'],
    required: true
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  duration: {
    days: {
      type: Number,
      required: true,
      min: 1
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['draft', 'upcoming', 'active', 'completed', 'cancelled'],
    default: 'draft'
  },
  goal: {
    type: {
      type: String,
      enum: ['checkin_streak', 'mood_average', 'total_checkins', 'habit_completion', 'peer_recognition', 'custom'],
      required: true
    },
    target: {
      type: Number,
      required: true
    },
    unit: String, // e.g., 'days', 'points', 'times'
    description: String
  },
  rules: [String],
  milestones: [{
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    title: String,
    description: String,
    reward: {
      happyCoins: Number,
      badge: String
    }
  }],
  rewards: {
    completion: {
      happyCoins: {
        type: Number,
        default: 500
      },
      badge: String,
      certificate: Boolean
    },
    leaderboard: [{
      position: Number,
      happyCoins: Number,
      badge: String
    }]
  },
  eligibility: {
    departments: [String],
    roles: [String],
    minCheckIns: {
      type: Number,
      default: 0
    },
    allEmployees: {
      type: Boolean,
      default: true
    }
  },
  participants: [challengeParticipantSchema],
  maxParticipants: {
    type: Number,
    default: -1 // -1 means unlimited
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [String],
  images: [String],
  resources: [{
    title: String,
    type: {
      type: String,
      enum: ['article', 'video', 'audio', 'infographic', 'checklist']
    },
    url: String,
    description: String
  }],
  analytics: {
    totalParticipants: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    engagementRate: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
challengeSchema.index({ status: 1, 'duration.startDate': 1 });
challengeSchema.index({ category: 1, difficulty: 1 });
challengeSchema.index({ type: 1, isPublic: 1 });
challengeSchema.index({ 'participants.userId': 1 });

// Virtual for checking if challenge is currently active
challengeSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.duration.startDate <= now && 
         this.duration.endDate >= now;
});

// Virtual for checking if user can join
challengeSchema.virtual('canAcceptNewParticipants').get(function() {
  const now = new Date();
  return this.status === 'upcoming' && 
         this.duration.startDate > now &&
         (this.maxParticipants === -1 || this.participants.length < this.maxParticipants);
});

// Method to check if user is eligible
challengeSchema.methods.isUserEligible = async function(userId) {
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  if (!user) return false;
  
  // Check if already participating
  if (this.participants.some(p => p.userId.toString() === userId.toString())) {
    return false;
  }
  
  // Check eligibility criteria
  if (!this.eligibility.allEmployees) {
    if (this.eligibility.departments.length > 0 && 
        !this.eligibility.departments.includes(user.department)) {
      return false;
    }
    
    if (this.eligibility.roles.length > 0 && 
        !this.eligibility.roles.includes(user.role)) {
      return false;
    }
  }
  
  // Check minimum check-ins if required
  if (this.eligibility.minCheckIns > 0) {
    const CheckIn = mongoose.model('CheckIn');
    const checkInCount = await CheckIn.countDocuments({ userId });
    if (checkInCount < this.eligibility.minCheckIns) {
      return false;
    }
  }
  
  return true;
};

// Method to join challenge
challengeSchema.methods.addParticipant = function(userId) {
  if (this.participants.some(p => p.userId.toString() === userId.toString())) {
    throw new Error('User already participating');
  }
  
  if (this.maxParticipants !== -1 && this.participants.length >= this.maxParticipants) {
    throw new Error('Challenge is full');
  }
  
  this.participants.push({ userId });
  this.analytics.totalParticipants = this.participants.length;
  
  return this.save();
};

// Method to update participant progress
challengeSchema.methods.updateParticipantProgress = async function(userId, progressData) {
  const participant = this.participants.find(p => 
    p.userId.toString() === userId.toString()
  );
  
  if (!participant) {
    throw new Error('User not participating in this challenge');
  }
  
  // Update progress
  participant.progress.current = progressData.current;
  participant.progress.percentage = Math.min(
    (progressData.current / this.goal.target) * 100, 
    100
  );
  
  // Check for milestone achievements
  const newMilestones = this.milestones.filter(milestone => {
    const isAchieved = participant.progress.percentage >= milestone.percentage;
    const alreadyAchieved = participant.progress.milestones.some(
      m => m.milestone === milestone.percentage
    );
    return isAchieved && !alreadyAchieved;
  });
  
  // Award milestone rewards
  let totalCoinsEarned = 0;
  newMilestones.forEach(milestone => {
    participant.progress.milestones.push({
      milestone: milestone.percentage,
      achievedAt: new Date(),
      happyCoinsEarned: milestone.reward?.happyCoins || 0
    });
    totalCoinsEarned += milestone.reward?.happyCoins || 0;
  });
  
  // Check for completion
  if (participant.progress.percentage >= 100 && participant.status === 'active') {
    participant.status = 'completed';
    participant.completedAt = new Date();
    participant.finalScore = participant.progress.current;
    totalCoinsEarned += this.rewards.completion.happyCoins || 0;
  }
  
  await this.save();
  
  return {
    milestones: newMilestones,
    coinsEarned: totalCoinsEarned,
    completed: participant.status === 'completed'
  };
};

// Method to get leaderboard
challengeSchema.methods.getLeaderboard = function(limit = 10) {
  return this.participants
    .filter(p => p.status === 'active' || p.status === 'completed')
    .sort((a, b) => {
      // Sort by completion status first, then by progress
      if (a.status === 'completed' && b.status !== 'completed') return -1;
      if (b.status === 'completed' && a.status !== 'completed') return 1;
      return b.progress.current - a.progress.current;
    })
    .slice(0, limit)
    .map((participant, index) => ({
      rank: index + 1,
      userId: participant.userId,
      progress: participant.progress,
      status: participant.status,
      completedAt: participant.completedAt
    }));
};

// Method to calculate analytics
challengeSchema.methods.calculateAnalytics = function() {
  const total = this.participants.length;
  const completed = this.participants.filter(p => p.status === 'completed').length;
  const active = this.participants.filter(p => p.status === 'active').length;
  
  this.analytics.totalParticipants = total;
  this.analytics.completionRate = total > 0 ? (completed / total) * 100 : 0;
  
  if (completed > 0) {
    const totalScore = this.participants
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.finalScore || 0), 0);
    this.analytics.averageScore = totalScore / completed;
  }
  
  // Engagement rate based on recent activity
  this.analytics.engagementRate = total > 0 ? (active / total) * 100 : 0;
  
  return this.analytics;
};

// Static method to get active challenges for user
challengeSchema.statics.getActiveChallengesForUser = async function(userId) {
  const now = new Date();
  
  return this.find({
    status: { $in: ['upcoming', 'active'] },
    'duration.endDate': { $gte: now },
    $or: [
      { isPublic: true },
      { 'participants.userId': userId }
    ]
  })
  .populate('createdBy', 'name')
  .sort({ 'duration.startDate': 1 });
};

// Static method to get user's participating challenges
challengeSchema.statics.getUserChallenges = async function(userId) {
  return this.find({
    'participants.userId': userId
  })
  .populate('createdBy', 'name')
  .sort({ 'duration.startDate': -1 });
};

// Pre-save middleware to update challenge status
challengeSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.status === 'upcoming' && this.duration.startDate <= now) {
    this.status = 'active';
  } else if (this.status === 'active' && this.duration.endDate <= now) {
    this.status = 'completed';
  }
  
  // Calculate analytics
  this.calculateAnalytics();
  
  next();
});

const Challenge = mongoose.model('Challenge', challengeSchema);
module.exports = Challenge;