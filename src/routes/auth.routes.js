const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate, verifyRefreshToken } = require('../middleware/auth');
const {
  validateRegistration,
  validateLogin,
  validateEmail,
  validatePasswordReset,
  validateChangePassword
} = require('../middleware/validation');

const router = express.Router();

// Public routes (no authentication required)

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { name, email, password, employeeId, department, phone?, role? }
 */
router.post('/register', validateRegistration, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT token
 * @access  Public
 * @body    { email, password, remember? }
 */
router.post('/login', validateLogin, authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (but requires valid refresh token)
 * @body    { refreshToken? } or cookie
 */
router.post('/refresh', verifyRefreshToken, authController.refreshToken);

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify user's email address
 * @access  Public
 * @query   { token }
 */
router.get('/verify-email', authController.verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Public
 * @body    { email }
 */
router.post('/resend-verification', validateEmail, authController.resendEmailVerification);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 * @body    { email }
 */
router.post('/forgot-password', validateEmail, authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 * @body    { token, password }
 */
router.post('/reset-password', validatePasswordReset, authController.resetPassword);

// Protected routes (authentication required)

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Private
 * @body    { refreshToken? } or cookie
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password (when logged in)
 * @access  Private
 * @body    { currentPassword, newPassword, confirmPassword }
 */
router.post('/change-password', [authenticate, ...validateChangePassword], async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Set new password
    user.password = newPassword;
    
    // Clear all refresh tokens for security
    user.refreshTokens = [];
    
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again with your new password.'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all devices (invalidate all refresh tokens)
 * @access  Private
 */
router.post('/logout-all', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    // Clear all refresh tokens
    user.refreshTokens = [];
    await user.save();

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });

  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout from all devices'
    });
  }
});

/**
 * @route   DELETE /api/auth/account
 * @desc    Deactivate user account (soft delete)
 * @access  Private
 * @body    { password }
 */
router.delete('/account', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    const user = req.user;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to deactivate account'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Deactivate account
    user.isActive = false;
    user.refreshTokens = [];
    await user.save();

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('Account deactivation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate account'
    });
  }
});

module.exports = router;