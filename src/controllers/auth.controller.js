const { validationResult } = require('express-validator');
const crypto = require('crypto');
const User = require('../models/User');
const emailService = require('../services/notifications/email.service');
const { HTTP_STATUS } = require('../config/constants');

class AuthController {
  // Register new user
  async register(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { name, email, password, employeeId, department, phone, role } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { employeeId: employeeId.toUpperCase() }]
      });

      if (existingUser) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: existingUser.email === email 
            ? 'Email already registered' 
            : 'Employee ID already exists'
        });
      }

      // Create new user
      const user = new User({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        employeeId: employeeId.toUpperCase().trim(),
        department,
        phone: phone?.trim(),
        role: role || 'employee' // Default to employee if no role specified
      });

      // Generate email verification token
      const verificationToken = user.generateEmailVerificationToken();

      // Save user
      await user.save();

      // Send welcome and verification emails
      try {
        await Promise.all([
          emailService.sendWelcomeEmail(user),
          emailService.sendEmailVerification(user, verificationToken)
        ]);
      } catch (emailError) {
        console.warn('Email sending failed:', emailError.message);
        // Don't fail registration if email fails
      }

      // Remove password from response
      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.refreshTokens;
      delete userResponse.emailVerificationToken;

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Account created successfully! Please check your email to verify your account.',
        data: {
          user: userResponse
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Registration failed. Please try again.'
      });
    }
  }

  // Login user
  async login(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, password, remember = false } = req.body;

      // Find user and include password field
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

      if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Account has been deactivated. Please contact support.'
        });
      }

      // Email verification requirement (configurable by environment)
      const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
      
      if (requireEmailVerification && user.role === 'employee' && !user.isEmailVerified) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
          requiresEmailVerification: true,
          email: user.email
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Update last login
      user.lastLogin = new Date();

      // Generate tokens
      const accessToken = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();

      // Save user with new refresh token
      await user.save();

      // Prepare role-based user data for response
      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.refreshTokens;
      delete userResponse.emailVerificationToken;
      delete userResponse.passwordResetToken;

      // Add role-specific permissions and capabilities
      const permissions = {
        canAccessEmployeeDashboard: user.role === 'employee',
        canAccessHRDashboard: ['hr', 'admin'].includes(user.role),
        canAccessAdminDashboard: user.role === 'admin',
        canManageUsers: ['hr', 'admin'].includes(user.role),
        canViewAnalytics: ['hr', 'admin'].includes(user.role),
        canManageSystem: user.role === 'admin',
        requiresCheckIn: user.role === 'employee',
        requiresOnboarding: user.role === 'employee' && !user.onboarding.completed,
        canSendMessages: ['hr', 'admin'].includes(user.role),
        canManageRewards: ['hr', 'admin'].includes(user.role),
        canViewTeamData: ['hr', 'admin'].includes(user.role) || (user.role === 'manager'),
        canCreateSurveys: ['hr', 'admin'].includes(user.role),
        canCreateChallenges: ['hr', 'admin'].includes(user.role)
      };

      // Account status and required actions
      const accountStatus = {
        needsEmailVerification: !user.isEmailVerified,
        needsOnboarding: user.role === 'employee' && !user.onboarding.completed,
        isFirstLogin: !user.lastLogin || (user.createdAt.getTime() === user.lastLogin.getTime()),
        emailVerified: user.isEmailVerified,
        onboardingCompleted: user.onboarding.completed
      };

      // Determine next required actions
      const nextActions = [];
      if (!user.isEmailVerified) {
        nextActions.push({
          action: 'VERIFY_EMAIL',
          priority: 'high',
          message: 'Please verify your email address to access all features',
          redirectTo: '/verify-email',
          blocking: user.role === 'employee' // Only blocking for employees
        });
      } else if (user.role === 'employee' && !user.onboarding.completed) {
        nextActions.push({
          action: 'COMPLETE_ONBOARDING',
          priority: 'high',
          message: 'Complete your wellness profile to get started',
          redirectTo: '/onboarding',
          blocking: true
        });
      }

      // Role-specific dashboard recommendations
      let recommendedDashboard = '/dashboard';
      if (user.role === 'admin') {
        recommendedDashboard = '/admin/dashboard';
      } else if (user.role === 'hr') {
        recommendedDashboard = '/hr/dashboard';
      } else if (user.role === 'employee') {
        recommendedDashboard = '/employee/dashboard';
      }

      // Set cookie options
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 1 day
      };

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', refreshToken, cookieOptions);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          accessToken,
          tokenType: 'Bearer',
          expiresIn: process.env.JWT_EXPIRE,
          permissions,
          accountStatus,
          nextActions,
          recommendedDashboard
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Login failed. Please try again.'
      });
    }
  }

  // Refresh access token
  async refreshToken(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Refresh token not provided'
        });
      }

      // This middleware handles token verification
      const { user } = req;

      // Generate new access token
      const newAccessToken = user.generateAuthToken();

      // Optionally generate new refresh token for security
      const newRefreshToken = user.generateRefreshToken();

      // Remove old refresh token
      user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);

      await user.save();

      // Set new refresh token cookie
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      };

      res.cookie('refreshToken', newRefreshToken, cookieOptions);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken,
          tokenType: 'Bearer',
          expiresIn: process.env.JWT_EXPIRE
        }
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Token refresh failed'
      });
    }
  }

  // Logout user
  async logout(req, res) {
    try {
      // Since we're not using refresh tokens in the frontend,
      // we'll just return success. The frontend will handle clearing
      // the access token from localStorage.
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }

  // Verify email address
  async verifyEmail(req, res) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      // Hash the token to compare with stored hash
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // First check if user with this token exists
      const userWithToken = await User.findOne({
        emailVerificationToken: hashedToken
      });

      // If no user found with this token, check if maybe it's already been used
      if (!userWithToken) {
        // Check if we can find a user who might have used this token recently
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      // Check if email is already verified
      if (userWithToken.isEmailVerified) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Email is already verified'
        });
      }

      // Check if token has expired
      if (userWithToken.emailVerificationExpires < Date.now()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Verification token has expired'
        });
      }

      const user = userWithToken;

      // Mark email as verified
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;

      await user.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Email verified successfully! You can now access all features.'
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Email verification failed'
      });
    }
  }

  // Resend email verification
  async resendEmailVerification(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Email is required'
        });
      }

      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.isEmailVerified) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      // Generate new verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send verification email
      try {
        await emailService.sendEmailVerification(user, verificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Failed to send verification email'
        });
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to resend verification email'
      });
    }
  }

  // Request password reset
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Email is required'
        });
      }

      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        // Don't reveal if email exists for security
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }

      // Generate password reset token
      const resetToken = user.generatePasswordResetToken();
      await user.save();

      // Send password reset email
      try {
        await emailService.sendPasswordResetEmail(user, resetToken);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Reset the token fields if email fails
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Failed to send password reset email'
        });
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Password reset request failed'
      });
    }
  }

  // Reset password with token
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Token and new password are required'
        });
      }

      // Hash the token to compare with stored hash
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find user with matching token and check expiration
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Set new password
      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      // Clear all refresh tokens for security
      user.refreshTokens = [];

      await user.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.'
      });

    } catch (error) {
      console.error('Password reset error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Password reset failed'
      });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const user = req.user;

      const userProfile = {
        id: user._id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        department: user.department,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        onboarding: user.onboarding,
        demographics: user.demographics,
        employment: user.employment,
        personality: user.personality,
        wellness: user.wellness,
        notifications: user.notifications,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      };

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          user: userProfile
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch profile'
      });
    }
  }
}

module.exports = new AuthController();