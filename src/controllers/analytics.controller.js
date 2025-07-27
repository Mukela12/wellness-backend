const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const { validationResult } = require('express-validator');

class AnalyticsController {
  // Get company-wide wellness overview
  async getCompanyOverview(req, res) {
    try {
      // Check if user has HR permissions
      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. HR or Admin role required.'
        });
      }

      const { startDate, endDate } = req.query;
      
      // Set default date range (last 30 days)
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Get total active employees
      const totalEmployees = await User.countDocuments({
        role: 'employee',
        isActive: true
      });

      // Get employees who checked in during period
      const activeEmployees = await CheckIn.distinct('userId', {
        date: { $gte: start, $lte: end }
      });

      // Get check-in statistics
      const checkInStats = await CheckIn.aggregate([
        {
          $match: {
            date: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: null,
            totalCheckIns: { $sum: 1 },
            averageMood: { $avg: '$mood' },
            moodDistribution: {
              $push: '$mood'
            }
          }
        }
      ]);

      const stats = checkInStats[0] || { totalCheckIns: 0, averageMood: 0, moodDistribution: [] };

      // Calculate mood distribution
      const moodCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      stats.moodDistribution.forEach(mood => {
        moodCounts[mood]++;
      });

      // Get high-risk employees
      const highRiskEmployees = await User.countDocuments({
        'wellness.riskLevel': 'high',
        role: 'employee',
        isActive: true
      });

      // Calculate engagement rate
      const engagementRate = totalEmployees > 0 
        ? Math.round((activeEmployees.length / totalEmployees) * 100) 
        : 0;

      // Get department breakdown
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
            count: { $sum: 1 },
            avgHappyCoins: { $avg: '$wellness.happyCoins' },
            avgStreak: { $avg: '$wellness.currentStreak' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      res.json({
        success: true,
        data: {
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            days: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
          },
          overview: {
            totalEmployees,
            activeEmployees: activeEmployees.length,
            engagementRate: `${engagementRate}%`,
            totalCheckIns: stats.totalCheckIns,
            averageMood: Math.round(stats.averageMood * 10) / 10,
            highRiskEmployees,
            riskPercentage: totalEmployees > 0 
              ? `${Math.round((highRiskEmployees / totalEmployees) * 100)}%`
              : '0%'
          },
          moodDistribution: moodCounts,
          departmentBreakdown: departmentStats.map(dept => ({
            department: dept._id,
            employeeCount: dept.count,
            averageHappyCoins: Math.round(dept.avgHappyCoins),
            averageStreak: Math.round(dept.avgStreak * 10) / 10
          })),
          trends: {
            moodTrend: stats.averageMood > 3.5 ? 'positive' : 
                       stats.averageMood < 2.5 ? 'concerning' : 'neutral',
            engagementTrend: engagementRate > 75 ? 'high' : 
                            engagementRate > 50 ? 'moderate' : 'low'
          }
        }
      });

    } catch (error) {
      console.error('Company overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve company overview'
      });
    }
  }

  // Get department-specific analytics
  async getDepartmentAnalytics(req, res) {
    try {
      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. HR or Admin role required.'
        });
      }

      const { department } = req.params;
      const { startDate, endDate, includeIndividuals } = req.query;

      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Get department employees
      const departmentEmployees = await User.find({
        department,
        role: 'employee',
        isActive: true
      }).select('_id name wellness');

      if (departmentEmployees.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No employees found in this department'
        });
      }

      const employeeIds = departmentEmployees.map(emp => emp._id);

      // Get department check-ins
      const checkIns = await CheckIn.aggregate([
        {
          $match: {
            userId: { $in: employeeIds },
            date: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: '$userId',
            checkInCount: { $sum: 1 },
            averageMood: { $avg: '$mood' },
            moods: { $push: '$mood' },
            lastCheckIn: { $max: '$date' }
          }
        }
      ]);

      // Create employee map for easier lookup
      const employeeMap = new Map();
      departmentEmployees.forEach(emp => {
        employeeMap.set(emp._id.toString(), emp);
      });

      // Calculate department statistics
      let totalMood = 0;
      let totalCheckIns = 0;
      let activeEmployeeCount = 0;
      const riskLevels = { low: 0, medium: 0, high: 0 };
      const individualStats = [];

      checkIns.forEach(empCheckIn => {
        const employee = employeeMap.get(empCheckIn._id.toString());
        if (employee) {
          totalMood += empCheckIn.averageMood * empCheckIn.checkInCount;
          totalCheckIns += empCheckIn.checkInCount;
          activeEmployeeCount++;
          
          riskLevels[employee.wellness.riskLevel]++;

          if (includeIndividuals === 'true') {
            individualStats.push({
              employeeId: employee._id,
              name: employee.name,
              checkInCount: empCheckIn.checkInCount,
              averageMood: Math.round(empCheckIn.averageMood * 10) / 10,
              lastCheckIn: empCheckIn.lastCheckIn,
              riskLevel: employee.wellness.riskLevel,
              currentStreak: employee.wellness.currentStreak,
              happyCoins: employee.wellness.happyCoins
            });
          }
        }
      });

      const departmentAverageMood = totalCheckIns > 0 ? totalMood / totalCheckIns : 0;
      const engagementRate = departmentEmployees.length > 0 
        ? Math.round((activeEmployeeCount / departmentEmployees.length) * 100)
        : 0;

      // Get mood trend for department
      const moodTrend = await getDepartmentMoodTrend(employeeIds, start, end);

      // Identify employees needing attention
      const employeesNeedingAttention = departmentEmployees.filter(emp => {
        const checkIn = checkIns.find(c => c._id.toString() === emp._id.toString());
        return emp.wellness.riskLevel === 'high' || 
               (checkIn && checkIn.averageMood < 2.5) ||
               (!checkIn); // No check-ins in period
      }).map(emp => ({
        employeeId: emp._id,
        name: emp.name,
        riskLevel: emp.wellness.riskLevel,
        reason: emp.wellness.riskLevel === 'high' ? 'High risk level' :
                !checkIns.find(c => c._id.toString() === emp._id.toString()) ? 'No recent check-ins' :
                'Low average mood'
      }));

      res.json({
        success: true,
        data: {
          department,
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString()
          },
          overview: {
            totalEmployees: departmentEmployees.length,
            activeEmployees: activeEmployeeCount,
            engagementRate: `${engagementRate}%`,
            averageMood: Math.round(departmentAverageMood * 10) / 10,
            totalCheckIns
          },
          riskDistribution: riskLevels,
          moodTrend,
          employeesNeedingAttention: employeesNeedingAttention.slice(0, 10), // Top 10
          individualStats: includeIndividuals === 'true' ? individualStats : undefined
        }
      });

    } catch (error) {
      console.error('Department analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve department analytics'
      });
    }
  }

  // Get risk assessment report
  async getRiskAssessment(req, res) {
    try {
      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. HR or Admin role required.'
        });
      }

      const { riskLevel, department } = req.query;

      // Build query
      const query = {
        role: 'employee',
        isActive: true
      };

      if (riskLevel) {
        query['wellness.riskLevel'] = riskLevel;
      }

      if (department) {
        query.department = department;
      }

      // Get at-risk employees
      const atRiskEmployees = await User.find(query)
        .select('name email department wellness.riskLevel wellness.riskScore wellness.lastCheckIn')
        .sort({ 'wellness.riskScore': -1 })
        .limit(50); // Limit to top 50

      // Get their recent check-ins
      const employeeIds = atRiskEmployees.map(emp => emp._id);
      const recentCheckIns = await CheckIn.aggregate([
        {
          $match: {
            userId: { $in: employeeIds },
            date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
          }
        },
        {
          $group: {
            _id: '$userId',
            moods: { $push: '$mood' },
            avgMood: { $avg: '$mood' },
            checkInCount: { $sum: 1 }
          }
        }
      ]);

      // Create check-in map
      const checkInMap = new Map();
      recentCheckIns.forEach(checkIn => {
        checkInMap.set(checkIn._id.toString(), checkIn);
      });

      // Build risk report
      const riskReport = atRiskEmployees.map(emp => {
        const checkInData = checkInMap.get(emp._id.toString());
        const daysSinceLastCheckIn = emp.wellness.lastCheckIn 
          ? Math.floor((Date.now() - new Date(emp.wellness.lastCheckIn)) / (1000 * 60 * 60 * 24))
          : null;

        return {
          employee: {
            id: emp._id,
            name: emp.name,
            email: emp.email,
            department: emp.department
          },
          risk: {
            level: emp.wellness.riskLevel,
            score: emp.wellness.riskScore || 0
          },
          recentActivity: {
            lastCheckIn: emp.wellness.lastCheckIn,
            daysSinceLastCheckIn,
            weeklyCheckIns: checkInData ? checkInData.checkInCount : 0,
            averageMood: checkInData ? Math.round(checkInData.avgMood * 10) / 10 : null
          },
          indicators: getRiskIndicators(emp, checkInData, daysSinceLastCheckIn)
        };
      });

      // Calculate summary statistics
      const summary = {
        totalAtRisk: atRiskEmployees.length,
        byRiskLevel: {
          high: atRiskEmployees.filter(emp => emp.wellness.riskLevel === 'high').length,
          medium: atRiskEmployees.filter(emp => emp.wellness.riskLevel === 'medium').length,
          low: atRiskEmployees.filter(emp => emp.wellness.riskLevel === 'low').length
        },
        byDepartment: {}
      };

      // Count by department
      atRiskEmployees.forEach(emp => {
        if (!summary.byDepartment[emp.department]) {
          summary.byDepartment[emp.department] = 0;
        }
        summary.byDepartment[emp.department]++;
      });

      res.json({
        success: true,
        data: {
          summary,
          employees: riskReport,
          recommendations: generateRiskRecommendations(summary, riskReport)
        }
      });

    } catch (error) {
      console.error('Risk assessment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate risk assessment'
      });
    }
  }

  // Get engagement metrics
  async getEngagementMetrics(req, res) {
    try {
      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. HR or Admin role required.'
        });
      }

      const { period = '30' } = req.query;
      const days = parseInt(period);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Get daily engagement data
      const dailyEngagement = await CheckIn.aggregate([
        {
          $match: {
            date: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$date' }
            },
            uniqueUsers: { $addToSet: '$userId' },
            totalCheckIns: { $sum: 1 },
            averageMood: { $avg: '$mood' }
          }
        },
        {
          $project: {
            date: '$_id',
            activeUsers: { $size: '$uniqueUsers' },
            totalCheckIns: 1,
            averageMood: 1
          }
        },
        {
          $sort: { date: 1 }
        }
      ]);

      // Get streak distribution
      const streakDistribution = await User.aggregate([
        {
          $match: {
            role: 'employee',
            isActive: true,
            'wellness.currentStreak': { $gt: 0 }
          }
        },
        {
          $group: {
            _id: {
              $cond: [
                { $lte: ['$wellness.currentStreak', 7] }, '1-7 days',
                { $cond: [
                  { $lte: ['$wellness.currentStreak', 14] }, '8-14 days',
                  { $cond: [
                    { $lte: ['$wellness.currentStreak', 30] }, '15-30 days',
                    '30+ days'
                  ]}
                ]}
              ]
            },
            count: { $sum: 1 }
          }
        }
      ]);

      // Get happy coins distribution
      const happyCoinsDistribution = await User.aggregate([
        {
          $match: {
            role: 'employee',
            isActive: true
          }
        },
        {
          $group: {
            _id: {
              $cond: [
                { $lte: ['$wellness.happyCoins', 100] }, '0-100',
                { $cond: [
                  { $lte: ['$wellness.happyCoins', 500] }, '101-500',
                  { $cond: [
                    { $lte: ['$wellness.happyCoins', 1000] }, '501-1000',
                    '1000+'
                  ]}
                ]}
              ]
            },
            count: { $sum: 1 },
            totalCoins: { $sum: '$wellness.happyCoins' }
          }
        }
      ]);

      // Calculate engagement trends
      const totalEmployees = await User.countDocuments({ role: 'employee', isActive: true });
      const avgDailyEngagement = dailyEngagement.reduce((acc, day) => acc + day.activeUsers, 0) / dailyEngagement.length || 0;
      const engagementRate = totalEmployees > 0 ? Math.round((avgDailyEngagement / totalEmployees) * 100) : 0;

      res.json({
        success: true,
        data: {
          period: {
            days,
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString()
          },
          summary: {
            totalEmployees,
            averageDailyActiveUsers: Math.round(avgDailyEngagement),
            overallEngagementRate: `${engagementRate}%`,
            totalCheckInsInPeriod: dailyEngagement.reduce((acc, day) => acc + day.totalCheckIns, 0)
          },
          dailyEngagement: dailyEngagement.map(day => ({
            ...day,
            averageMood: Math.round(day.averageMood * 10) / 10,
            engagementRate: totalEmployees > 0 ? `${Math.round((day.activeUsers / totalEmployees) * 100)}%` : '0%'
          })),
          streakDistribution,
          happyCoinsDistribution: happyCoinsDistribution.map(dist => ({
            range: dist._id,
            employeeCount: dist.count,
            totalCoins: dist.totalCoins,
            averageCoins: Math.round(dist.totalCoins / dist.count)
          }))
        }
      });

    } catch (error) {
      console.error('Engagement metrics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve engagement metrics'
      });
    }
  }

  // Export analytics data
  async exportAnalytics(req, res) {
    try {
      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. HR or Admin role required.'
        });
      }

      const { format = 'json', type, startDate, endDate } = req.query;

      // For now, we'll implement JSON export
      // In production, you'd want to add CSV/Excel export
      
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      let data = {};

      switch (type) {
        case 'checkins':
          data = await exportCheckIns(start, end);
          break;
        case 'employees':
          data = await exportEmployees();
          break;
        case 'summary':
        default:
          data = await exportSummary(start, end);
          break;
      }

      if (format === 'csv') {
        // In production, implement CSV conversion
        return res.status(501).json({
          success: false,
          message: 'CSV export not yet implemented'
        });
      }

      res.json({
        success: true,
        exportDate: new Date().toISOString(),
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        },
        data
      });

    } catch (error) {
      console.error('Export analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export analytics data'
      });
    }
  }

}

// Helper functions (moved outside class)
async function getDepartmentMoodTrend(employeeIds, startDate, endDate) {
    const trend = await CheckIn.aggregate([
      {
        $match: {
          userId: { $in: employeeIds },
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          averageMood: { $avg: '$mood' },
          checkInCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $limit: 30 // Last 30 data points
      }
    ]);

    return trend.map(day => ({
      date: day._id,
      averageMood: Math.round(day.averageMood * 10) / 10,
      checkInCount: day.checkInCount
    }));
  }

function getRiskIndicators(employee, checkInData, daysSinceLastCheckIn) {
    const indicators = [];

    if (employee.wellness.riskLevel === 'high') {
      indicators.push('High risk classification');
    }

    if (daysSinceLastCheckIn > 7) {
      indicators.push('No check-in for over a week');
    }

    if (checkInData && checkInData.avgMood < 2.5) {
      indicators.push('Low average mood');
    }

    if (checkInData && checkInData.checkInCount < 3) {
      indicators.push('Infrequent check-ins');
    }

    if (!checkInData || checkInData.checkInCount === 0) {
      indicators.push('No recent activity');
    }

    return indicators;
  }

function generateRiskRecommendations(summary, riskReport) {
    const recommendations = [];

    if (summary.byRiskLevel.high > 5) {
      recommendations.push({
        priority: 'urgent',
        action: 'Immediate intervention needed',
        description: `${summary.byRiskLevel.high} employees are at high risk. Consider one-on-one check-ins or professional support.`
      });
    }

    // Check for department hotspots
    const departmentConcerns = Object.entries(summary.byDepartment)
      .filter(([dept, count]) => count >= 3)
      .map(([dept, count]) => dept);

    if (departmentConcerns.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Department-wide intervention',
        description: `Departments ${departmentConcerns.join(', ')} show concerning patterns. Consider team wellness sessions.`
      });
    }

    // Check for disengagement
    const disengagedCount = riskReport.filter(emp => 
      emp.recentActivity.daysSinceLastCheckIn > 7 || 
      emp.recentActivity.weeklyCheckIns === 0
    ).length;

    if (disengagedCount > 10) {
      recommendations.push({
        priority: 'medium',
        action: 'Re-engagement campaign',
        description: `${disengagedCount} employees haven't engaged recently. Consider reminder campaigns or incentives.`
      });
    }

    return recommendations;
  }

async function exportCheckIns(startDate, endDate) {
    const checkIns = await CheckIn.find({
      date: { $gte: startDate, $lte: endDate }
    })
    .populate('userId', 'name email department')
    .sort({ date: -1 })
    .limit(10000); // Limit for performance

    return checkIns.map(checkIn => ({
      date: checkIn.date,
      employeeName: checkIn.userId?.name || 'Unknown',
      employeeEmail: checkIn.userId?.email || 'Unknown',
      department: checkIn.userId?.department || 'Unknown',
      mood: checkIn.mood,
      moodLabel: getMoodLabel(checkIn.mood),
      feedback: checkIn.feedback,
      happyCoinsEarned: checkIn.happyCoinsEarned
    }));
  }

async function exportEmployees() {
    const employees = await User.find({
      role: 'employee',
      isActive: true
    })
    .select('-password -refreshTokens')
    .sort({ department: 1, name: 1 });

    return employees.map(emp => ({
      name: emp.name,
      email: emp.email,
      employeeId: emp.employeeId,
      department: emp.department,
      onboardingCompleted: emp.onboarding.completed,
      currentStreak: emp.wellness.currentStreak,
      happyCoins: emp.wellness.happyCoins,
      riskLevel: emp.wellness.riskLevel,
      lastCheckIn: emp.wellness.lastCheckIn
    }));
  }

async function exportSummary(startDate, endDate) {
    // Create a mock analytics controller instance for the method call
    const analyticsController = new AnalyticsController();
    const mockReq = { 
      user: { role: 'hr' }, 
      query: { startDate, endDate } 
    };
    const mockRes = { json: (data) => data };
    
    const overview = await analyticsController.getCompanyOverview(mockReq, mockRes);
    return overview.data;
  }

function getMoodLabel(mood) {
  const labels = {
    1: 'Very Bad',
    2: 'Bad',
    3: 'Neutral',
    4: 'Good',
    5: 'Excellent'
  };
  return labels[mood] || 'Unknown';
}

module.exports = new AnalyticsController();