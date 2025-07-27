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

module.exports = router;