const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HTTP_STATUS } = require('../config/constants');

// Middleware to authenticate user with JWT
const authenticate = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'wellnessai',
        audience: 'wellnessai-users'
      });

      // Get user from database
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Invalid token. User not found.'
        });
      }

      if (!user.isActive) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Account has been deactivated.'
        });
      }

      // Add user to request object
      req.user = user;
      next();

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Token expired. Please login again.',
          code: 'TOKEN_EXPIRED'
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Invalid token format.'
        });
      }

      throw error;
    }

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Middleware to authorize specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Handle both array and individual arguments
    const allowedRoles = roles.length === 1 && Array.isArray(roles[0]) ? roles[0] : roles;

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

// Middleware to check if user owns the resource or has admin/hr privileges
const authorizeOwnerOrAdmin = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const requestedUserId = req.params[userIdParam] || req.body[userIdParam];
    const currentUserId = req.user._id.toString();
    const userRole = req.user.role;

    // Allow if user is accessing their own data
    if (requestedUserId === currentUserId) {
      return next();
    }

    // Allow if user is HR or Admin
    if (userRole === 'hr' || userRole === 'admin') {
      return next();
    }

    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Access denied. You can only access your own data.'
    });
  };
};

// Middleware to check if user has completed onboarding
const requireOnboarding = (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.onboarding.completed) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Please complete onboarding process first',
      redirectTo: '/onboarding'
    });
  }

  next();
};

// Middleware to check if email is verified
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Please verify your email address first',
      code: 'EMAIL_NOT_VERIFIED',
      redirectTo: '/verify-email'
    });
  }

  next();
};

// Role-specific email verification middleware (stricter for employees)
const requireEmailVerificationByRole = (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // For employees, email verification is mandatory for most features
  if (req.user.role === 'employee' && !req.user.isEmailVerified) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Employees must verify their email address to access this feature',
      code: 'EMAIL_NOT_VERIFIED',
      redirectTo: '/verify-email',
      blocking: true
    });
  }

  // For HR and admin, email verification is recommended but not always blocking
  if (['hr', 'admin'].includes(req.user.role) && !req.user.isEmailVerified) {
    // Add warning but allow access
    req.emailVerificationWarning = {
      message: 'Consider verifying your email address for full access to all features',
      redirectTo: '/verify-email'
    };
  }

  next();
};

// Middleware to verify refresh token
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, {
        issuer: 'wellnessai',
        audience: 'wellnessai-users'
      });

      // Check if token type is refresh
      if (decoded.type !== 'refresh') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Invalid token type'
        });
      }

      // Get user and check if refresh token exists
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Invalid refresh token. User not found.'
        });
      }

      // Check if refresh token exists in user's tokens array
      const tokenExists = user.refreshTokens.some(t => t.token === refreshToken);
      
      if (!tokenExists) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      req.user = user;
      req.refreshToken = refreshToken;
      next();

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Refresh token expired. Please login again.'
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Invalid refresh token format'
        });
      }

      throw error;
    }

  } catch (error) {
    console.error('Refresh token verification error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Token verification failed'
    });
  }
};

module.exports = {
  authenticate,
  authorize,
  authorizeOwnerOrAdmin,
  requireOnboarding,
  requireEmailVerification,
  requireEmailVerificationByRole,
  verifyRefreshToken
};