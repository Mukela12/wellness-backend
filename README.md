# WellnessAI Backend API

## 🌟 Project Overview

WellnessAI is an AI-powered employee wellness platform designed to promote mental health and wellbeing in the workplace. The backend provides a comprehensive API for daily wellness check-ins, mood tracking, personalized insights, and HR analytics.

### Key Features
- 🔐 **Secure Authentication** - JWT-based auth with email verification
- 📱 **Daily Check-ins** - Mood tracking with 1-5 scale rating
- 🤖 **AI Integration** - OpenAI GPT-4o for personalized insights
- 📊 **HR Analytics** - Mental health risk detection and reporting
- 💰 **Happy Coins System** - Gamified rewards for engagement
- 📧 **WhatsApp Integration** - Seamless mobile notifications
- 🎯 **Onboarding Questionnaire** - Personalized user profiling

## 🛠 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (Access + Refresh tokens)
- **Email**: Nodemailer with Gmail SMTP
- **AI Services**: OpenAI GPT-4o, Google Cloud Natural Language
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting
- **File Storage**: Cloudinary (planned)
- **Communication**: WhatsApp Business API, Twilio (planned)

## 🚀 Getting Started

### Prerequisites
```bash
- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Gmail account for SMTP
- OpenAI API key (when ready)
- WhatsApp Business API access (when ready)
```

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd wellness-backend
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Required Environment Variables**
   ```env
   # Server
   PORT=5000
   NODE_ENV=development
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/wellness-dev
   
   # JWT Secrets
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-refresh-token-secret
   
   # Email (Gmail SMTP)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   
   # Frontend URL
   CLIENT_URL=http://localhost:5173
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Verify Setup**
   ```bash
   curl http://localhost:5000/health
   # Should return: {"success": true, "message": "WellnessAI Backend is healthy"}
   ```

## 📚 API Documentation

### Base URL
```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

### Rate Limiting
- **Window**: 1 minute
- **Max Requests**: 300 per IP (configurable for testing)
- **Applies to**: All `/api/*` routes

---

## 🔐 Authentication Endpoints

### Public Endpoints

#### `POST /api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@company.com",
  "password": "SecurePass123",
  "employeeId": "EMP001",
  "department": "Engineering",
  "phone": "+1234567890"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully! Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "64f7a1b2c3d4e5f6789012ab",
      "name": "John Doe",
      "email": "john.doe@company.com",
      "employeeId": "EMP001",
      "department": "Engineering",
      "role": "employee",
      "isEmailVerified": false,
      "onboarding": {
        "completed": false
      }
    }
  }
}
```

#### `POST /api/auth/login`
Authenticate user and return access token.

**Request Body:**
```json
{
  "email": "john.doe@company.com",
  "password": "SecurePass123",
  "remember": false
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "64f7a1b2c3d4e5f6789012ab",
      "name": "John Doe",
      "email": "john.doe@company.com",
      "role": "employee",
      "department": "Engineering"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": "7d",
    "needsOnboarding": true,
    "needsEmailVerification": false
  }
}
```

#### `POST /api/auth/refresh`
Refresh expired access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `GET /api/auth/verify-email?token=<verification-token>`
Verify user's email address using token from email.

#### `POST /api/auth/forgot-password`
Request password reset email.

**Request Body:**
```json
{
  "email": "john.doe@company.com"
}
```

#### `POST /api/auth/reset-password`
Reset password using token from email.

**Request Body:**
```json
{
  "token": "password-reset-token-from-email",
  "password": "NewSecurePass123"
}
```

### Protected Endpoints (Require Authentication)

#### `GET /api/auth/profile`
Get current user's profile information.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f7a1b2c3d4e5f6789012ab",
      "employeeId": "EMP001",
      "name": "John Doe",
      "email": "john.doe@company.com",
      "department": "Engineering",
      "role": "employee",
      "wellness": {
        "happyCoins": 150,
        "currentStreak": 5,
        "averageMood": 4.2,
        "riskLevel": "low"
      },
      "onboarding": {
        "completed": true,
        "completedAt": "2024-07-24T10:30:00.000Z"
      }
    }
  }
}
```

#### `POST /api/auth/logout`
Logout and invalidate refresh token.

#### `POST /api/auth/change-password`
Change password for authenticated user.

**Request Body:**
```json
{
  "currentPassword": "SecurePass123",
  "newPassword": "NewSecurePass456",
  "confirmPassword": "NewSecurePass456"
}
```

---

## 🔄 Development Status

### ✅ Completed Features
- [x] Project structure and configuration
- [x] User authentication system with JWT
- [x] Email verification and password reset
- [x] User model with wellness metrics
- [x] Rate limiting and security middleware
- [x] Input validation and error handling
- [x] Email service with HTML templates
- [x] Development environment setup
- [x] **Daily check-in system** - Complete with mood tracking, Happy Coins, and streaks
- [x] **Check-in analytics** - History, statistics, and mood trend analysis
- [x] **Database optimization** - Efficient indexes and aggregation pipelines

### 🚧 Currently In Development
- [ ] User profile management endpoints
- [ ] Onboarding questionnaire flow

### 📋 Planned Features
- [ ] Weekly pulse surveys
- [ ] HR analytics dashboard endpoints
- [ ] Mental health risk detection algorithm
- [ ] Happy Coins reward system
- [ ] WhatsApp Business API integration
- [ ] OpenAI integration for personalized insights
- [ ] Google Cloud Natural Language sentiment analysis
- [ ] Merchant rewards catalog
- [ ] Real-time notifications
- [ ] Data export functionality

---

## 📱 Daily Check-in Endpoints

### `POST /api/checkins`
Create a daily check-in with mood rating and optional feedback.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "mood": 4,
  "feedback": "Had a great day! Finished my project ahead of schedule.",
  "source": "web"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Check-in completed successfully! Thank you for sharing how you feel.",
  "data": {
    "checkIn": {
      "id": "64f7a1b2c3d4e5f6789012ab",
      "mood": 4,
      "moodLabel": "Good",
      "feedback": "Had a great day! Finished my project ahead of schedule.",
      "date": "2025-07-24",
      "happyCoinsEarned": 85,
      "streakAtCheckIn": 5,
      "source": "web"
    },
    "user": {
      "totalHappyCoins": 425,
      "currentStreak": 5,
      "longestStreak": 12
    },
    "streakBonus": 0,
    "nextCheckIn": "2025-07-25T09:00:00.000Z"
  }
}
```

### `GET /api/checkins/today`
Check today's check-in status.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Check-in completed for today",
  "data": {
    "checkedInToday": true,
    "checkIn": {
      "id": "64f7a1b2c3d4e5f6789012ab",
      "mood": 4,
      "moodLabel": "Good",
      "date": "2025-07-24",
      "happyCoinsEarned": 85
    },
    "nextCheckIn": "2025-07-25T09:00:00.000Z",
    "canCheckIn": false
  }
}
```

### `GET /api/checkins`
Get check-in history with pagination and statistics.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 30)
- `startDate` (optional): Filter from date (ISO format)
- `endDate` (optional): Filter to date (ISO format)
- `includeAnalysis` (optional): Include AI analysis data

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "checkIns": [
      {
        "id": "64f7a1b2c3d4e5f6789012ab",
        "mood": 4,
        "moodLabel": "Good",
        "feedback": "Great productive day",
        "date": "2025-07-24",
        "happyCoinsEarned": 85,
        "streakAtCheckIn": 5,
        "source": "web",
        "isPositive": true,
        "requiresAttention": false
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 142,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "statistics": {
      "totalCheckIns": 142,
      "averageMood": 3.8,
      "totalHappyCoins": 7100,
      "moodDistribution": {
        "1": 5, "2": 12, "3": 45, "4": 58, "5": 22
      }
    }
  }
}
```

### `GET /api/checkins/stats`
Get detailed check-in statistics and insights.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2025-06-24T00:00:00.000Z",
      "endDate": "2025-07-24T00:00:00.000Z",
      "totalDays": 30
    },
    "checkInMetrics": {
      "totalCheckIns": 28,
      "checkInRate": "93%",
      "longestStreakInPeriod": 14
    },
    "moodMetrics": {
      "averageMood": 3.8,
      "moodDistribution": {
        "1": 1, "2": 3, "3": 8, "4": 12, "5": 4
      },
      "insights": {
        "mostCommonMood": "4",
        "positiveCheckIns": 16,
        "neutralCheckIns": 8,
        "negativeCheckIns": 4
      }
    },
    "wellnessMetrics": {
      "totalHappyCoinsEarned": 1420,
      "positiveCheckInPercentage": 57
    }
  }
}
```

### `GET /api/checkins/trend`
Get mood trend analysis over time.

**Query Parameters:**
- `days` (optional): Number of days to analyze (default: 7)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "trend": [
      {
        "date": "2025-07-18",
        "mood": 3,
        "moodLabel": "Neutral"
      },
      {
        "date": "2025-07-19",
        "mood": 4,
        "moodLabel": "Good"
      }
    ],
    "analysis": {
      "direction": "improving",
      "change": 0.3,
      "period": "7 days",
      "averageMood": 3.7
    }
  }
}
```

---

## 📊 Database Schema

### User Model
```javascript
{
  employeeId: String (unique),
  email: String (unique),
  password: String (hashed),
  name: String,
  phone: String,
  department: Enum,
  role: Enum ['employee', 'hr', 'admin'],
  
  onboarding: {
    completed: Boolean,
    answers: Map,
    completedAt: Date
  },
  
  wellness: {
    happyCoins: Number,
    currentStreak: Number,
    averageMood: Number,
    riskLevel: Enum ['low', 'medium', 'high'],
    riskScore: Number
  },
  
  notifications: {
    checkInReminder: Boolean,
    preferredChannel: Enum ['email', 'whatsapp', 'both']
  }
}
```

### CheckIn Model
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  date: Date, // Normalized to start of day
  mood: Number, // 1-5 scale
  feedback: String, // Optional user feedback
  source: Enum ['web', 'whatsapp', 'mobile'],
  happyCoinsEarned: Number,
  streakAtCheckIn: Number,
  
  analysis: {
    sentimentScore: Number, // -1 to 1
    keywords: [String],
    emotions: Object, // AI-detected emotions
    riskIndicators: [String],
    personalizedMessage: String
  },
  
  processed: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Future Models
- **Survey**: Weekly pulse and onboarding responses  
- **Reward**: Happy Coins transactions and redemptions
- **Analytics**: Aggregated wellness metrics for HR dashboard

---

## 🛡 Security Features

### Authentication
- JWT access tokens (7-day expiry)
- Refresh tokens (30-day expiry, HTTP-only cookies)
- Password hashing with bcrypt (salt rounds: 12)
- Email verification required for full access

### API Security
- Helmet.js for security headers
- CORS protection with whitelist
- Rate limiting (300 requests/minute)
- Input validation and sanitization
- MongoDB injection protection

### Privacy
- Sensitive data excluded from API responses
- Password fields marked as non-selectable
- Secure token generation for resets

---

## 🧪 Testing

### Manual Testing Endpoints

```bash
# Health check
curl http://localhost:5000/health

# API documentation
curl http://localhost:5000/api

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com", 
    "password": "TestPass123",
    "employeeId": "TEST001",
    "department": "Engineering"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'

# Get profile (replace <token> with actual token)
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer <token>"
```

### Planned Testing
- Unit tests for authentication logic
- Integration tests for API endpoints
- Load testing for rate limits
- Security testing for vulnerabilities

---

## 🚀 Deployment

### Development
```bash
npm run dev  # Starts with nodemon for auto-reload
```

### Production
```bash
npm start    # Starts production server
```

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use strong JWT secrets (32+ characters)
- Configure MongoDB Atlas connection
- Set up proper CORS origins
- Configure production email service
- Enable SSL/HTTPS

---

## 🤝 Contributing

### Development Workflow
1. Create feature branch from `main`
2. Implement feature with tests
3. Update this README if adding new endpoints
4. Submit PR with clear description

### Code Standards
- Use ESLint configuration
- Follow REST API conventions
- Include JSDoc comments for functions
- Validate all inputs
- Handle errors gracefully
- Update API documentation

### Adding New Endpoints
1. Create controller in `/src/controllers/`
2. Add validation in `/src/middleware/validation.js`
3. Create routes in `/src/routes/`
4. Update `/src/routes/index.js`
5. Document in this README
6. Add to development status section

---

## 📞 Support

### Development Team
- **Mukela** - Backend Architecture & API Development
- **Rahul** - Frontend Integration & Testing

### Issues & Questions
- Create GitHub issues for bugs
- Use discussions for feature requests
- Contact team via WhatsApp for urgent matters

---

## 📄 License

This project is proprietary software developed for WellnessAI Platform.
© 2024 WellnessAI. All rights reserved.

---

**Last Updated**: July 24, 2025  
**Version**: 1.0.0  
**Status**: Active Development

## 🎯 Development Summary

**Phase 1 Complete**: Core authentication and daily check-in system fully implemented and tested.

- ✅ **Authentication System**: Full JWT-based auth with email verification
- ✅ **Daily Check-ins**: Complete mood tracking with Happy Coins rewards  
- ✅ **Analytics**: History, statistics, and trend analysis
- ✅ **Database**: Optimized schemas with proper indexing
- ✅ **API Documentation**: Comprehensive endpoint documentation
- ✅ **Testing**: All endpoints tested and working

**Next Phase**: HR analytics dashboard, WhatsApp integration, and AI services.

**Server Status**: Running on http://localhost:8005 with MongoDB and email services connected.