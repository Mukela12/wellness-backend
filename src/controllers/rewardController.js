const { Reward, Redemption, Achievement, UserAchievement, Recognition } = require('../models/Reward');
const User = require('../models/User');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');
const mongoose = require('mongoose');

const rewardController = {
  // =====================
  // Reward Catalog Management
  // =====================
  async createReward(req, res) {
    try {
      const {
        name,
        description,
        category,
        type,
        cost,
        value,
        merchant,
        availability,
        redemptionDetails,
        images,
        tags,
        featured,
        sortOrder
      } = req.body;

      const reward = new Reward({
        name,
        description,
        category,
        type,
        cost,
        value,
        merchant,
        availability,
        redemptionDetails,
        images,
        tags,
        featured,
        sortOrder
      });

      await reward.save();

      sendSuccessResponse(res, {
        message: 'Reward created successfully',
        data: { reward }
      }, 201);
    } catch (error) {
      console.error('Error creating reward:', error);
      sendErrorResponse(res, 'Failed to create reward', 500);
    }
  },

  async getAllRewards(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        type,
        featured,
        search,
        sortBy = 'sortOrder',
        sortOrder = 'asc',
        minCost,
        maxCost
      } = req.query;

      const skip = (page - 1) * limit;
      const query = { 'availability.isActive': true };

      if (category) query.category = category;
      if (type) query.type = type;
      if (featured !== undefined) query.featured = featured === 'true';

      if (minCost || maxCost) {
        query.cost = {};
        if (minCost) query.cost.$gte = parseInt(minCost);
        if (maxCost) query.cost.$lte = parseInt(maxCost);
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } },
          { 'merchant.name': { $regex: search, $options: 'i' } }
        ];
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const rewards = await Reward.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      const user = await User.findById(req.user.id);
      const userHappyCoins = user.wellness.happyCoins || 0;

      const rewardsWithAffordability = rewards.map(reward => ({
        ...reward.toObject(),
        canAfford: reward.canUserAfford(userHappyCoins),
        isAvailable: reward.isAvailable
      }));

      const total = await Reward.countDocuments(query);

      sendSuccessResponse(res, {
        message: 'Rewards retrieved successfully',
        data: {
          rewards: rewardsWithAffordability,
          userHappyCoins,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total,
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Error fetching rewards:', error);
      sendErrorResponse(res, 'Failed to fetch rewards', 500);
    }
  },

  async getReward(req, res) {
    try {
      const { id } = req.params;

      const reward = await Reward.findById(id);

      if (!reward) {
        return sendErrorResponse(res, 'Reward not found', 404);
      }

      const user = await User.findById(req.user.id);
      const userHappyCoins = user.wellness.happyCoins || 0;

      const rewardData = {
        ...reward.toObject(),
        canAfford: reward.canUserAfford(userHappyCoins),
        isAvailable: reward.isAvailable
      };

      sendSuccessResponse(res, {
        message: 'Reward retrieved successfully',
        data: {
          reward: rewardData,
          userHappyCoins
        }
      });
    } catch (error) {
      console.error('Error fetching reward:', error);
      sendErrorResponse(res, 'Failed to fetch reward', 500);
    }
  },

  async updateReward(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const reward = await Reward.findById(id);

      if (!reward) {
        return sendErrorResponse(res, 'Reward not found', 404);
      }

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          reward[key] = updates[key];
        }
      });

      await reward.save();

      sendSuccessResponse(res, {
        message: 'Reward updated successfully',
        data: { reward }
      });
    } catch (error) {
      console.error('Error updating reward:', error);
      sendErrorResponse(res, 'Failed to update reward', 500);
    }
  },

  async deleteReward(req, res) {
    try {
      const { id } = req.params;

      const reward = await Reward.findById(id);

      if (!reward) {
        return sendErrorResponse(res, 'Reward not found', 404);
      }

      const activeRedemptions = await Redemption.countDocuments({
        rewardId: id,
        status: { $in: ['pending', 'approved'] }
      });

      if (activeRedemptions > 0) {
        return sendErrorResponse(res, 'Cannot delete reward with active redemptions', 400);
      }

      await Reward.findByIdAndDelete(id);

      sendSuccessResponse(res, {
        message: 'Reward deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting reward:', error);
      sendErrorResponse(res, 'Failed to delete reward', 500);
    }
  },

  async getFeaturedRewards(req, res) {
    try {
      const { limit = 6 } = req.query;

      const rewards = await Reward.getFeaturedRewards(parseInt(limit));

      const user = await User.findById(req.user.id);
      const userHappyCoins = user.wellness.happyCoins || 0;

      const rewardsWithAffordability = rewards.map(reward => ({
        ...reward.toObject(),
        canAfford: reward.canUserAfford(userHappyCoins),
        isAvailable: reward.isAvailable
      }));

      sendSuccessResponse(res, {
        message: 'Featured rewards retrieved successfully',
        data: {
          rewards: rewardsWithAffordability,
          userHappyCoins
        }
      });
    } catch (error) {
      console.error('Error fetching featured rewards:', error);
      sendErrorResponse(res, 'Failed to fetch featured rewards', 500);
    }
  },

  async getRewardsByCategory(req, res) {
    try {
      const { category } = req.params;
      const { page = 1, limit = 20, sortBy = 'sortOrder' } = req.query;

      const rewards = await Reward.getByCategory(category, {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy
      });

      const user = await User.findById(req.user.id);
      const userHappyCoins = user.wellness.happyCoins || 0;

      const rewardsWithAffordability = rewards.map(reward => ({
        ...reward.toObject(),
        canAfford: reward.canUserAfford(userHappyCoins),
        isAvailable: reward.isAvailable
      }));

      const total = await Reward.countDocuments({
        category,
        'availability.isActive': true
      });

      sendSuccessResponse(res, {
        message: `Rewards in ${category} category retrieved successfully`,
        data: {
          rewards: rewardsWithAffordability,
          category,
          userHappyCoins,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total
          }
        }
      });
    } catch (error) {
      console.error('Error fetching rewards by category:', error);
      sendErrorResponse(res, 'Failed to fetch rewards by category', 500);
    }
  },

  // =====================
  // Redemption System
  // =====================
  async redeemReward(req, res) {
    try {
      const { id } = req.params;
      const { fulfillmentMethod, address, email, phone, notes } = req.body;

      const reward = await Reward.findById(id);

      if (!reward) {
        return sendErrorResponse(res, 'Reward not found', 404);
      }

      if (!reward.isAvailable) {
        return sendErrorResponse(res, 'Reward is not available for redemption', 400);
      }

      const user = await User.findById(req.user.id);

      if (!reward.canUserAfford(user.wellness.happyCoins)) {
        return sendErrorResponse(res, 'Insufficient Happy Coins', 400);
      }

      if (reward.availability.quantity > 0) {
        reward.availability.quantity -= 1;
      }

      const redemption = new Redemption({
        userId: req.user.id,
        rewardId: id,
        reward: {
          name: reward.name,
          category: reward.category,
          cost: reward.cost,
          value: reward.value
        },
        happyCoinsSpent: reward.cost,
        fulfillment: {
          method: fulfillmentMethod,
          address,
          email,
          phone,
          notes
        }
      });

      redemption.generateRedemptionCode();

      if (reward.redemptionDetails.expiryDays) {
        redemption.voucherDetails.expiryDate = redemption.calculateExpiryDate(
          reward.redemptionDetails.expiryDays
        );
      }

      user.wellness.happyCoins -= reward.cost;
      reward.analytics.totalRedemptions += 1;

      await Promise.all([
        redemption.save(),
        user.save(),
        reward.save()
      ]);

      sendSuccessResponse(res, {
        message: 'Reward redeemed successfully',
        data: {
          redemption: {
            id: redemption._id,
            redemptionCode: redemption.redemptionCode,
            status: redemption.status,
            happyCoinsSpent: redemption.happyCoinsSpent,
            expiryDate: redemption.voucherDetails.expiryDate
          },
          remainingHappyCoins: user.wellness.happyCoins
        }
      });
    } catch (error) {
      console.error('Error redeeming reward:', error);
      sendErrorResponse(res, 'Failed to redeem reward', 500);
    }
  },

  async getUserRedemptions(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const skip = (page - 1) * limit;

      const query = { userId: req.user.id };
      if (status) query.status = status;

      const redemptions = await Redemption.find(query)
        .populate('rewardId', 'name category type images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Redemption.countDocuments(query);

      sendSuccessResponse(res, {
        message: 'User redemptions retrieved successfully',
        data: {
          redemptions,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total
          }
        }
      });
    } catch (error) {
      console.error('Error fetching user redemptions:', error);
      sendErrorResponse(res, 'Failed to fetch user redemptions', 500);
    }
  },

  async getRedemption(req, res) {
    try {
      const { id } = req.params;

      const redemption = await Redemption.findById(id)
        .populate('userId', 'name email')
        .populate('rewardId', 'name description category type merchant');

      if (!redemption) {
        return sendErrorResponse(res, 'Redemption not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' &&
          redemption.userId._id.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      sendSuccessResponse(res, {
        message: 'Redemption retrieved successfully',
        data: { redemption }
      });
    } catch (error) {
      console.error('Error fetching redemption:', error);
      sendErrorResponse(res, 'Failed to fetch redemption', 500);
    }
  },

  async updateRedemptionStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;

      if (!['pending', 'approved', 'fulfilled', 'expired', 'cancelled'].includes(status)) {
        return sendErrorResponse(res, 'Invalid status', 400);
      }

      const redemption = await Redemption.findById(id);

      if (!redemption) {
        return sendErrorResponse(res, 'Redemption not found', 404);
      }

      const oldStatus = redemption.status;
      redemption.status = status;
      
      if (adminNotes) {
        redemption.adminNotes = adminNotes;
      }

      switch (status) {
        case 'approved':
          redemption.timeline.approvedAt = new Date();
          break;
        case 'fulfilled':
          redemption.timeline.fulfilledAt = new Date();
          break;
        case 'expired':
          redemption.timeline.expiredAt = new Date();
          break;
        case 'cancelled':
          redemption.timeline.cancelledAt = new Date();
          
          const user = await User.findById(redemption.userId);
          if (user) {
            user.wellness.happyCoins += redemption.happyCoinsSpent;
            await user.save();
          }
          break;
      }

      await redemption.save();

      sendSuccessResponse(res, {
        message: `Redemption status updated from ${oldStatus} to ${status}`,
        data: {
          redemptionId: redemption._id,
          oldStatus,
          newStatus: status
        }
      });
    } catch (error) {
      console.error('Error updating redemption status:', error);
      sendErrorResponse(res, 'Failed to update redemption status', 500);
    }
  },

  async rateRedemption(req, res) {
    try {
      const { id } = req.params;
      const { rating, feedback } = req.body;

      if (rating < 1 || rating > 5) {
        return sendErrorResponse(res, 'Rating must be between 1 and 5', 400);
      }

      const redemption = await Redemption.findById(id);

      if (!redemption) {
        return sendErrorResponse(res, 'Redemption not found', 404);
      }

      if (redemption.userId.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      if (redemption.status !== 'fulfilled') {
        return sendErrorResponse(res, 'Can only rate fulfilled redemptions', 400);
      }

      redemption.rating = {
        score: rating,
        feedback: feedback || '',
        ratedAt: new Date()
      };

      await redemption.save();

      const reward = await Reward.findById(redemption.rewardId);
      if (reward) {
        const totalRating = (reward.analytics.averageRating * reward.analytics.totalRatings) + rating;
        reward.analytics.totalRatings += 1;
        reward.analytics.averageRating = totalRating / reward.analytics.totalRatings;
        await reward.save();
      }

      sendSuccessResponse(res, {
        message: 'Redemption rated successfully',
        data: {
          redemptionId: redemption._id,
          rating: redemption.rating
        }
      });
    } catch (error) {
      console.error('Error rating redemption:', error);
      sendErrorResponse(res, 'Failed to rate redemption', 500);
    }
  },

  // =====================
  // Achievement System
  // =====================
  async createAchievement(req, res) {
    try {
      const {
        name,
        description,
        category,
        icon,
        criteria,
        rarity,
        happyCoinsReward,
        sortOrder,
        isActive
      } = req.body;

      const achievement = new Achievement({
        name,
        description,
        category,
        icon,
        criteria,
        rarity,
        happyCoinsReward,
        sortOrder,
        isActive
      });

      await achievement.save();

      sendSuccessResponse(res, {
        message: 'Achievement created successfully',
        data: { achievement }
      }, 201);
    } catch (error) {
      console.error('Error creating achievement:', error);
      sendErrorResponse(res, 'Failed to create achievement', 500);
    }
  },

  async getAllAchievements(req, res) {
    try {
      const { category, rarity, isActive = true } = req.query;

      const query = { isActive };
      if (category) query.category = category;
      if (rarity) query.rarity = rarity;

      const achievements = await Achievement.find(query)
        .sort({ rarity: 1, sortOrder: 1 });

      const userAchievements = await UserAchievement.find({
        userId: req.user.id
      }).select('achievementId earnedAt');

      const achievementMap = userAchievements.reduce((map, ua) => {
        map[ua.achievementId.toString()] = ua;
        return map;
      }, {});

      const achievementsWithStatus = achievements.map(achievement => ({
        ...achievement.toObject(),
        isEarned: !!achievementMap[achievement._id.toString()],
        earnedAt: achievementMap[achievement._id.toString()]?.earnedAt || null
      }));

      sendSuccessResponse(res, {
        message: 'Achievements retrieved successfully',
        data: {
          achievements: achievementsWithStatus,
          earnedCount: userAchievements.length,
          totalCount: achievements.length
        }
      });
    } catch (error) {
      console.error('Error fetching achievements:', error);
      sendErrorResponse(res, 'Failed to fetch achievements', 500);
    }
  },

  async getUserAchievements(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const userAchievements = await UserAchievement.find({
        userId: req.user.id
      })
      .populate('achievementId')
      .sort({ earnedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

      const total = await UserAchievement.countDocuments({
        userId: req.user.id
      });

      sendSuccessResponse(res, {
        message: 'User achievements retrieved successfully',
        data: {
          achievements: userAchievements,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total
          }
        }
      });
    } catch (error) {
      console.error('Error fetching user achievements:', error);
      sendErrorResponse(res, 'Failed to fetch user achievements', 500);
    }
  },

  // =====================
  // Peer Recognition System
  // =====================
  async sendRecognition(req, res) {
    try {
      const { toUserId, type, message, category, visibility, isAnonymous } = req.body;

      if (req.user.id === toUserId) {
        return sendErrorResponse(res, 'Cannot recognize yourself', 400);
      }

      const recipient = await User.findById(toUserId);
      if (!recipient) {
        return sendErrorResponse(res, 'Recipient not found', 404);
      }

      const recognition = new Recognition({
        fromUserId: req.user.id,
        toUserId,
        type,
        message,
        category,
        visibility,
        isAnonymous
      });

      await recognition.save();

      recipient.wellness.happyCoins += recognition.value.happyCoins;
      await recipient.save();

      sendSuccessResponse(res, {
        message: 'Recognition sent successfully',
        data: {
          recognition: {
            id: recognition._id,
            type: recognition.type,
            happyCoinsAwarded: recognition.value.happyCoins
          },
          recipientHappyCoins: recipient.wellness.happyCoins
        }
      }, 201);
    } catch (error) {
      console.error('Error sending recognition:', error);
      sendErrorResponse(res, 'Failed to send recognition', 500);
    }
  },

  async getUserRecognitions(req, res) {
    try {
      const { page = 1, limit = 20, type = 'received' } = req.query;
      const skip = (page - 1) * limit;

      const query = type === 'received' 
        ? { toUserId: req.user.id }
        : { fromUserId: req.user.id };

      const recognitions = await Recognition.find(query)
        .populate('fromUserId', 'name')
        .populate('toUserId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Recognition.countDocuments(query);

      sendSuccessResponse(res, {
        message: `${type} recognitions retrieved successfully`,
        data: {
          recognitions,
          type,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total
          }
        }
      });
    } catch (error) {
      console.error('Error fetching user recognitions:', error);
      sendErrorResponse(res, 'Failed to fetch user recognitions', 500);
    }
  },

  async getTeamRecognitions(req, res) {
    try {
      const { page = 1, limit = 20, visibility = 'team' } = req.query;
      const skip = (page - 1) * limit;

      const user = await User.findById(req.user.id);
      
      const query = {
        visibility: { $in: ['public', visibility] }
      };

      if (visibility === 'team') {
        const departmentUsers = await User.find({
          department: user.department
        }).select('_id');
        
        const userIds = departmentUsers.map(u => u._id);
        query.$or = [
          { toUserId: { $in: userIds } },
          { fromUserId: { $in: userIds } }
        ];
      }

      const recognitions = await Recognition.find(query)
        .populate('fromUserId', 'name department')
        .populate('toUserId', 'name department')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Recognition.countDocuments(query);

      sendSuccessResponse(res, {
        message: 'Team recognitions retrieved successfully',
        data: {
          recognitions,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total
          }
        }
      });
    } catch (error) {
      console.error('Error fetching team recognitions:', error);
      sendErrorResponse(res, 'Failed to fetch team recognitions', 500);
    }
  },

  async getRewardCategories(req, res) {
    try {
      const categories = [
        {
          id: 'wellness',
          name: 'Wellness & Health',
          description: 'Health and wellness related rewards',
          icon: '🏥'
        },
        {
          id: 'food',
          name: 'Food & Beverages',
          description: 'Restaurant vouchers and food delivery credits',
          icon: '🍽️'
        },
        {
          id: 'entertainment',
          name: 'Entertainment',
          description: 'Movies, concerts, and entertainment experiences',
          icon: '🎬'
        },
        {
          id: 'fitness',
          name: 'Fitness & Sports',
          description: 'Gym memberships and fitness equipment',
          icon: '💪'
        },
        {
          id: 'education',
          name: 'Education & Learning',
          description: 'Courses, books, and learning materials',
          icon: '📚'
        },
        {
          id: 'merchandise',
          name: 'Company Merchandise',
          description: 'Branded items and company swag',
          icon: '👕'
        },
        {
          id: 'experience',
          name: 'Experiences',
          description: 'Travel, activities, and unique experiences',
          icon: '🎯'
        },
        {
          id: 'donation',
          name: 'Charity Donations',
          description: 'Donate Happy Coins to charitable causes',
          icon: '❤️'
        }
      ];

      for (const category of categories) {
        const count = await Reward.countDocuments({
          category: category.id,
          'availability.isActive': true
        });
        category.rewardCount = count;
      }

      sendSuccessResponse(res, {
        message: 'Reward categories retrieved successfully',
        data: { categories }
      });
    } catch (error) {
      console.error('Error fetching reward categories:', error);
      sendErrorResponse(res, 'Failed to fetch reward categories', 500);
    }
  }
};

module.exports = rewardController;