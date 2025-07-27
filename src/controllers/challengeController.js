const Challenge = require('../models/Challenge');
const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');
const mongoose = require('mongoose');

const challengeController = {
  async createChallenge(req, res) {
    try {
      const {
        title,
        description,
        shortDescription,
        category,
        type,
        difficulty,
        duration,
        goal,
        rules,
        milestones,
        rewards,
        eligibility,
        maxParticipants,
        isPublic,
        tags,
        images,
        resources
      } = req.body;

      const challenge = new Challenge({
        title,
        description,
        shortDescription,
        category,
        type,
        difficulty,
        duration,
        goal,
        rules,
        milestones,
        rewards,
        eligibility,
        maxParticipants,
        isPublic,
        createdBy: req.user.id,
        tags,
        images,
        resources
      });

      await challenge.save();

      sendSuccessResponse(res, {
        message: 'Challenge created successfully',
        data: { challenge }
      }, 201);
    } catch (error) {
      console.error('Error creating challenge:', error);
      sendErrorResponse(res, 'Failed to create challenge', 500);
    }
  },

  async getAllChallenges(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        category, 
        difficulty, 
        type, 
        status,
        search 
      } = req.query;
      
      const skip = (page - 1) * limit;
      const query = {};

      if (category) query.category = category;
      if (difficulty) query.difficulty = difficulty;
      if (type) query.type = type;
      if (status) query.status = status;
      
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      if (req.user.role === 'employee') {
        query.$or = [
          { isPublic: true },
          { 'participants.userId': req.user.id },
          { createdBy: req.user.id }
        ];
      }

      const challenges = await Challenge.find(query)
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Challenge.countDocuments(query);

      sendSuccessResponse(res, {
        message: 'Challenges retrieved successfully',
        data: {
          challenges,
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
      console.error('Error fetching challenges:', error);
      sendErrorResponse(res, 'Failed to fetch challenges', 500);
    }
  },

  async getChallenge(req, res) {
    try {
      const { id } = req.params;

      const challenge = await Challenge.findById(id)
        .populate('createdBy', 'name')
        .populate('participants.userId', 'name department');

      if (!challenge) {
        return sendErrorResponse(res, 'Challenge not found', 404);
      }

      if (!challenge.isPublic && 
          req.user.role === 'employee' &&
          challenge.createdBy._id.toString() !== req.user.id &&
          !challenge.participants.some(p => p.userId._id.toString() === req.user.id)) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      const isEligible = await challenge.isUserEligible(req.user.id);
      const canJoin = challenge.canAcceptNewParticipants && isEligible;
      const userParticipant = challenge.participants.find(p => 
        p.userId._id.toString() === req.user.id
      );

      sendSuccessResponse(res, {
        message: 'Challenge retrieved successfully',
        data: {
          challenge,
          userStatus: {
            isParticipating: !!userParticipant,
            isEligible,
            canJoin,
            progress: userParticipant?.progress || null
          }
        }
      });
    } catch (error) {
      console.error('Error fetching challenge:', error);
      sendErrorResponse(res, 'Failed to fetch challenge', 500);
    }
  },

  async updateChallenge(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const challenge = await Challenge.findById(id);

      if (!challenge) {
        return sendErrorResponse(res, 'Challenge not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' && 
          challenge.createdBy.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      if (challenge.status === 'active' && challenge.participants.length > 0) {
        const allowedUpdates = ['description', 'tags', 'images', 'resources'];
        const hasRestrictedUpdates = Object.keys(updates).some(key => 
          !allowedUpdates.includes(key)
        );
        
        if (hasRestrictedUpdates) {
          return sendErrorResponse(res, 'Limited updates allowed for active challenge with participants', 400);
        }
      }

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          challenge[key] = updates[key];
        }
      });

      await challenge.save();

      sendSuccessResponse(res, {
        message: 'Challenge updated successfully',
        data: { challenge }
      });
    } catch (error) {
      console.error('Error updating challenge:', error);
      sendErrorResponse(res, 'Failed to update challenge', 500);
    }
  },

  async deleteChallenge(req, res) {
    try {
      const { id } = req.params;

      const challenge = await Challenge.findById(id);

      if (!challenge) {
        return sendErrorResponse(res, 'Challenge not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' && 
          challenge.createdBy.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      if (challenge.status === 'active') {
        return sendErrorResponse(res, 'Cannot delete active challenge', 400);
      }

      await Challenge.findByIdAndDelete(id);

      sendSuccessResponse(res, {
        message: 'Challenge deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting challenge:', error);
      sendErrorResponse(res, 'Failed to delete challenge', 500);
    }
  },

  async joinChallenge(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const challenge = await Challenge.findById(id);

      if (!challenge) {
        return sendErrorResponse(res, 'Challenge not found', 404);
      }

      if (!challenge.canAcceptNewParticipants) {
        return sendErrorResponse(res, 'Challenge is not accepting new participants', 400);
      }

      const isEligible = await challenge.isUserEligible(userId);
      if (!isEligible) {
        return sendErrorResponse(res, 'You are not eligible for this challenge', 403);
      }

      await challenge.addParticipant(userId);

      sendSuccessResponse(res, {
        message: 'Successfully joined challenge',
        data: {
          challengeId: challenge._id,
          participantCount: challenge.participants.length
        }
      });
    } catch (error) {
      console.error('Error joining challenge:', error);
      
      if (error.message === 'User already participating') {
        return sendErrorResponse(res, 'You are already participating in this challenge', 400);
      }
      
      if (error.message === 'Challenge is full') {
        return sendErrorResponse(res, 'Challenge has reached maximum participants', 400);
      }
      
      sendErrorResponse(res, 'Failed to join challenge', 500);
    }
  },

  async leaveChallenge(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const challenge = await Challenge.findById(id);

      if (!challenge) {
        return sendErrorResponse(res, 'Challenge not found', 404);
      }

      const participantIndex = challenge.participants.findIndex(p =>
        p.userId.toString() === userId.toString()
      );

      if (participantIndex === -1) {
        return sendErrorResponse(res, 'You are not participating in this challenge', 400);
      }

      const participant = challenge.participants[participantIndex];
      
      if (participant.status === 'completed') {
        return sendErrorResponse(res, 'Cannot leave a completed challenge', 400);
      }

      participant.status = 'dropped';
      challenge.analytics.totalParticipants = challenge.participants.filter(p => 
        p.status !== 'dropped'
      ).length;

      await challenge.save();

      sendSuccessResponse(res, {
        message: 'Successfully left challenge',
        data: {
          challengeId: challenge._id
        }
      });
    } catch (error) {
      console.error('Error leaving challenge:', error);
      sendErrorResponse(res, 'Failed to leave challenge', 500);
    }
  },

  async updateProgress(req, res) {
    try {
      const { id } = req.params;
      const { current } = req.body;
      const userId = req.user.id;

      if (typeof current !== 'number' || current < 0) {
        return sendErrorResponse(res, 'Invalid progress value', 400);
      }

      const challenge = await Challenge.findById(id);

      if (!challenge) {
        return sendErrorResponse(res, 'Challenge not found', 404);
      }

      if (!challenge.isCurrentlyActive) {
        return sendErrorResponse(res, 'Challenge is not currently active', 400);
      }

      const result = await challenge.updateParticipantProgress(userId, { current });

      const user = await User.findById(userId);
      if (user && result.coinsEarned > 0) {
        user.wellness.happyCoins += result.coinsEarned;
        await user.save();
      }

      sendSuccessResponse(res, {
        message: 'Progress updated successfully',
        data: {
          progress: { current },
          milestonesAchieved: result.milestones,
          happyCoinsEarned: result.coinsEarned,
          completed: result.completed,
          totalHappyCoins: user.wellness.happyCoins
        }
      });
    } catch (error) {
      console.error('Error updating progress:', error);
      
      if (error.message === 'User not participating in this challenge') {
        return sendErrorResponse(res, 'You are not participating in this challenge', 400);
      }
      
      sendErrorResponse(res, 'Failed to update progress', 500);
    }
  },

  async getLeaderboard(req, res) {
    try {
      const { id } = req.params;
      const { limit = 10 } = req.query;

      const challenge = await Challenge.findById(id)
        .populate('participants.userId', 'name department');

      if (!challenge) {
        return sendErrorResponse(res, 'Challenge not found', 404);
      }

      if (!challenge.isPublic && 
          req.user.role === 'employee' &&
          !challenge.participants.some(p => p.userId._id.toString() === req.user.id)) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      const leaderboard = challenge.getLeaderboard(parseInt(limit));

      sendSuccessResponse(res, {
        message: 'Leaderboard retrieved successfully',
        data: {
          challenge: {
            id: challenge._id,
            title: challenge.title,
            type: challenge.type
          },
          leaderboard
        }
      });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      sendErrorResponse(res, 'Failed to fetch leaderboard', 500);
    }
  },

  async getChallengeAnalytics(req, res) {
    try {
      const { id } = req.params;

      const challenge = await Challenge.findById(id)
        .populate('participants.userId', 'name department')
        .populate('createdBy', 'name');

      if (!challenge) {
        return sendErrorResponse(res, 'Challenge not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' && 
          challenge.createdBy._id.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      const analytics = {
        challenge: {
          id: challenge._id,
          title: challenge.title,
          type: challenge.type,
          status: challenge.status
        },
        participation: challenge.analytics,
        participants: {
          byStatus: {
            active: 0,
            completed: 0,
            dropped: 0
          },
          byDepartment: {},
          topPerformers: challenge.getLeaderboard(5)
        },
        completion: {
          milestoneAchievements: {}
        }
      };

      challenge.participants.forEach(participant => {
        analytics.participants.byStatus[participant.status]++;
        
        const dept = participant.userId.department || 'Unknown';
        analytics.participants.byDepartment[dept] = 
          (analytics.participants.byDepartment[dept] || 0) + 1;

        participant.progress.milestones.forEach(milestone => {
          const key = `${milestone.milestone}%`;
          analytics.completion.milestoneAchievements[key] = 
            (analytics.completion.milestoneAchievements[key] || 0) + 1;
        });
      });

      sendSuccessResponse(res, {
        message: 'Challenge analytics retrieved successfully',
        data: analytics
      });
    } catch (error) {
      console.error('Error fetching challenge analytics:', error);
      sendErrorResponse(res, 'Failed to fetch challenge analytics', 500);
    }
  },

  async getActiveChallenges(req, res) {
    try {
      const userId = req.user.id;

      const challenges = await Challenge.getActiveChallengesForUser(userId);

      sendSuccessResponse(res, {
        message: 'Active challenges retrieved successfully',
        data: {
          challenges,
          count: challenges.length
        }
      });
    } catch (error) {
      console.error('Error fetching active challenges:', error);
      sendErrorResponse(res, 'Failed to fetch active challenges', 500);
    }
  },

  async getUserChallenges(req, res) {
    try {
      const userId = req.user.id;

      const challenges = await Challenge.getUserChallenges(userId);

      sendSuccessResponse(res, {
        message: 'User challenges retrieved successfully',
        data: {
          challenges,
          count: challenges.length
        }
      });
    } catch (error) {
      console.error('Error fetching user challenges:', error);
      sendErrorResponse(res, 'Failed to fetch user challenges', 500);
    }
  },

  async getChallengeTemplates(req, res) {
    try {
      const templates = [
        {
          id: 'mindfulness-week',
          title: '7-Day Mindfulness Challenge',
          description: 'Practice mindfulness for 7 consecutive days',
          category: 'mindfulness',
          type: 'individual',
          difficulty: 'beginner',
          goal: {
            type: 'checkin_streak',
            target: 7,
            unit: 'days',
            description: 'Complete daily check-ins for 7 consecutive days'
          },
          duration: { days: 7 },
          milestones: [
            { percentage: 50, title: 'Halfway There', reward: { happyCoins: 50 } },
            { percentage: 100, title: 'Mindfulness Master', reward: { happyCoins: 150, badge: 'Mindful Warrior' } }
          ],
          rewards: {
            completion: { happyCoins: 200, badge: 'Week Warrior' }
          }
        },
        {
          id: 'team-mood-boost',
          title: 'Team Mood Boost Challenge',
          description: 'Work together to maintain high team morale',
          category: 'team',
          type: 'team',
          difficulty: 'intermediate',
          goal: {
            type: 'mood_average',
            target: 4,
            unit: 'points',
            description: 'Maintain team average mood of 4+ for the duration'
          },
          duration: { days: 14 },
          milestones: [
            { percentage: 25, title: 'Good Start', reward: { happyCoins: 25 } },
            { percentage: 50, title: 'Halfway High', reward: { happyCoins: 50 } },
            { percentage: 75, title: 'Almost There', reward: { happyCoins: 75 } },
            { percentage: 100, title: 'Team Spirit', reward: { happyCoins: 100, badge: 'Team Player' } }
          ],
          rewards: {
            completion: { happyCoins: 300, badge: 'Mood Master' }
          }
        },
        {
          id: 'wellness-habits',
          title: '30-Day Wellness Habit Builder',
          description: 'Build lasting wellness habits over 30 days',
          category: 'habit',
          type: 'individual',
          difficulty: 'advanced',
          goal: {
            type: 'total_checkins',
            target: 25,
            unit: 'checkins',
            description: 'Complete 25 check-ins within 30 days'
          },
          duration: { days: 30 },
          milestones: [
            { percentage: 20, title: 'Getting Started', reward: { happyCoins: 50 } },
            { percentage: 40, title: 'Building Momentum', reward: { happyCoins: 100 } },
            { percentage: 60, title: 'Staying Strong', reward: { happyCoins: 150 } },
            { percentage: 80, title: 'Almost Perfect', reward: { happyCoins: 200 } },
            { percentage: 100, title: 'Habit Hero', reward: { happyCoins: 300, badge: 'Consistency Champion' } }
          ],
          rewards: {
            completion: { happyCoins: 500, badge: 'Wellness Warrior', certificate: true }
          }
        }
      ];

      sendSuccessResponse(res, {
        message: 'Challenge templates retrieved successfully',
        data: { templates }
      });
    } catch (error) {
      console.error('Error fetching challenge templates:', error);
      sendErrorResponse(res, 'Failed to fetch challenge templates', 500);
    }
  },

  async updateChallengeStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['draft', 'upcoming', 'active', 'completed', 'cancelled'].includes(status)) {
        return sendErrorResponse(res, 'Invalid status', 400);
      }

      const challenge = await Challenge.findById(id);

      if (!challenge) {
        return sendErrorResponse(res, 'Challenge not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' && 
          challenge.createdBy.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      const oldStatus = challenge.status;
      challenge.status = status;
      await challenge.save();

      sendSuccessResponse(res, {
        message: `Challenge status updated from ${oldStatus} to ${status}`,
        data: {
          challengeId: challenge._id,
          oldStatus,
          newStatus: status
        }
      });
    } catch (error) {
      console.error('Error updating challenge status:', error);
      sendErrorResponse(res, 'Failed to update challenge status', 500);
    }
  }
};

module.exports = challengeController;