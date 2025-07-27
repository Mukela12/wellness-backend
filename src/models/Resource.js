const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
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
    maxLength: 200
  },
  type: {
    type: String,
    enum: ['article', 'video', 'audio', 'infographic', 'checklist', 'worksheet', 'guide', 'podcast'],
    required: true
  },
  category: {
    type: String,
    enum: ['mental_health', 'stress_management', 'mindfulness', 'fitness', 'nutrition', 'sleep', 'work_life_balance', 'team_building', 'leadership', 'productivity'],
    required: true
  },
  subcategory: String,
  content: {
    url: String,
    body: String, // For articles
    duration: Number, // For videos/audio in minutes
    downloadUrl: String // For downloadable resources
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  tags: [String],
  author: {
    name: String,
    bio: String,
    credentials: String,
    avatar: String
  },
  source: {
    name: String,
    url: String,
    credibility: {
      type: String,
      enum: ['verified', 'trusted', 'community'],
      default: 'community'
    }
  },
  readingTime: {
    type: Number, // in minutes
    default: 5
  },
  featured: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  targetAudience: {
    departments: [String],
    roles: [String],
    all: {
      type: Boolean,
      default: true
    }
  },
  prerequisites: [String],
  learningObjectives: [String],
  relatedResources: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  }],
  attachments: [{
    name: String,
    url: String,
    type: String, // pdf, doc, image, etc.
    size: Number // in bytes
  }],
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    downloads: {
      type: Number,
      default: 0
    },
    completions: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalRatings: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  expiryDate: Date,
  language: {
    type: String,
    default: 'en'
  },
  accessibility: {
    hasTranscript: {
      type: Boolean,
      default: false
    },
    hasSubtitles: {
      type: Boolean,
      default: false
    },
    isScreenReaderFriendly: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// User interaction with resources
const resourceInteractionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource',
    required: true
  },
  interactions: {
    viewed: {
      type: Boolean,
      default: false
    },
    liked: {
      type: Boolean,
      default: false
    },
    completed: {
      type: Boolean,
      default: false
    },
    downloaded: {
      type: Boolean,
      default: false
    },
    bookmarked: {
      type: Boolean,
      default: false
    }
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
  progress: {
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    lastPosition: String, // For videos/audio
    timeSpent: {
      type: Number,
      default: 0 // in minutes
    }
  },
  completedAt: Date,
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  notes: String
}, {
  timestamps: true
});

// Compound index to ensure unique interactions per user per resource
resourceInteractionSchema.index({ userId: 1, resourceId: 1 }, { unique: true });

// Indexes for resource schema
resourceSchema.index({ category: 1, status: 1 });
resourceSchema.index({ type: 1, status: 1 });
resourceSchema.index({ featured: -1, createdAt: -1 });
resourceSchema.index({ tags: 1 });
resourceSchema.index({ 'analytics.views': -1 });
resourceSchema.index({ 'analytics.averageRating': -1 });

// Virtual for checking if resource is currently available
resourceSchema.virtual('isAvailable').get(function() {
  return this.status === 'published' && 
         (!this.expiryDate || this.expiryDate >= new Date());
});

// Method to check if user has access
resourceSchema.methods.hasUserAccess = function(user) {
  if (!this.isPublic && user.role === 'employee') {
    return false;
  }
  
  if (!this.targetAudience.all) {
    if (this.targetAudience.departments.length > 0 && 
        !this.targetAudience.departments.includes(user.department)) {
      return false;
    }
    
    if (this.targetAudience.roles.length > 0 && 
        !this.targetAudience.roles.includes(user.role)) {
      return false;
    }
  }
  
  return true;
};

// Method to increment view count
resourceSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  return this.save();
};

// Method to update rating
resourceSchema.methods.updateRating = function(newRating) {
  const totalScore = (this.analytics.averageRating * this.analytics.totalRatings) + newRating;
  this.analytics.totalRatings += 1;
  this.analytics.averageRating = totalScore / this.analytics.totalRatings;
  
  return this.save();
};

// Static method to get featured resources
resourceSchema.statics.getFeaturedResources = function(limit = 6) {
  return this.find({
    featured: true,
    status: 'published'
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('createdBy', 'name');
};

// Static method to get popular resources
resourceSchema.statics.getPopularResources = function(limit = 10) {
  return this.find({
    status: 'published'
  })
  .sort({ 'analytics.views': -1, 'analytics.averageRating': -1 })
  .limit(limit)
  .populate('createdBy', 'name');
};

// Static method to get resources by category
resourceSchema.statics.getByCategory = function(category, options = {}) {
  const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = -1 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({
    category,
    status: 'published'
  })
  .sort({ [sortBy]: sortOrder })
  .skip(skip)
  .limit(limit)
  .populate('createdBy', 'name');
};

// Pre-save middleware
resourceSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  if (!this.shortDescription && this.description) {
    this.shortDescription = this.description.substring(0, 200);
  }
  
  next();
});

// Export models
const Resource = mongoose.model('Resource', resourceSchema);
const ResourceInteraction = mongoose.model('ResourceInteraction', resourceInteractionSchema);

module.exports = {
  Resource,
  ResourceInteraction
};