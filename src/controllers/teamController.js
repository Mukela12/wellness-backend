const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const Survey = require('../models/Survey');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');
const mongoose = require('mongoose');

const teamController = {
  async getTeamOverview(req, res) {
    try {
      const managerId = req.user.id;
      const manager = await User.findById(managerId);

      if (!manager) {
        return sendErrorResponse(res, 'Manager not found', 404);
      }

      const teamMembers = await User.find({
        department: manager.department,
        role: 'employee',
        isActive: true
      }).select('name email wellness createdAt');

      if (teamMembers.length === 0) {
        return sendSuccessResponse(res, {
          message: 'No team members found',
          data: {
            overview: {
              totalMembers: 0,
              activeMembers: 0,
              averageMood: 0,
              averageHappyCoins: 0,
              engagementRate: 0
            },
            members: []
          }
        });
      }

      const totalMembers = teamMembers.length;
      let totalHappyCoins = 0;
      let totalMood = 0;
      let membersWithMood = 0;
      let activeMembers = 0;

      const memberDetails = [];

      for (const member of teamMembers) {
        totalHappyCoins += member.wellness.happyCoins || 0;
        
        if (member.wellness.averageMood > 0) {
          totalMood += member.wellness.averageMood;
          membersWithMood++;
        }

        const recentCheckIn = await CheckIn.findOne({
          userId: member._id
        }).sort({ createdAt: -1 });

        const isActive = recentCheckIn && 
          (new Date() - new Date(recentCheckIn.createdAt)) < (7 * 24 * 60 * 60 * 1000);

        if (isActive) activeMembers++;

        memberDetails.push({
          id: member._id,
          name: member.name,
          email: member.email,
          wellness: {
            happyCoins: member.wellness.happyCoins || 0,
            currentStreak: member.wellness.currentStreak || 0,
            averageMood: member.wellness.averageMood || 0,
            riskLevel: member.wellness.riskLevel || 'unknown'
          },
          lastCheckIn: recentCheckIn?.createdAt || null,
          isActive
        });
      }

      const overview = {
        totalMembers,
        activeMembers,
        averageMood: membersWithMood > 0 ? parseFloat((totalMood / membersWithMood).toFixed(2)) : 0,
        averageHappyCoins: Math.round(totalHappyCoins / totalMembers),
        engagementRate: parseFloat(((activeMembers / totalMembers) * 100).toFixed(1))
      };

      sendSuccessResponse(res, {
        message: 'Team overview retrieved successfully',
        data: {
          overview,
          members: memberDetails,
          department: manager.department
        }
      });
    } catch (error) {
      console.error('Error fetching team overview:', error);
      sendErrorResponse(res, 'Failed to fetch team overview', 500);
    }
  },

  async getTeamMoodTrend(req, res) {
    try {
      const managerId = req.user.id;
      const { days = 30 } = req.query;
      const manager = await User.findById(managerId);

      if (!manager) {
        return sendErrorResponse(res, 'Manager not found', 404);
      }

      const teamMembers = await User.find({
        department: manager.department,
        role: 'employee',
        isActive: true
      }).select('_id');

      const memberIds = teamMembers.map(member => member._id);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const checkIns = await CheckIn.aggregate([
        {
          $match: {
            userId: { $in: memberIds },
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
            },
            averageMood: { $avg: "$mood" },
            totalCheckIns: { $sum: 1 },
            uniqueUsers: { $addToSet: "$userId" }
          }
        },
        {
          $addFields: {
            activeUsers: { $size: "$uniqueUsers" }
          }
        },
        {
          $sort: { "_id.date": 1 }
        }
      ]);

      const trendData = checkIns.map(item => ({
        date: item._id.date,
        averageMood: parseFloat(item.averageMood.toFixed(2)),
        totalCheckIns: item.totalCheckIns,
        activeUsers: item.activeUsers,
        engagementRate: parseFloat(((item.activeUsers / memberIds.length) * 100).toFixed(1))
      }));

      sendSuccessResponse(res, {
        message: 'Team mood trend retrieved successfully',
        data: {
          trend: trendData,
          period: `${days} days`,
          teamSize: memberIds.length
        }
      });
    } catch (error) {
      console.error('Error fetching team mood trend:', error);
      sendErrorResponse(res, 'Failed to fetch team mood trend', 500);
    }
  },

  async getTeamRiskAssessment(req, res) {
    try {
      const managerId = req.user.id;
      const manager = await User.findById(managerId);

      if (!manager) {
        return sendErrorResponse(res, 'Manager not found', 404);
      }

      const teamMembers = await User.find({
        department: manager.department,
        role: 'employee',
        isActive: true
      }).select('name email wellness');

      const riskAssessment = {
        summary: {
          total: teamMembers.length,
          high: 0,
          medium: 0,
          low: 0,
          unknown: 0
        },
        members: []
      };

      for (const member of teamMembers) {
        const riskLevel = member.wellness.riskLevel || 'unknown';
        riskAssessment.summary[riskLevel]++;

        const recentCheckIns = await CheckIn.find({
          userId: member._id
        })
        .sort({ createdAt: -1 })
        .limit(7);

        const indicators = [];
        
        if (member.wellness.averageMood < 2.5) {
          indicators.push('Low average mood');
        }
        
        if (recentCheckIns.length < 3) {
          indicators.push('Infrequent check-ins');
        }
        
        if (member.wellness.currentStreak === 0) {
          indicators.push('No current streak');
        }

        if (recentCheckIns.length >= 2) {
          const recent = recentCheckIns.slice(0, 3);
          const older = recentCheckIns.slice(3, 6);
          
          if (recent.length > 0 && older.length > 0) {
            const recentAvg = recent.reduce((sum, ci) => sum + ci.mood, 0) / recent.length;
            const olderAvg = older.reduce((sum, ci) => sum + ci.mood, 0) / older.length;
            
            if (recentAvg < olderAvg - 0.5) {
              indicators.push('Declining mood trend');
            }
          }
        }

        if (riskLevel === 'high' || riskLevel === 'medium' || indicators.length > 0) {
          riskAssessment.members.push({
            id: member._id,
            name: member.name,
            email: member.email,
            riskLevel,
            indicators,
            wellness: {
              averageMood: member.wellness.averageMood || 0,
              currentStreak: member.wellness.currentStreak || 0,
              lastCheckIn: recentCheckIns[0]?.createdAt || null
            }
          });
        }
      }

      riskAssessment.members.sort((a, b) => {
        const riskOrder = { high: 3, medium: 2, low: 1, unknown: 0 };
        return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
      });

      const recommendations = [];
      
      if (riskAssessment.summary.high > 0) {
        recommendations.push({
          priority: 'urgent',
          action: 'Schedule one-on-one meetings',
          description: `${riskAssessment.summary.high} team members need immediate support`
        });
      }
      
      if (riskAssessment.summary.medium > 0) {
        recommendations.push({
          priority: 'high',
          action: 'Provide additional resources',
          description: `${riskAssessment.summary.medium} team members showing warning signs`
        });
      }

      const lowEngagement = riskAssessment.summary.total - 
        (riskAssessment.summary.high + riskAssessment.summary.medium + riskAssessment.summary.low);
      
      if (lowEngagement > 0) {
        recommendations.push({
          priority: 'medium',
          action: 'Encourage wellness participation',
          description: `${lowEngagement} team members have limited wellness data`
        });
      }

      sendSuccessResponse(res, {
        message: 'Team risk assessment retrieved successfully',
        data: {
          riskAssessment,
          recommendations,
          department: manager.department
        }
      });
    } catch (error) {
      console.error('Error fetching team risk assessment:', error);
      sendErrorResponse(res, 'Failed to fetch team risk assessment', 500);
    }
  },

  async getTeamSurveyParticipation(req, res) {
    try {
      const managerId = req.user.id;
      const manager = await User.findById(managerId);

      if (!manager) {
        return sendErrorResponse(res, 'Manager not found', 404);
      }

      const teamMembers = await User.find({
        department: manager.department,
        role: 'employee',
        isActive: true
      }).select('_id name');

      const memberIds = teamMembers.map(member => member._id);

      const surveys = await Survey.find({
        status: { $in: ['active', 'closed'] },
        $or: [
          { 'targetAudience.all': true },
          { 'targetAudience.departments': manager.department }
        ]
      }).populate('responses.userId', 'name');

      const participation = {
        overview: {
          totalSurveys: surveys.length,
          averageParticipation: 0,
          totalResponses: 0
        },
        surveys: [],
        members: []
      };

      let totalParticipationRate = 0;

      for (const survey of surveys) {
        const teamResponses = survey.responses.filter(response =>
          memberIds.some(id => id.toString() === response.userId._id.toString())
        );

        const participationRate = teamMembers.length > 0 
          ? (teamResponses.length / teamMembers.length) * 100 
          : 0;

        totalParticipationRate += participationRate;
        participation.overview.totalResponses += teamResponses.length;

        participation.surveys.push({
          id: survey._id,
          title: survey.title,
          type: survey.type,
          status: survey.status,
          teamResponses: teamResponses.length,
          participationRate: parseFloat(participationRate.toFixed(1)),
          createdAt: survey.createdAt
        });
      }

      participation.overview.averageParticipation = surveys.length > 0 
        ? parseFloat((totalParticipationRate / surveys.length).toFixed(1))
        : 0;

      for (const member of teamMembers) {
        const memberResponses = surveys.reduce((count, survey) => {
          const hasResponded = survey.responses.some(response =>
            response.userId._id.toString() === member._id.toString()
          );
          return count + (hasResponded ? 1 : 0);
        }, 0);

        const memberParticipationRate = surveys.length > 0 
          ? (memberResponses / surveys.length) * 100 
          : 0;

        participation.members.push({
          id: member._id,
          name: member.name,
          responsesCount: memberResponses,
          participationRate: parseFloat(memberParticipationRate.toFixed(1))
        });
      }

      participation.members.sort((a, b) => b.participationRate - a.participationRate);

      sendSuccessResponse(res, {
        message: 'Team survey participation retrieved successfully',
        data: {
          participation,
          department: manager.department
        }
      });
    } catch (error) {
      console.error('Error fetching team survey participation:', error);
      sendErrorResponse(res, 'Failed to fetch team survey participation', 500);
    }
  },

  async getTeamEngagementMetrics(req, res) {
    try {
      const managerId = req.user.id;
      const { days = 30 } = req.query;
      const manager = await User.findById(managerId);

      if (!manager) {
        return sendErrorResponse(res, 'Manager not found', 404);
      }

      const teamMembers = await User.find({
        department: manager.department,
        role: 'employee',
        isActive: true
      }).select('_id name wellness');

      const memberIds = teamMembers.map(member => member._id);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const checkInData = await CheckIn.aggregate([
        {
          $match: {
            userId: { $in: memberIds },
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: "$userId",
            checkInCount: { $sum: 1 },
            averageMood: { $avg: "$mood" },
            lastCheckIn: { $max: "$createdAt" }
          }
        }
      ]);

      const engagement = {
        overview: {
          totalMembers: teamMembers.length,
          activeMembers: 0,
          averageCheckIns: 0,
          averageMood: 0,
          engagementScore: 0
        },
        members: []
      };

      let totalCheckIns = 0;
      let totalMood = 0;
      let membersWithData = 0;

      for (const member of teamMembers) {
        const memberData = checkInData.find(data => 
          data._id.toString() === member._id.toString()
        );

        const checkInCount = memberData?.checkInCount || 0;
        const averageMood = memberData?.averageMood || 0;
        const lastCheckIn = memberData?.lastCheckIn || null;

        const isActive = lastCheckIn && 
          (new Date() - new Date(lastCheckIn)) < (7 * 24 * 60 * 60 * 1000);

        if (isActive) engagement.overview.activeMembers++;
        
        totalCheckIns += checkInCount;
        
        if (averageMood > 0) {
          totalMood += averageMood;
          membersWithData++;
        }

        const engagementScore = Math.min(
          (checkInCount / Math.min(parseInt(days), 30)) * 100, 
          100
        );

        engagement.members.push({
          id: member._id,
          name: member.name,
          checkInCount,
          averageMood: parseFloat((averageMood || 0).toFixed(2)),
          lastCheckIn,
          isActive,
          engagementScore: parseFloat(engagementScore.toFixed(1)),
          happyCoins: member.wellness.happyCoins || 0,
          currentStreak: member.wellness.currentStreak || 0
        });
      }

      engagement.overview.averageCheckIns = teamMembers.length > 0 
        ? parseFloat((totalCheckIns / teamMembers.length).toFixed(1))
        : 0;

      engagement.overview.averageMood = membersWithData > 0 
        ? parseFloat((totalMood / membersWithData).toFixed(2))
        : 0;

      engagement.overview.engagementScore = teamMembers.length > 0 
        ? parseFloat(((engagement.overview.activeMembers / teamMembers.length) * 100).toFixed(1))
        : 0;

      engagement.members.sort((a, b) => b.engagementScore - a.engagementScore);

      sendSuccessResponse(res, {
        message: 'Team engagement metrics retrieved successfully',
        data: {
          engagement,
          period: `${days} days`,
          department: manager.department
        }
      });
    } catch (error) {
      console.error('Error fetching team engagement metrics:', error);
      sendErrorResponse(res, 'Failed to fetch team engagement metrics', 500);
    }
  }
};

module.exports = teamController;