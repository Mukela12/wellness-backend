const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateChallenge, validateChallengeProgress } = require('../middleware/validation/challengeValidation');

router.use(authenticate);

router.get('/templates', challengeController.getChallengeTemplates);

router.get('/active', challengeController.getActiveChallenges);

router.get('/my-challenges', challengeController.getUserChallenges);

router.get('/', challengeController.getAllChallenges);

router.post('/', authorize(['hr', 'admin', 'manager']), validateChallenge, challengeController.createChallenge);

router.get('/:id', challengeController.getChallenge);

router.put('/:id', authorize(['hr', 'admin', 'manager']), challengeController.updateChallenge);

router.delete('/:id', authorize(['hr', 'admin', 'manager']), challengeController.deleteChallenge);

router.post('/:id/join', challengeController.joinChallenge);

router.post('/:id/leave', challengeController.leaveChallenge);

router.post('/:id/progress', validateChallengeProgress, challengeController.updateProgress);

router.get('/:id/leaderboard', challengeController.getLeaderboard);

router.get('/:id/analytics', authorize(['hr', 'admin', 'manager']), challengeController.getChallengeAnalytics);

router.patch('/:id/status', authorize(['hr', 'admin', 'manager']), challengeController.updateChallengeStatus);

module.exports = router;