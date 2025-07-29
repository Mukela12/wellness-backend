const User = require('../models/User');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');

const leaderboardController = {
  // Get global Happy Coins leaderboard
  async getHappyCoinsLeaderboard(req, res) {
    try {
      const { limit = 50, page = 1 } = req.query;
      const skip = (page - 1) * limit;

      // Get top users by Happy Coins
      const leaderboard = await User.find({
        role: 'employee',
        isActive: true
      })
      .select('name department avatar wellness.happyCoins createdAt')
      .sort({ 'wellness.happyCoins': -1 })
      .skip(skip)
      .limit(parseInt(limit));

      // Get current user's rank and coins
      let currentUserRank = null;
      let currentUserData = null;
      
      if (req.user && req.user.role === 'employee') {
        const currentUser = await User.findById(req.user.id)
          .select('name department avatar wellness.happyCoins');
        
        if (currentUser) {
          // Calculate user's rank
          const usersAbove = await User.countDocuments({
            role: 'employee',
            isActive: true,
            'wellness.happyCoins': { $gt: currentUser.wellness.happyCoins || 0 }
          });
          
          currentUserRank = usersAbove + 1;
          currentUserData = {
            ...currentUser.toObject(),
            rank: currentUserRank
          };
        }
      }

      // Add rank to each user in leaderboard
      const leaderboardWithRanks = leaderboard.map((user, index) => ({
        ...user.toObject(),
        rank: skip + index + 1,
        happyCoins: user.wellness?.happyCoins || 0
      }));

      // Get total user count for pagination
      const totalUsers = await User.countDocuments({
        role: 'employee',
        isActive: true
      });

      sendSuccessResponse(res, {
        message: 'Happy Coins leaderboard retrieved successfully',
        data: {
          leaderboard: leaderboardWithRanks,
          currentUser: currentUserData,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers,
            hasNext: page < Math.ceil(totalUsers / limit),
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Error fetching Happy Coins leaderboard:', error);
      sendErrorResponse(res, 'Failed to fetch leaderboard', 500);
    }
  },

  // Get department-specific Happy Coins leaderboard
  async getDepartmentLeaderboard(req, res) {
    try {
      const { department } = req.params;
      const { limit = 20 } = req.query;

      if (!department) {
        return sendErrorResponse(res, 'Department is required', 400);
      }

      // Get top users in the department by Happy Coins
      const leaderboard = await User.find({
        role: 'employee',
        isActive: true,
        department: department
      })
      .select('name department avatar wellness.happyCoins createdAt')
      .sort({ 'wellness.happyCoins': -1 })
      .limit(parseInt(limit));

      // Add rank to each user
      const leaderboardWithRanks = leaderboard.map((user, index) => ({
        ...user.toObject(),
        rank: index + 1,
        happyCoins: user.wellness?.happyCoins || 0
      }));

      // Get department stats
      const departmentStats = await User.aggregate([
        {
          $match: {
            role: 'employee',
            isActive: true,
            department: department
          }
        },
        {
          $group: {
            _id: null,
            totalEmployees: { $sum: 1 },
            totalHappyCoins: { $sum: '$wellness.happyCoins' },
            averageHappyCoins: { $avg: '$wellness.happyCoins' },
            maxHappyCoins: { $max: '$wellness.happyCoins' }
          }
        }
      ]);

      const stats = departmentStats[0] || {
        totalEmployees: 0,
        totalHappyCoins: 0,
        averageHappyCoins: 0,
        maxHappyCoins: 0
      };

      sendSuccessResponse(res, {
        message: `${department} department leaderboard retrieved successfully`,
        data: {
          department,
          leaderboard: leaderboardWithRanks,
          stats
        }
      });
    } catch (error) {
      console.error('Error fetching department leaderboard:', error);
      sendErrorResponse(res, 'Failed to fetch department leaderboard', 500);
    }
  },

  // Get leaderboard statistics
  async getLeaderboardStats(req, res) {
    try {
      // Get overall stats
      const overallStats = await User.aggregate([
        {
          $match: {
            role: 'employee',
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            totalEmployees: { $sum: 1 },
            totalHappyCoins: { $sum: '$wellness.happyCoins' },
            averageHappyCoins: { $avg: '$wellness.happyCoins' },
            maxHappyCoins: { $max: '$wellness.happyCoins' },
            minHappyCoins: { $min: '$wellness.happyCoins' }
          }
        }
      ]);

      // Get department stats
      const departmentStats = await User.aggregate([
        {
          $match: {
            role: 'employee',
            isActive: true
          }
        },
        {
          $group: {
            _id: '$department',
            employeeCount: { $sum: 1 },
            totalHappyCoins: { $sum: '$wellness.happyCoins' },
            averageHappyCoins: { $avg: '$wellness.happyCoins' },
            maxHappyCoins: { $max: '$wellness.happyCoins' }
          }
        },
        {
          $sort: { averageHappyCoins: -1 }
        }
      ]);

      // Get Happy Coins distribution
      const distribution = await User.aggregate([
        {
          $match: {
            role: 'employee',
            isActive: true
          }
        },
        {
          $bucket: {
            groupBy: '$wellness.happyCoins',
            boundaries: [0, 100, 300, 500, 1000, 2000, Infinity],
            default: 'Unknown',
            output: {
              count: { $sum: 1 },
              users: { $push: { name: '$name', happyCoins: '$wellness.happyCoins' } }
            }
          }
        }
      ]);

      const stats = overallStats[0] || {
        totalEmployees: 0,
        totalHappyCoins: 0,
        averageHappyCoins: 0,
        maxHappyCoins: 0,
        minHappyCoins: 0
      };

      sendSuccessResponse(res, {
        message: 'Leaderboard statistics retrieved successfully',
        data: {
          overall: stats,
          byDepartment: departmentStats,
          distribution,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching leaderboard stats:', error);
      sendErrorResponse(res, 'Failed to fetch leaderboard statistics', 500);
    }
  },

  // Get user's position and nearby rankings
  async getUserRanking(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      
      // Get user data
      const user = await User.findById(userId)
        .select('name department avatar wellness.happyCoins');

      if (!user) {
        return sendErrorResponse(res, 'User not found', 404);
      }

      // Calculate user's global rank
      const globalRank = await User.countDocuments({
        role: 'employee',
        isActive: true,
        'wellness.happyCoins': { $gt: user.wellness?.happyCoins || 0 }
      }) + 1;

      // Calculate user's department rank
      let departmentRank = null;
      if (user.department) {
        departmentRank = await User.countDocuments({
          role: 'employee',
          isActive: true,
          department: user.department,
          'wellness.happyCoins': { $gt: user.wellness?.happyCoins || 0 }
        }) + 1;
      }

      // Get users ranked around this user (5 above, 5 below)
      const userHappyCoins = user.wellness?.happyCoins || 0;
      
      const nearbyUsers = await User.find({
        role: 'employee',
        isActive: true
      })
      .select('name department avatar wellness.happyCoins')
      .sort({ 'wellness.happyCoins': -1 })
      .skip(Math.max(0, globalRank - 6))
      .limit(11);

      // Add ranks to nearby users
      const nearbyWithRanks = nearbyUsers.map((nearbyUser, index) => ({
        ...nearbyUser.toObject(),
        rank: Math.max(1, globalRank - 5) + index,
        happyCoins: nearbyUser.wellness?.happyCoins || 0,
        isCurrentUser: nearbyUser._id.toString() === userId
      }));

      sendSuccessResponse(res, {
        message: 'User ranking retrieved successfully',
        data: {
          user: {
            ...user.toObject(),
            happyCoins: user.wellness?.happyCoins || 0,
            globalRank,
            departmentRank
          },
          nearby: nearbyWithRanks
        }
      });
    } catch (error) {
      console.error('Error fetching user ranking:', error);
      sendErrorResponse(res, 'Failed to fetch user ranking', 500);
    }
  }
};

module.exports = leaderboardController;