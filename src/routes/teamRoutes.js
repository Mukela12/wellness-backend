const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.use(authorize(['manager', 'hr', 'admin']));

router.get('/overview', teamController.getTeamOverview);

router.get('/mood-trend', teamController.getTeamMoodTrend);

router.get('/risk-assessment', teamController.getTeamRiskAssessment);

router.get('/survey-participation', teamController.getTeamSurveyParticipation);

router.get('/engagement', teamController.getTeamEngagementMetrics);

module.exports = router;