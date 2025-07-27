const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboarding.controller');
const { authenticate } = require('../middleware/auth');
const { validateOnboarding } = require('../middleware/validation');

/**
 * @route   GET /api/onboarding/questionnaire
 * @desc    Get the onboarding questionnaire
 * @access  Private
 */
router.get(
  '/questionnaire',
  authenticate,
  onboardingController.getQuestionnaire
);

/**
 * @route   POST /api/onboarding/submit
 * @desc    Submit onboarding questionnaire responses
 * @access  Private
 * @body    {answers: Object, sectionCompleted?: String}
 */
router.post(
  '/submit',
  authenticate,
  validateOnboarding,
  onboardingController.submitAnswers
);

/**
 * @route   GET /api/onboarding/status
 * @desc    Get onboarding completion status and insights
 * @access  Private
 */
router.get(
  '/status',
  authenticate,
  onboardingController.getStatus
);

module.exports = router;