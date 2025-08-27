const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateSurvey, validateSurveyResponse, validateSurveyDistribution } = require('../middleware/validation/surveyValidation');

router.use(authenticate);

router.get('/templates', surveyController.getPulseSurveyTemplates);

router.get('/active', surveyController.getActiveSurveysForUser);

router.get('/', surveyController.getAllSurveys);

router.post('/', authorize(['hr', 'admin']), validateSurvey, surveyController.createSurvey);

router.get('/:id', surveyController.getSurvey);

router.put('/:id', authorize(['hr', 'admin']), surveyController.updateSurvey);

router.delete('/:id', authorize(['hr', 'admin']), surveyController.deleteSurvey);

router.post('/:id/respond', validateSurveyResponse, surveyController.submitSurveyResponse);

router.get('/:id/analytics', authorize(['hr', 'admin']), surveyController.getSurveyAnalytics);

router.patch('/:id/status', authorize(['hr', 'admin']), surveyController.updateSurveyStatus);

// Survey distribution endpoints (HR/Admin only)
router.post('/:id/distribute', authorize(['hr', 'admin']), validateSurveyDistribution, surveyController.distributeSurvey);

router.get('/:id/distribution-history', authorize(['hr', 'admin']), surveyController.getSurveyDistributionHistory);

module.exports = router;