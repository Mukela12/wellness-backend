const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboard.controller');
const { authenticate } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get global Happy Coins leaderboard
router.get('/happy-coins', leaderboardController.getHappyCoinsLeaderboard);

// Get department-specific leaderboard
router.get('/department/:department', leaderboardController.getDepartmentLeaderboard);

// Get leaderboard statistics
router.get('/stats', leaderboardController.getLeaderboardStats);

// Get user's ranking and nearby users
router.get('/user/:userId?', leaderboardController.getUserRanking);

module.exports = router;