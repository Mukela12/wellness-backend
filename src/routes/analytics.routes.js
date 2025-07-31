const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth');
const { validateDateRange, validateListQuery } = require('../middleware/validation');

/**
 * @route   GET /api/analytics/company-overview
 * @desc    Get company-wide wellness overview (HR/Admin only)
 * @access  Private (HR/Admin)
 * @query   {startDate?, endDate?}
 */
router.get(
  '/company-overview',
  authenticate,
  validateDateRange,
  analyticsController.getCompanyOverview
);

/**
 * @route   GET /api/analytics/department/:department
 * @desc    Get department-specific analytics (HR/Admin only)
 * @access  Private (HR/Admin)
 * @params  {department} - Department name
 * @query   {startDate?, endDate?, includeIndividuals?}
 */
router.get(
  '/department/:department',
  authenticate,
  validateDateRange,
  analyticsController.getDepartmentAnalytics
);

/**
 * @route   GET /api/analytics/risk-assessment
 * @desc    Get risk assessment report for at-risk employees (HR/Admin only)
 * @access  Private (HR/Admin)
 * @query   {riskLevel?, department?}
 */
router.get(
  '/risk-assessment',
  authenticate,
  validateListQuery,
  analyticsController.getRiskAssessment
);

/**
 * @route   GET /api/analytics/engagement
 * @desc    Get engagement metrics and trends (HR/Admin only)
 * @access  Private (HR/Admin)
 * @query   {period?} - Number of days to analyze (default: 30)
 */
router.get(
  '/engagement',
  authenticate,
  analyticsController.getEngagementMetrics
);

/**
 * @route   GET /api/analytics/export
 * @desc    Export analytics data (HR/Admin only)
 * @access  Private (HR/Admin)
 * @query   {format?, type?, startDate?, endDate?}
 */
router.get(
  '/export',
  authenticate,
  validateDateRange,
  analyticsController.exportAnalytics
);

/**
 * @route   GET /api/analytics/demographics
 * @desc    Get demographics analytics (HR/Admin only)
 * @access  Private (HR/Admin)
 * @query   {department?, startDate?, endDate?}
 */
router.get(
  '/demographics',
  authenticate,
  validateDateRange,
  analyticsController.getDemographicsAnalytics
);

/**
 * @route   GET /api/analytics/enps
 * @desc    Calculate Employee Net Promoter Score (HR/Admin only)
 * @access  Private (HR/Admin)
 * @query   {startDate?, endDate?, department?, surveyId?}
 */
router.get(
  '/enps',
  authenticate,
  validateDateRange,
  analyticsController.calculateENPS
);

/**
 * @route   GET /api/analytics/engagement-comprehensive
 * @desc    Get comprehensive engagement metrics across all dimensions (HR/Admin only)
 * @access  Private (HR/Admin)
 * @query   {startDate?, endDate?, department?}
 */
router.get(
  '/engagement-comprehensive',
  authenticate,
  validateDateRange,
  analyticsController.getComprehensiveEngagementMetrics
);

/**
 * @route   GET /api/analytics/sentiment
 * @desc    Get sentiment analysis of text responses (HR/Admin only)
 * @access  Private (HR/Admin)
 * @query   {startDate?, endDate?, department?, surveyId?}
 */
router.get(
  '/sentiment',
  authenticate,
  validateDateRange,
  analyticsController.getSentimentAnalysis
);

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get advanced engagement dashboard combining all metrics (HR/Admin only)
 * @access  Private (HR/Admin)
 * @query   {startDate?, endDate?, department?}
 */
router.get(
  '/dashboard',
  authenticate,
  validateDateRange,
  analyticsController.getAdvancedEngagementDashboard
);

module.exports = router;