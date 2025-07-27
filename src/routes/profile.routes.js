const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { authenticate } = require('../middleware/auth');
const { 
  validateProfileUpdate, 
  validatePreferences,
  validateWellnessStats,
  validateAccountDeletion
} = require('../middleware/validation');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/avatars';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `avatar-${req.user.id}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

/**
 * @route   PUT /api/profile
 * @desc    Update user profile information
 * @access  Private
 * @body    {name?, phone?, department?}
 */
router.put(
  '/',
  authenticate,
  validateProfileUpdate,
  profileController.updateProfile
);

/**
 * @route   PUT /api/profile/preferences
 * @desc    Update user preferences (notifications, personality)
 * @access  Private
 * @body    {notifications?, personality?}
 */
router.put(
  '/preferences',
  authenticate,
  validatePreferences,
  profileController.updatePreferences
);

/**
 * @route   POST /api/profile/avatar
 * @desc    Upload user avatar
 * @access  Private
 * @form    avatar (image file)
 */
router.post(
  '/avatar',
  authenticate,
  (req, res, next) => {
    upload.single('avatar')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 5MB.'
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      next();
    });
  },
  profileController.uploadAvatar
);

/**
 * @route   GET /api/profile/wellness-stats
 * @desc    Get comprehensive wellness statistics
 * @access  Private
 * @query   {period?} - Number of days to analyze (default: 30, max: 365)
 */
router.get(
  '/wellness-stats',
  authenticate,
  validateWellnessStats,
  profileController.getWellnessStats
);

/**
 * @route   DELETE /api/profile/account
 * @desc    Deactivate user account (soft delete)
 * @access  Private
 * @body    {password} - Current password for confirmation
 */
router.delete(
  '/account',
  authenticate,
  validateAccountDeletion,
  profileController.deleteAccount
);

module.exports = router;