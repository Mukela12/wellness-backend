const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ROLES, DEPARTMENTS, RISK_LEVELS, CHANNELS } = require('../config/constants');

const userSchema = new mongoose.Schema({
  // Basic Information
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Please enter a valid phone number']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: {
      values: DEPARTMENTS,
      message: '{VALUE} is not a valid department'
    }
  },
  role: {
    type: String,
    enum: {
      values: Object.values(ROLES),
      message: '{VALUE} is not a valid role'
    },
    default: ROLES.EMPLOYEE
  },

  // Onboarding Data
  onboarding: {
    completed: {
      type: Boolean,
      default: false
    },
    answers: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    },
    completedAt: Date
  },

  // Personality & Preferences
  personality: {
    mbtiType: {
      type: String,
      enum: ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
             'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']
    },
    workStyle: String,
    interests: [String],
    stressManagement: [String]
  },

  // Wellness Metrics
  wellness: {
    happyCoins: {
      type: Number,
      default: 0,
      min: [0, 'Happy coins cannot be negative']
    },
    currentStreak: {
      type: Number,
      default: 0,
      min: 0
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: 0
    },
    lastCheckIn: {
      type: Date
    },
    averageMood: {
      type: Number,
      min: 1,
      max: 5
    },
    riskLevel: {
      type: String,
      enum: Object.values(RISK_LEVELS),
      default: RISK_LEVELS.LOW
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    riskAlertSent: {
      type: Boolean,
      default: false
    }
  },

  // Notification Preferences
  notifications: {
    checkInReminder: {
      type: Boolean,
      default: true
    },
    surveyReminder: {
      type: Boolean,
      default: true
    },
    rewardUpdates: {
      type: Boolean,
      default: false
    },
    preferredChannel: {
      type: String,
      enum: Object.values(CHANNELS),
      default: CHANNELS.BOTH
    },
    reminderTime: {
      type: String,
      default: '09:00', // 24-hour format
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format']
    }
  },

  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,

  // Security
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 30 * 24 * 60 * 60 // 30 days
    }
  }],
  
  // Email verification
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Password reset
  passwordResetToken: String,
  passwordResetExpires: Date

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1, employeeId: 1 });
userSchema.index({ department: 1, 'wellness.riskLevel': 1 });
userSchema.index({ isActive: 1, role: 1 });
userSchema.index({ 'wellness.lastCheckIn': -1 });

// Virtual for user's full profile
userSchema.virtual('profile').get(function() {
  return {
    id: this._id,
    employeeId: this.employeeId,
    name: this.name,
    email: this.email,
    department: this.department,
    role: this.role,
    wellness: this.wellness,
    onboarding: this.onboarding
  };
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash password if it's modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update streak before saving check-in
userSchema.pre('save', function(next) {
  if (this.isModified('wellness.lastCheckIn') && this.wellness.lastCheckIn) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastCheckin = new Date(this.wellness.lastCheckIn);
    
    // Check if last check-in was yesterday (continuing streak)
    if (lastCheckin.toDateString() === yesterday.toDateString()) {
      this.wellness.currentStreak += 1;
    } 
    // Check if last check-in was today (same day, don't increment)
    else if (lastCheckin.toDateString() === today.toDateString()) {
      // Keep current streak
    }
    // Otherwise, reset streak
    else {
      this.wellness.currentStreak = 1;
    }
    
    // Update longest streak if current is higher
    this.wellness.longestStreak = Math.max(
      this.wellness.currentStreak, 
      this.wellness.longestStreak || 0
    );
  }
  
  next();
});

// Instance Methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      role: this.role,
      department: this.department,
      email: this.email
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRE,
      issuer: 'wellnessai',
      audience: 'wellnessai-users'
    }
  );
};

userSchema.methods.generateRefreshToken = function() {
  const refreshToken = jwt.sign(
    { 
      id: this._id,
      type: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRE,
      issuer: 'wellnessai',
      audience: 'wellnessai-users'
    }
  );
  
  this.refreshTokens.push({ token: refreshToken });
  return refreshToken;
};

userSchema.methods.generateEmailVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
    
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return token;
};

userSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
    
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return token;
};

// Static Methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByEmployeeId = function(employeeId) {
  return this.findOne({ employeeId: employeeId.toUpperCase() });
};

userSchema.statics.getActiveUsers = function() {
  return this.find({ isActive: true });
};

userSchema.statics.getUsersByDepartment = function(department) {
  return this.find({ department, isActive: true });
};

userSchema.statics.getHighRiskUsers = function() {
  return this.find({ 
    'wellness.riskLevel': RISK_LEVELS.HIGH, 
    isActive: true 
  });
};

module.exports = mongoose.model('User', userSchema);