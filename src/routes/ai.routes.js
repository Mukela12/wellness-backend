const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/ai/test
 * @desc    Test AI service connection
 * @access  Private (any authenticated user)
 */
router.get('/test', authenticate, aiController.testConnection);

/**
 * @route   GET /api/ai/insights
 * @desc    Get personalized AI-powered wellness insights
 * @access  Private (employee)
 */
router.get('/insights', authenticate, aiController.getPersonalizedInsights);

/**
 * @route   GET /api/ai/analyze/:checkInId
 * @desc    Analyze a specific check-in with AI
 * @access  Private (employee - own check-ins only)
 */
router.get('/analyze/:checkInId', authenticate, aiController.analyzeCheckIn);

/**
 * @route   GET /api/ai/summary/weekly
 * @desc    Generate AI-powered weekly wellness summary
 * @access  Private (employee)
 * @query   {weeks?} - Number of weeks to analyze (default: 1, max: 4)
 */
router.get('/summary/weekly', authenticate, aiController.getWeeklySummary);

/**
 * @route   GET /api/ai/risk-assessment/:userId
 * @desc    Generate AI-powered risk assessment for employee (HR/Admin only)
 * @access  Private (HR/Admin)
 */
router.get('/risk-assessment/:userId', authenticate, aiController.generateRiskAssessment);

/**
 * @route   GET /api/ai/status
 * @desc    Get AI service status and usage statistics
 * @access  Private (basic status for all users, detailed for HR/Admin)
 */
router.get('/status', authenticate, aiController.getServiceStatus);

module.exports = router;