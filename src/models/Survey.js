const mongoose = require('mongoose');

const surveyResponseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
});

const surveySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['pulse', 'onboarding', 'feedback', 'custom'],
    default: 'pulse'
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'closed', 'archived'],
    default: 'draft'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  dueDate: {
    type: Date
  },
  questions: [{
    id: {
      type: String,
      required: true
    },
    question: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['scale', 'multiple_choice', 'checkbox', 'text', 'boolean'],
      required: true
    },
    required: {
      type: Boolean,
      default: true
    },
    options: [String], // For multiple choice/checkbox
    scale: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 5 },
      labels: {
        type: Map,
        of: String
      }
    },
    category: String // For grouping questions
  }],
  schedule: {
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly', 'once'],
      default: 'weekly'
    },
    dayOfWeek: {
      type: Number, // 0-6 (Sunday-Saturday)
      min: 0,
      max: 6
    },
    time: {
      type: String, // HH:MM format
      default: '09:00'
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: Date
  },
  targetAudience: {
    departments: [String],
    roles: [String],
    specific_users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    all: {
      type: Boolean,
      default: true
    }
  },
  rewards: {
    happyCoins: {
      type: Number,
      default: 100
    },
    badge: String
  },
  responses: [surveyResponseSchema],
  analytics: {
    totalResponses: {
      type: Number,
      default: 0
    },
    averageCompletionTime: {
      type: Number,
      default: 0 // in seconds
    },
    responseRate: {
      type: Number,
      default: 0 // percentage
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Distribution tracking
  lastDistributed: {
    type: Date
  },
  distributionCount: {
    type: Number,
    default: 0
  },
  estimatedTime: {
    type: String,
    default: '5 minutes'
  },
  category: {
    type: String,
    enum: ['wellness', 'engagement', 'feedback', 'pulse', 'other'],
    default: 'pulse'
  }
}, {
  timestamps: true
});

// Indexes
surveySchema.index({ type: 1, status: 1 });
surveySchema.index({ 'schedule.startDate': 1 });
surveySchema.index({ createdAt: -1 });
surveySchema.index({ 'responses.userId': 1 });

// Virtual for checking if survey is currently active
surveySchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.schedule.startDate <= now && 
         (!this.schedule.endDate || this.schedule.endDate >= now);
});

// Method to check if user has responded
surveySchema.methods.hasUserResponded = function(userId) {
  return this.responses.some(response => 
    response.userId.toString() === userId.toString()
  );
};

// Method to calculate analytics
surveySchema.methods.calculateAnalytics = async function() {
  const totalTargetUsers = await this.getTargetUsersCount();
  this.analytics.totalResponses = this.responses.length;
  this.analytics.responseRate = totalTargetUsers > 0 
    ? (this.responses.length / totalTargetUsers) * 100 
    : 0;
  
  // Calculate average completion time if we track it
  if (this.responses.length > 0) {
    const totalTime = this.responses.reduce((sum, response) => {
      // If we track time, add it here
      return sum + (response.completionTime || 300); // Default 5 minutes
    }, 0);
    this.analytics.averageCompletionTime = totalTime / this.responses.length;
  }
  
  return this.analytics;
};

// Method to get target users count
surveySchema.methods.getTargetUsersCount = async function() {
  const User = mongoose.model('User');
  
  if (this.targetAudience.all) {
    return await User.countDocuments({ 
      isActive: true, 
      role: 'employee' 
    });
  }
  
  const query = { isActive: true, role: 'employee' };
  
  if (this.targetAudience.departments.length > 0) {
    query.department = { $in: this.targetAudience.departments };
  }
  
  if (this.targetAudience.roles.length > 0) {
    query.role = { $in: this.targetAudience.roles };
  }
  
  if (this.targetAudience.specific_users.length > 0) {
    query._id = { $in: this.targetAudience.specific_users };
  }
  
  return await User.countDocuments(query);
};

// Static method to get active surveys for a user
surveySchema.statics.getActiveSurveysForUser = async function(userId) {
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  if (!user) return [];
  
  const now = new Date();
  const query = {
    status: 'active',
    'schedule.startDate': { $lte: now },
    $or: [
      { 'schedule.endDate': { $exists: false } },
      { 'schedule.endDate': { $gte: now } }
    ]
  };
  
  // Check target audience
  const audienceQuery = {
    $or: [
      { 'targetAudience.all': true },
      { 'targetAudience.departments': user.department },
      { 'targetAudience.roles': user.role },
      { 'targetAudience.specific_users': userId }
    ]
  };
  
  const surveys = await this.find({
    ...query,
    ...audienceQuery
  }).sort({ 
    priority: -1, // High priority first (urgent, high, normal, low)
    createdAt: -1 
  });
  
  // Filter out surveys user has already responded to and sort by priority
  const availableSurveys = surveys.filter(survey => !survey.hasUserResponded(userId));
  
  // Custom sort to handle priority ordering properly
  const priorityOrder = { 'urgent': 4, 'high': 3, 'normal': 2, 'low': 1 };
  return availableSurveys.sort((a, b) => {
    const aPriority = priorityOrder[a.priority] || 2;
    const bPriority = priorityOrder[b.priority] || 2;
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }
    
    // If same priority, sort by creation date (newer first)
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
};

// Pre-save middleware
surveySchema.pre('save', function(next) {
  // Ensure questions have unique IDs
  this.questions.forEach((question, index) => {
    if (!question.id) {
      question.id = `q${index + 1}`;
    }
  });
  
  next();
});

const Survey = mongoose.model('Survey', surveySchema);
module.exports = Survey;