const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/rewardController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateReward, validateRedemption, validateRecognition, validateAchievement } = require('../middleware/validation/rewardValidation');

router.use(authenticate);

// =====================
// Reward Catalog Routes
// =====================
router.get('/categories', rewardController.getRewardCategories);

router.get('/featured', rewardController.getFeaturedRewards);

router.get('/category/:category', rewardController.getRewardsByCategory);

router.get('/', rewardController.getAllRewards);

router.post('/', authorize(['hr', 'admin']), validateReward, rewardController.createReward);

router.get('/:id', rewardController.getReward);

router.put('/:id', authorize(['hr', 'admin']), rewardController.updateReward);

router.delete('/:id', authorize(['hr', 'admin']), rewardController.deleteReward);

// =====================
// Redemption Routes
// =====================
router.post('/:id/redeem', validateRedemption, rewardController.redeemReward);

router.get('/redemptions/my-redemptions', rewardController.getUserRedemptions);

router.get('/redemptions/:id', rewardController.getRedemption);

router.patch('/redemptions/:id/status', authorize(['hr', 'admin']), rewardController.updateRedemptionStatus);

router.post('/redemptions/:id/rate', rewardController.rateRedemption);

// =====================
// Achievement Routes
// =====================
router.get('/achievements/all', rewardController.getAllAchievements);

router.get('/achievements/my-achievements', rewardController.getUserAchievements);

router.post('/achievements', authorize(['hr', 'admin']), validateAchievement, rewardController.createAchievement);

// =====================
// Recognition Routes
// =====================
router.post('/recognitions/send', validateRecognition, rewardController.sendRecognition);

router.get('/recognitions/my-recognitions', rewardController.getUserRecognitions);

router.get('/recognitions/team', rewardController.getTeamRecognitions);

module.exports = router;