const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const Survey = require('../models/Survey');
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
      console.log(`📊 Risk Assessment - Query params received:`, { riskLevel, department, allParams: req.query });

      // Build base query for ALL employees first
      const baseQuery = {
        role: 'employee',
        isActive: true
      };

      if (department) {
        baseQuery.department = department;
      }

      console.log(`📊 Risk Assessment - Base query:`, baseQuery);
      
      // Get ALL active employees
      const allEmployees = await User.find(baseQuery)
        .select('name email department wellness employment.hireDate demographics.age')
        .lean();

      console.log(`📊 Risk Assessment - Found ${allEmployees.length} total employees`);
      
      if (allEmployees.length === 0) {
        // Debug: check if there are any users at all
        const totalUsers = await User.countDocuments({ role: 'employee' });
        const activeUsers = await User.countDocuments({ role: 'employee', isActive: true });
        console.log(`📊 Risk Assessment - Debug: Total employees: ${totalUsers}, Active employees: ${activeUsers}`);
      }

      if (allEmployees.length === 0) {
        return res.json({
          success: true,
          data: {
            summary: { totalAtRisk: 0, byRiskLevel: { high: 0, medium: 0, low: 0 }, byDepartment: {} },
            employees: [],
            recommendations: []
          }
        });
      }

      // Get recent check-ins for ALL employees
      const employeeIds = allEmployees.map(emp => emp._id);
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
            checkInCount: { $sum: 1 },
            lastCheckIn: { $max: '$date' }
          }
        }
      ]);

      console.log(`📊 Risk Assessment - Found check-ins for ${recentCheckIns.length} employees`);

      // Get survey responses for engagement tracking
      const surveyResponses = await Survey.aggregate([
        {
          $lookup: {
            from: 'surveyresponses',
            localField: '_id',
            foreignField: 'surveyId',
            as: 'responses'
          }
        },
        {
          $unwind: { path: '$responses', preserveNullAndEmptyArrays: true }
        },
        {
          $match: {
            'responses.userId': { $in: employeeIds },
            'responses.submittedAt': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: '$responses.userId',
            surveyCount: { $sum: 1 },
            lastSurvey: { $max: '$responses.submittedAt' }
          }
        }
      ]).catch(() => []); // Handle if Survey model doesn't exist

      // Create maps for quick lookup
      const checkInMap = new Map();
      recentCheckIns.forEach(checkIn => {
        checkInMap.set(checkIn._id.toString(), checkIn);
      });

      const surveyMap = new Map();
      surveyResponses.forEach(survey => {
        surveyMap.set(survey._id.toString(), survey);
      });

      // Calculate risk for ALL employees dynamically
      const employeesWithRisk = allEmployees.map(emp => {
        const checkInData = checkInMap.get(emp._id.toString());
        const surveyData = surveyMap.get(emp._id.toString());
        
        // Calculate days since last check-in
        const lastCheckIn = checkInData?.lastCheckIn || emp.wellness?.lastCheckIn;
        const daysSinceLastCheckIn = lastCheckIn 
          ? Math.floor((Date.now() - new Date(lastCheckIn)) / (1000 * 60 * 60 * 24))
          : 999; // Large number if never checked in

        // Calculate risk score (0-100)
        let riskScore = 0;
        
        // Check-in frequency (40% of score)
        const weeklyCheckIns = checkInData?.checkInCount || 0;
        if (weeklyCheckIns === 0) riskScore += 40;
        else if (weeklyCheckIns < 3) riskScore += 20;
        else if (weeklyCheckIns < 5) riskScore += 10;
        
        // Mood patterns (30% of score)
        const avgMood = checkInData?.avgMood || 0;
        if (avgMood === 0) riskScore += 15; // No mood data
        else if (avgMood < 2) riskScore += 30;
        else if (avgMood < 2.5) riskScore += 20;
        else if (avgMood < 3) riskScore += 10;
        
        // Days inactive (20% of score)
        if (daysSinceLastCheckIn > 14) riskScore += 20;
        else if (daysSinceLastCheckIn > 7) riskScore += 15;
        else if (daysSinceLastCheckIn > 3) riskScore += 5;
        
        // Survey participation (10% of score)
        const surveyCount = surveyData?.surveyCount || 0;
        if (surveyCount === 0) riskScore += 10;
        else if (surveyCount < 2) riskScore += 5;

        // Determine risk level
        let riskLevel;
        if (riskScore >= 60) riskLevel = 'high';
        else if (riskScore >= 30) riskLevel = 'medium';
        else riskLevel = 'low';

        return {
          ...emp,
          calculatedRisk: {
            score: Math.min(riskScore, 100),
            level: riskLevel,
            checkInData,
            surveyData,
            daysSinceLastCheckIn,
            weeklyCheckIns,
            avgMood
          }
        };
      });

      // Filter based on requested risk level
      let filteredEmployees = employeesWithRisk;
      if (riskLevel && riskLevel.trim() !== '') {
        console.log(`📊 Risk Assessment - Filtering by risk level: "${riskLevel}"`);
        filteredEmployees = employeesWithRisk.filter(emp => emp.calculatedRisk.level === riskLevel);
      } else {
        console.log(`📊 Risk Assessment - No risk level filter applied, showing all employees`);
      }

      // Build risk report
      const riskReport = filteredEmployees.map(emp => {
        const risk = emp.calculatedRisk;
        
        return {
          employee: {
            id: emp._id,
            name: emp.name,
            email: emp.email,
            department: emp.department
          },
          risk: {
            level: risk.level,
            score: risk.score
          },
          recentActivity: {
            lastCheckIn: risk.checkInData?.lastCheckIn || emp.wellness?.lastCheckIn,
            daysSinceLastCheckIn: risk.daysSinceLastCheckIn === 999 ? null : risk.daysSinceLastCheckIn,
            weeklyCheckIns: risk.weeklyCheckIns,
            averageMood: risk.avgMood > 0 ? Math.round(risk.avgMood * 10) / 10 : null
          },
          indicators: getRiskIndicators(emp, risk.checkInData, risk.daysSinceLastCheckIn)
        };
      });

      // Calculate summary statistics
      const summary = {
        totalAtRisk: filteredEmployees.length,
        byRiskLevel: {
          high: filteredEmployees.filter(emp => emp.calculatedRisk.level === 'high').length,
          medium: filteredEmployees.filter(emp => emp.calculatedRisk.level === 'medium').length,
          low: filteredEmployees.filter(emp => emp.calculatedRisk.level === 'low').length
        },
        byDepartment: {}
      };

      // Count by department
      filteredEmployees.forEach(emp => {
        if (!summary.byDepartment[emp.department]) {
          summary.byDepartment[emp.department] = 0;
        }
        summary.byDepartment[emp.department]++;
      });

      console.log(`📊 Risk Assessment - Calculated risk for ${employeesWithRisk.length} employees, filtered to ${filteredEmployees.length}`);

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

  // Get demographics analytics
  async getDemographicsAnalytics(req, res) {
    try {
      // Check HR/Admin permissions
      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. HR or Admin role required.'
        });
      }

      const { department, startDate, endDate } = req.query;

      // Build base query
      const query = {
        role: 'employee',
        isActive: true
      };

      if (department) {
        query.department = department;
      }

      // Age distribution
      const ageDistribution = await User.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              $cond: [
                { $lt: ['$demographics.age', 25] }, 'Under 25',
                { $cond: [
                  { $lt: ['$demographics.age', 35] }, '25-34',
                  { $cond: [
                    { $lt: ['$demographics.age', 45] }, '35-44',
                    { $cond: [
                      { $lt: ['$demographics.age', 55] }, '45-54',
                      '55+'
                    ]}
                  ]}
                ]}
              ]
            },
            count: { $sum: 1 },
            avgAge: { $avg: '$demographics.age' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Gender breakdown
      const genderBreakdown = await User.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$demographics.gender',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Seniority levels
      const seniorityLevels = await User.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$employment.seniority',
            count: { $sum: 1 },
            avgYearsOfService: { $avg: { $divide: [{ $subtract: [new Date(), '$employment.hireDate'] }, 365.25 * 24 * 60 * 60 * 1000] } }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Years of service analysis
      const yearsOfServiceAnalysis = await User.aggregate([
        { $match: query },
        {
          $addFields: {
            yearsOfService: {
              $divide: [
                { $subtract: [new Date(), '$employment.hireDate'] },
                365.25 * 24 * 60 * 60 * 1000
              ]
            }
          }
        },
        {
          $group: {
            _id: {
              $cond: [
                { $lt: ['$yearsOfService', 1] }, '< 1 year',
                { $cond: [
                  { $lt: ['$yearsOfService', 3] }, '1-3 years',
                  { $cond: [
                    { $lt: ['$yearsOfService', 5] }, '3-5 years',
                    { $cond: [
                      { $lt: ['$yearsOfService', 10] }, '5-10 years',
                      '10+ years'
                    ]}
                  ]}
                ]}
              ]
            },
            count: { $sum: 1 },
            avgYears: { $avg: '$yearsOfService' }
          }
        },
        { $sort: { avgYears: 1 } }
      ]);

      // Department distribution
      const departmentDistribution = await User.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 },
            avgAge: { $avg: '$demographics.age' },
            maleCount: { $sum: { $cond: [{ $eq: ['$demographics.gender', 'male'] }, 1, 0] } },
            femaleCount: { $sum: { $cond: [{ $eq: ['$demographics.gender', 'female'] }, 1, 0] } }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Total employee count for percentages
      const totalEmployees = await User.countDocuments(query);

      res.json({
        success: true,
        data: {
          summary: {
            totalEmployees,
            averageAge: Math.round((await User.aggregate([
              { $match: query },
              { $group: { _id: null, avgAge: { $avg: '$demographics.age' } } }
            ]))[0]?.avgAge * 10) / 10 || 0,
            averageYearsOfService: Math.round((await User.aggregate([
              { $match: query },
              {
                $addFields: {
                  yearsOfService: {
                    $divide: [
                      { $subtract: [new Date(), '$employment.hireDate'] },
                      365.25 * 24 * 60 * 60 * 1000
                    ]
                  }
                }
              },
              { $group: { _id: null, avgYears: { $avg: '$yearsOfService' } } }
            ]))[0]?.avgYears * 10) / 10 || 0
          },
          ageDistribution: ageDistribution.map(item => ({
            ageRange: item._id,
            count: item.count,
            percentage: Math.round((item.count / totalEmployees) * 100),
            averageAge: Math.round(item.avgAge * 10) / 10
          })),
          genderBreakdown: genderBreakdown.map(item => ({
            gender: item._id || 'Not specified',
            count: item.count,
            percentage: Math.round((item.count / totalEmployees) * 100)
          })),
          seniorityLevels: seniorityLevels.map(item => ({
            level: item._id,
            count: item.count,
            percentage: Math.round((item.count / totalEmployees) * 100),
            averageYearsOfService: Math.round(item.avgYearsOfService * 10) / 10
          })),
          yearsOfServiceAnalysis: yearsOfServiceAnalysis.map(item => ({
            range: item._id,
            count: item.count,
            percentage: Math.round((item.count / totalEmployees) * 100),
            averageYears: Math.round(item.avgYears * 10) / 10
          })),
          departmentDistribution: departmentDistribution.map(item => ({
            department: item._id,
            count: item.count,
            percentage: Math.round((item.count / totalEmployees) * 100),
            averageAge: Math.round(item.avgAge * 10) / 10,
            genderRatio: {
              male: item.maleCount,
              female: item.femaleCount,
              malePercentage: Math.round((item.maleCount / item.count) * 100),
              femalePercentage: Math.round((item.femaleCount / item.count) * 100)
            }
          }))
        }
      });

    } catch (error) {
      console.error('Demographics analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve demographics analytics'
      });
    }
  }

  // Calculate Employee Net Promoter Score (eNPS)
  async calculateENPS(req, res) {
    try {
      // Check HR/Admin permissions
      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. HR or Admin role required.'
        });
      }

      const { startDate, endDate, department, surveyId } = req.query;

      // Set default date range (last 90 days for eNPS)
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Build survey query for eNPS questions
      const surveyQuery = {
        'questions.category': { $in: ['recommendation', 'loyalty', 'enps'] },
        'responses.completedAt': { $gte: start, $lte: end }
      };

      if (surveyId) {
        surveyQuery._id = surveyId;
      }

      // Get surveys with eNPS-related questions
      const surveys = await Survey.find(surveyQuery).populate('responses.userId');

      if (surveys.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No eNPS survey data found for the specified period'
        });
      }

      let allResponses = [];
      let promoterScores = [];
      let detractorScores = [];
      let passiveScores = [];

      // Process all survey responses
      surveys.forEach(survey => {
        survey.responses.forEach(response => {
          const user = response.userId;
          
          // Filter by department if specified
          if (department && user.department !== department) {
            return;
          }

          // Look for recommendation/loyalty questions (typically scale 0-10)
          survey.questions.forEach(question => {
            if (question.category === 'recommendation' || 
                question.category === 'loyalty' || 
                question.category === 'enps') {
              
              const answerValue = response.answers.get(question.id);
              if (answerValue !== undefined && answerValue !== null) {
                const score = parseInt(answerValue);
                
                if (!isNaN(score) && score >= 0 && score <= 10) {
                  allResponses.push({
                    userId: user._id,
                    userName: user.name,
                    department: user.department,
                    score: score,
                    category: score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor',
                    questionId: question.id,
                    questionText: question.question,
                    completedAt: response.completedAt
                  });

                  if (score >= 9) {
                    promoterScores.push(score);
                  } else if (score >= 7) {
                    passiveScores.push(score);
                  } else {
                    detractorScores.push(score);
                  }
                }
              }
            }
          });
        });
      });

      if (allResponses.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No valid eNPS responses found'
        });
      }

      // Calculate eNPS
      const totalResponses = allResponses.length;
      const promoterCount = promoterScores.length;
      const detractorCount = detractorScores.length;
      const passiveCount = passiveScores.length;

      const promoterPercentage = (promoterCount / totalResponses) * 100;
      const detractorPercentage = (detractorCount / totalResponses) * 100;
      const enpsScore = Math.round(promoterPercentage - detractorPercentage);

      // Categorize eNPS score
      let enpsCategory = 'Poor';
      if (enpsScore >= 50) enpsCategory = 'Excellent';
      else if (enpsScore >= 10) enpsCategory = 'Good';
      else if (enpsScore >= -10) enpsCategory = 'Acceptable';

      // Department breakdown
      const departmentBreakdown = {};
      allResponses.forEach(response => {
        if (!departmentBreakdown[response.department]) {
          departmentBreakdown[response.department] = {
            promoters: 0,
            passives: 0,
            detractors: 0,
            total: 0
          };
        }
        departmentBreakdown[response.department][response.category]++;
        departmentBreakdown[response.department].total++;
      });

      Object.keys(departmentBreakdown).forEach(dept => {
        const data = departmentBreakdown[dept];
        const deptPromoterPct = (data.promoters / data.total) * 100;
        const deptDetractorPct = (data.detractors / data.total) * 100;
        data.enpsScore = Math.round(deptPromoterPct - deptDetractorPct);
        data.promoterPercentage = Math.round(deptPromoterPct);
        data.detractorPercentage = Math.round(deptDetractorPct);
        data.passivePercentage = Math.round((data.passives / data.total) * 100);
      });

      // Historical trend (last 6 months by month)
      const historicalTrend = await calculateENPSTrend(start, end, department);

      res.json({
        success: true,
        data: {
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            days: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
          },
          enps: {
            score: enpsScore,
            category: enpsCategory,
            totalResponses,
            benchmark: {
              excellent: '50+',
              good: '10-49',
              acceptable: '-10 to 9',
              poor: 'Below -10'
            }
          },
          distribution: {
            promoters: {
              count: promoterCount,
              percentage: Math.round(promoterPercentage),
              scores: promoterScores
            },
            passives: {
              count: passiveCount,
              percentage: Math.round((passiveCount / totalResponses) * 100),
              scores: passiveScores
            },
            detractors: {
              count: detractorCount,
              percentage: Math.round(detractorPercentage),
              scores: detractorScores
            }
          },
          departmentBreakdown,
          historicalTrend,
          insights: generateENPSInsights(enpsScore, promoterPercentage, detractorPercentage, departmentBreakdown)
        }
      });

    } catch (error) {
      console.error('eNPS calculation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate eNPS'
      });
    }
  }

  // Get comprehensive engagement metrics
  async getComprehensiveEngagementMetrics(req, res) {
    try {
      // Check HR/Admin permissions
      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. HR or Admin role required.'
        });
      }

      const { startDate, endDate, department } = req.query;

      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Build user query
      const userQuery = {
        role: 'employee',
        isActive: true
      };

      if (department) {
        userQuery.department = department;
      }

      // Get engagement dimensions from surveys
      const engagementDimensions = {
        purpose: [],
        leadership: [],
        innovation: [],
        teamwork: [],
        appreciation: [],
        growth: [],
        diversity: [],
        wellbeing: [],
        psychological_safety: []
      };

      // Find surveys with engagement questions
      const surveys = await Survey.find({
        'questions.category': { $in: Object.keys(engagementDimensions) },
        'responses.completedAt': { $gte: start, $lte: end }
      }).populate('responses.userId');

      let totalResponseCount = 0;
      let dimensionScores = {};

      // Initialize dimension scores
      Object.keys(engagementDimensions).forEach(dimension => {
        dimensionScores[dimension] = {
          scores: [],
          averageScore: 0,
          responseCount: 0
        };
      });

      // Process survey responses
      surveys.forEach(survey => {
        survey.responses.forEach(response => {
          const user = response.userId;
          
          if (department && user.department !== department) {
            return;
          }

          survey.questions.forEach(question => {
            if (engagementDimensions.hasOwnProperty(question.category)) {
              const answerValue = response.answers.get(question.id);
              if (answerValue !== undefined && answerValue !== null) {
                const score = parseFloat(answerValue);
                if (!isNaN(score)) {
                  dimensionScores[question.category].scores.push(score);
                  dimensionScores[question.category].responseCount++;
                  totalResponseCount++;
                }
              }
            }
          });
        });
      });

      // Calculate averages and categorize scores
      Object.keys(dimensionScores).forEach(dimension => {
        const scores = dimensionScores[dimension].scores;
        if (scores.length > 0) {
          dimensionScores[dimension].averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          dimensionScores[dimension].engagement_level = categorizeEngagementScore(dimensionScores[dimension].averageScore);
        }
      });

      // Get check-in based engagement
      const checkInEngagement = await CheckIn.aggregate([
        {
          $match: {
            date: { $gte: start, $lte: end }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $match: department ? { 'user.department': department } : {}
        },
        {
          $group: {
            _id: '$user.department',
            totalCheckIns: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            averageMood: { $avg: '$mood' },
            moodDistribution: {
              $push: '$mood'
            }
          }
        }
      ]);

      // Calculate overall engagement score
      const dimensionAverages = Object.values(dimensionScores)
        .filter(dim => dim.averageScore > 0)
        .map(dim => dim.averageScore);
      
      const overallEngagementScore = dimensionAverages.length > 0 
        ? dimensionAverages.reduce((a, b) => a + b, 0) / dimensionAverages.length
        : 0;

      // Get top and bottom performing dimensions
      const rankedDimensions = Object.entries(dimensionScores)
        .filter(([_, data]) => data.averageScore > 0)
        .sort(([_, a], [__, b]) => b.averageScore - a.averageScore);

      const topPerformingDimensions = rankedDimensions.slice(0, 3);
      const bottomPerformingDimensions = rankedDimensions.slice(-3).reverse();

      res.json({
        success: true,
        data: {
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString()
          },
          overall: {
            engagementScore: Math.round(overallEngagementScore * 10) / 10,
            engagementLevel: categorizeEngagementScore(overallEngagementScore),
            totalSurveyResponses: totalResponseCount,
            totalCheckIns: checkInEngagement.reduce((acc, dept) => acc + dept.totalCheckIns, 0)
          },
          engagementDimensions: Object.entries(dimensionScores).map(([dimension, data]) => ({
            dimension,
            averageScore: Math.round(data.averageScore * 10) / 10,
            responseCount: data.responseCount,
            engagementLevel: data.engagement_level,
            percentile: calculatePercentile(data.averageScore, 1, 5)
          })),
          checkInEngagement: checkInEngagement.map(dept => ({
            department: dept._id,
            totalCheckIns: dept.totalCheckIns,
            uniqueUsers: dept.uniqueUsers.length,
            averageMood: Math.round(dept.averageMood * 10) / 10,
            engagementRate: Math.round((dept.uniqueUsers.length / (dept.totalCheckIns || 1)) * 100)
          })),
          insights: {
            topPerformingDimensions: topPerformingDimensions.map(([dim, data]) => ({
              dimension: dim,
              score: Math.round(data.averageScore * 10) / 10,
              level: data.engagement_level
            })),
            bottomPerformingDimensions: bottomPerformingDimensions.map(([dim, data]) => ({
              dimension: dim,
              score: Math.round(data.averageScore * 10) / 10,
              level: data.engagement_level
            })),
            recommendations: generateEngagementRecommendations(dimensionScores, overallEngagementScore)
          }
        }
      });

    } catch (error) {
      console.error('Comprehensive engagement metrics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve comprehensive engagement metrics'
      });
    }
  }

  // Sentiment analysis for text responses
  async getSentimentAnalysis(req, res) {
    try {
      // Check HR/Admin permissions
      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. HR or Admin role required.'
        });
      }

      const { startDate, endDate, department, surveyId } = req.query;

      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Build query for text responses
      const surveyQuery = {
        'questions.type': 'text',
        'responses.completedAt': { $gte: start, $lte: end }
      };

      if (surveyId) {
        surveyQuery._id = surveyId;
      }

      const surveys = await Survey.find(surveyQuery).populate('responses.userId');

      let textResponses = [];

      // Collect all text responses
      surveys.forEach(survey => {
        survey.responses.forEach(response => {
          const user = response.userId;
          
          if (department && user.department !== department) {
            return;
          }

          survey.questions.forEach(question => {
            if (question.type === 'text') {
              const answerText = response.answers.get(question.id);
              if (answerText && typeof answerText === 'string' && answerText.trim().length > 0) {
                textResponses.push({
                  userId: user._id,
                  userName: user.name,
                  department: user.department,
                  questionId: question.id,
                  questionText: question.question,
                  responseText: answerText.trim(),
                  completedAt: response.completedAt,
                  sentiment: analyzeSentiment(answerText.trim())
                });
              }
            }
          });
        });
      });

      // Also get feedback from check-ins
      const checkInFeedback = await CheckIn.find({
        date: { $gte: start, $lte: end },
        feedback: { $exists: true, $ne: '', $ne: null }
      }).populate('userId', 'name department');

      checkInFeedback.forEach(checkIn => {
        if (!department || (checkIn.userId && checkIn.userId.department === department)) {
          textResponses.push({
            userId: checkIn.userId?._id,
            userName: checkIn.userId?.name || 'Unknown',
            department: checkIn.userId?.department || 'Unknown',
            questionId: 'checkin_feedback',
            questionText: 'Daily Check-in Feedback',
            responseText: checkIn.feedback,
            completedAt: checkIn.date,
            sentiment: analyzeSentiment(checkIn.feedback)
          });
        }
      });

      if (textResponses.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No text responses found for sentiment analysis'
        });
      }

      // Calculate sentiment distribution
      const sentimentCounts = {
        positive: 0,
        negative: 0,
        neutral: 0
      };

      const sentimentScores = [];
      textResponses.forEach(response => {
        sentimentCounts[response.sentiment.label]++;
        sentimentScores.push(response.sentiment.score);
      });

      // Department sentiment breakdown
      const departmentSentiment = {};
      textResponses.forEach(response => {
        if (!departmentSentiment[response.department]) {
          departmentSentiment[response.department] = {
            positive: 0,
            negative: 0,
            neutral: 0,
            total: 0,
            averageScore: 0,
            scores: []
          };
        }
        departmentSentiment[response.department][response.sentiment.label]++;
        departmentSentiment[response.department].total++;
        departmentSentiment[response.department].scores.push(response.sentiment.score);
      });

      // Calculate department averages
      Object.keys(departmentSentiment).forEach(dept => {
        const scores = departmentSentiment[dept].scores;
        departmentSentiment[dept].averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        departmentSentiment[dept].positivePercentage = Math.round((departmentSentiment[dept].positive / departmentSentiment[dept].total) * 100);
        departmentSentiment[dept].negativePercentage = Math.round((departmentSentiment[dept].negative / departmentSentiment[dept].total) * 100);
        departmentSentiment[dept].neutralPercentage = Math.round((departmentSentiment[dept].neutral / departmentSentiment[dept].total) * 100);
      });

      // Get most positive and negative responses
      const sortedByScore = textResponses.sort((a, b) => b.sentiment.score - a.sentiment.score);
      const mostPositive = sortedByScore.slice(0, 5);
      const mostNegative = sortedByScore.slice(-5).reverse();

      // Identify keywords and themes
      const positiveKeywords = extractKeywords(textResponses.filter(r => r.sentiment.label === 'positive'));
      const negativeKeywords = extractKeywords(textResponses.filter(r => r.sentiment.label === 'negative'));

      res.json({
        success: true,
        data: {
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString()
          },
          summary: {
            totalResponses: textResponses.length,
            averageSentimentScore: Math.round((sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length) * 100) / 100,
            overallSentiment: determineOverallSentiment(sentimentCounts)
          },
          sentimentDistribution: {
            positive: {
              count: sentimentCounts.positive,
              percentage: Math.round((sentimentCounts.positive / textResponses.length) * 100)
            },
            negative: {
              count: sentimentCounts.negative,
              percentage: Math.round((sentimentCounts.negative / textResponses.length) * 100)
            },
            neutral: {
              count: sentimentCounts.neutral,
              percentage: Math.round((sentimentCounts.neutral / textResponses.length) * 100)
            }
          },
          departmentSentiment,
          insights: {
            mostPositiveResponses: mostPositive.map(r => ({
              department: r.department,
              question: r.questionText,
              response: r.responseText.substring(0, 200) + (r.responseText.length > 200 ? '...' : ''),
              sentimentScore: Math.round(r.sentiment.score * 100) / 100
            })),
            mostNegativeResponses: mostNegative.map(r => ({
              department: r.department,
              question: r.questionText,
              response: r.responseText.substring(0, 200) + (r.responseText.length > 200 ? '...' : ''),
              sentimentScore: Math.round(r.sentiment.score * 100) / 100
            })),
            positiveKeywords: positiveKeywords.slice(0, 10),
            negativeKeywords: negativeKeywords.slice(0, 10),
            recommendations: generateSentimentRecommendations(sentimentCounts, departmentSentiment)
          }
        }
      });

    } catch (error) {
      console.error('Sentiment analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform sentiment analysis'
      });
    }
  }

  // Advanced engagement dashboard
  async getAdvancedEngagementDashboard(req, res) {
    try {
      // Check HR/Admin permissions
      if (req.user.role !== 'hr' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. HR or Admin role required.'
        });
      }

      const { startDate, endDate, department } = req.query;

      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Get all metrics in parallel for better performance
      const [
        demographics,
        enpsData,
        engagementData,
        sentimentData,
        riskData,
        companyOverview
      ] = await Promise.all([
        getDemographicsData(department),
        getENPSData(start, end, department),
        getEngagementData(start, end, department),
        getSentimentData(start, end, department),
        getRiskAssessmentData(department),
        getCompanyOverviewData(start, end)
      ]);

      // Calculate composite engagement score
      const compositeScore = calculateCompositeEngagementScore({
        enps: enpsData.enpsScore,
        overallEngagement: engagementData.overallScore,
        sentimentScore: sentimentData.averageScore,
        riskLevel: riskData.averageRiskScore
      });

      // Generate actionable insights
      const insights = generateAdvancedInsights({
        demographics,
        enps: enpsData,
        engagement: engagementData,
        sentiment: sentimentData,
        risk: riskData,
        compositeScore
      });

      // Historical trends
      const historicalTrends = await getHistoricalEngagementTrends(start, end, department);

      res.json({
        success: true,
        data: {
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            days: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
          },
          compositeEngagementScore: {
            score: compositeScore.score,
            level: compositeScore.level,
            components: compositeScore.components,
            benchmark: {
              excellent: '85-100',
              good: '70-84',
              fair: '55-69',
              poor: '0-54'
            }
          },
          keyMetrics: {
            totalEmployees: demographics.totalEmployees,
            enpsScore: enpsData.enpsScore,
            overallEngagementScore: engagementData.overallScore,
            averageSentimentScore: sentimentData.averageScore,
            highRiskEmployees: riskData.highRiskCount,
            engagementParticipation: Math.round((engagementData.participantCount / demographics.totalEmployees) * 100)
          },
          demographics: {
            summary: demographics.summary,
            distributions: demographics.distributions
          },
          enps: {
            score: enpsData.enpsScore,
            category: enpsData.category,
            distribution: enpsData.distribution,
            departmentBreakdown: enpsData.departmentBreakdown
          },
          engagement: {
            overallScore: engagementData.overallScore,
            dimensionScores: engagementData.dimensionScores,
            topDimensions: engagementData.topDimensions,
            bottomDimensions: engagementData.bottomDimensions
          },
          sentiment: {
            averageScore: sentimentData.averageScore,
            distribution: sentimentData.distribution,
            departmentBreakdown: sentimentData.departmentBreakdown,
            keyThemes: sentimentData.keyThemes
          },
          riskAssessment: {
            totalAtRisk: riskData.totalAtRisk,
            riskDistribution: riskData.riskDistribution,
            departmentRisks: riskData.departmentRisks
          },
          historicalTrends,
          insights: {
            strengths: insights.strengths,
            concerns: insights.concerns,
            opportunities: insights.opportunities,
            priorityActions: insights.priorityActions
          },
          recommendations: insights.recommendations
        }
      });

    } catch (error) {
      console.error('Advanced engagement dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate advanced engagement dashboard'
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

    // Use calculated risk level if available, otherwise use stored risk level
    const riskLevel = employee.calculatedRisk?.level || employee.wellness?.riskLevel;
    
    if (riskLevel === 'high') {
      indicators.push('High risk classification');
    }

    if (daysSinceLastCheckIn === 999) {
      indicators.push('No check-in history');
    } else if (daysSinceLastCheckIn > 14) {
      indicators.push('No check-in for over two weeks');
    } else if (daysSinceLastCheckIn > 7) {
      indicators.push('No check-in for over a week');
    }

    if (checkInData && checkInData.avgMood < 2.5) {
      indicators.push('Low average mood');
    } else if (!checkInData) {
      indicators.push('No mood data available');
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

// New helper functions for advanced analytics

// eNPS calculation helpers
async function calculateENPSTrend(startDate, endDate, department) {
  try {
    const monthlyTrends = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const monthQuery = {
        'questions.category': { $in: ['recommendation', 'loyalty', 'enps'] },
        'responses.completedAt': { $gte: monthStart, $lte: monthEnd }
      };

      const surveys = await Survey.find(monthQuery).populate('responses.userId');
      
      let monthlyResponses = [];
      surveys.forEach(survey => {
        survey.responses.forEach(response => {
          const user = response.userId;
          if (department && user.department !== department) return;
          
          survey.questions.forEach(question => {
            if (['recommendation', 'loyalty', 'enps'].includes(question.category)) {
              const score = parseInt(response.answers.get(question.id));
              if (!isNaN(score) && score >= 0 && score <= 10) {
                monthlyResponses.push(score);
              }
            }
          });
        });
      });

      if (monthlyResponses.length > 0) {
        const promoters = monthlyResponses.filter(s => s >= 9).length;
        const detractors = monthlyResponses.filter(s => s <= 6).length;
        const enpsScore = Math.round(((promoters - detractors) / monthlyResponses.length) * 100);
        
        monthlyTrends.push({
          month: monthStart.toISOString().substring(0, 7),
          enpsScore,
          responses: monthlyResponses.length
        });
      }
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return monthlyTrends;
  } catch (error) {
    console.error('eNPS trend calculation error:', error);
    return [];
  }
}

function generateENPSInsights(enpsScore, promoterPercentage, detractorPercentage, departmentBreakdown) {
  const insights = [];
  
  if (enpsScore >= 50) {
    insights.push({
      type: 'positive',
      message: 'Excellent eNPS score indicates strong employee advocacy and satisfaction.'
    });
  } else if (enpsScore < -10) {
    insights.push({
      type: 'negative',
      message: 'Low eNPS score requires immediate attention to employee satisfaction and retention.'
    });
  }
  
  if (detractorPercentage > 20) {
    insights.push({
      type: 'warning',
      message: `High detractor percentage (${Math.round(detractorPercentage)}%) suggests significant employee dissatisfaction.`
    });
  }
  
  // Department-specific insights
  const deptScores = Object.entries(departmentBreakdown)
    .map(([dept, data]) => ({ dept, score: data.enpsScore }))
    .sort((a, b) => b.score - a.score);
    
  if (deptScores.length > 1) {
    const topDept = deptScores[0];
    const bottomDept = deptScores[deptScores.length - 1];
    
    if (topDept.score - bottomDept.score > 30) {
      insights.push({
        type: 'departmental',
        message: `Significant variation between departments: ${topDept.dept} (${topDept.score}) vs ${bottomDept.dept} (${bottomDept.score}).`
      });
    }
  }
  
  return insights;
}

// Engagement scoring helpers
function categorizeEngagementScore(score) {
  if (score >= 4.5) return 'Highly Engaged';
  if (score >= 3.5) return 'Engaged';
  if (score >= 2.5) return 'Moderately Engaged';
  if (score >= 1.5) return 'Disengaged';
  return 'Highly Disengaged';
}

function calculatePercentile(score, min, max) {
  return Math.round(((score - min) / (max - min)) * 100);
}

function generateEngagementRecommendations(dimensionScores, overallScore) {
  const recommendations = [];
  
  if (overallScore < 3.0) {
    recommendations.push({
      priority: 'high',
      category: 'overall',
      action: 'Comprehensive engagement strategy needed',
      description: 'Overall engagement is low. Consider organization-wide initiatives to address fundamental engagement drivers.'
    });
  }
  
  // Find lowest scoring dimensions
  const sortedDimensions = Object.entries(dimensionScores)
    .filter(([_, data]) => data.averageScore > 0)
    .sort(([_, a], [__, b]) => a.averageScore - b.averageScore);
    
  if (sortedDimensions.length > 0) {
    const lowestDimension = sortedDimensions[0];
    if (lowestDimension[1].averageScore < 2.5) {
      recommendations.push({
        priority: 'high',
        category: lowestDimension[0],
        action: `Address ${lowestDimension[0]} concerns`,
        description: `${lowestDimension[0]} scored lowest (${Math.round(lowestDimension[1].averageScore * 10) / 10}). Focus on improving this dimension.`
      });
    }
  }
  
  return recommendations;
}

// Sentiment analysis helpers
function analyzeSentiment(text) {
  // Basic sentiment analysis using keyword matching
  // In production, you'd want to use a proper NLP library like sentiment or compromise
  const positiveWords = ['great', 'excellent', 'amazing', 'fantastic', 'wonderful', 'good', 'happy', 'satisfied', 'love', 'enjoy', 'positive', 'outstanding', 'perfect', 'brilliant', 'awesome'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'frustrated', 'angry', 'disappointed', 'unhappy', 'negative', 'poor', 'worst', 'annoying', 'difficult'];
  
  const words = text.toLowerCase().split(/\W+/);
  let positiveCount = 0;
  let negativeCount = 0;
  
  words.forEach(word => {
    if (positiveWords.includes(word)) positiveCount++;
    if (negativeWords.includes(word)) negativeCount++;
  });
  
  let score = 0;
  let label = 'neutral';
  
  if (positiveCount > negativeCount) {
    score = Math.min(1, (positiveCount - negativeCount) / words.length * 10);
    label = 'positive';
  } else if (negativeCount > positiveCount) {
    score = Math.max(-1, -(negativeCount - positiveCount) / words.length * 10);
    label = 'negative';
  }
  
  return { score, label };
}

function determineOverallSentiment(sentimentCounts) {
  const total = sentimentCounts.positive + sentimentCounts.negative + sentimentCounts.neutral;
  if (total === 0) return 'neutral';
  
  const positiveRatio = sentimentCounts.positive / total;
  const negativeRatio = sentimentCounts.negative / total;
  
  if (positiveRatio > 0.6) return 'positive';
  if (negativeRatio > 0.4) return 'negative';
  return 'mixed';
}

function extractKeywords(responses) {
  // Basic keyword extraction
  const wordCount = {};
  const excludeWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'must', 'a', 'an', 'this', 'that', 'these', 'those'];
  
  responses.forEach(response => {
    const words = response.responseText.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !excludeWords.includes(word));
      
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
  });
  
  return Object.entries(wordCount)
    .sort(([, a], [, b]) => b - a)
    .map(([word, count]) => ({ word, count }));
}

function generateSentimentRecommendations(sentimentCounts, departmentSentiment) {
  const recommendations = [];
  const total = sentimentCounts.positive + sentimentCounts.negative + sentimentCounts.neutral;
  
  if (sentimentCounts.negative / total > 0.3) {
    recommendations.push({
      priority: 'high',
      action: 'Address negative sentiment',
      description: `${Math.round((sentimentCounts.negative / total) * 100)}% of responses show negative sentiment. Investigate and address underlying issues.`
    });
  }
  
  // Department-specific recommendations
  Object.entries(departmentSentiment).forEach(([dept, data]) => {
    if (data.negativePercentage > 40) {
      recommendations.push({
        priority: 'high',
        action: `Focus on ${dept} department`,
        description: `${dept} shows ${data.negativePercentage}% negative sentiment. Requires targeted intervention.`
      });
    }
  });
  
  return recommendations;
}

// Advanced dashboard helper functions
async function getDemographicsData(department) {
  const query = { role: 'employee', isActive: true };
  if (department) query.department = department;
  
  const totalEmployees = await User.countDocuments(query);
  const avgAge = (await User.aggregate([
    { $match: query },
    { $group: { _id: null, avgAge: { $avg: '$demographics.age' } } }
  ]))[0]?.avgAge || 0;
  
  return {
    totalEmployees,
    summary: { totalEmployees, averageAge: Math.round(avgAge * 10) / 10 },
    distributions: {} // Simplified for brevity
  };
}

async function getENPSData(startDate, endDate, department) {
  // Simplified eNPS calculation
  return {
    enpsScore: 25, // Mock data
    category: 'Good',
    distribution: {},
    departmentBreakdown: {}
  };
}

async function getEngagementData(startDate, endDate, department) {
  return {
    overallScore: 3.8,
    dimensionScores: {},
    topDimensions: [],
    bottomDimensions: [],
    participantCount: 100
  };
}

async function getSentimentData(startDate, endDate, department) {
  return {
    averageScore: 0.3,
    distribution: {},
    departmentBreakdown: {},
    keyThemes: []
  };
}

async function getRiskAssessmentData(department) {
  const query = { role: 'employee', isActive: true };
  if (department) query.department = department;
  
  const highRiskCount = await User.countDocuments({ ...query, 'wellness.riskLevel': 'high' });
  
  return {
    totalAtRisk: highRiskCount,
    highRiskCount,
    averageRiskScore: 0.3,
    riskDistribution: {},
    departmentRisks: {}
  };
}

async function getCompanyOverviewData(startDate, endDate) {
  return {}; // Simplified
}

function calculateCompositeEngagementScore({ enps, overallEngagement, sentimentScore, riskLevel }) {
  // Normalize scores to 0-100 scale
  const normalizedENPS = Math.max(0, (enps + 100) / 2); // Convert -100 to 100 scale to 0-100
  const normalizedEngagement = (overallEngagement / 5) * 100; // Convert 1-5 scale to 0-100
  const normalizedSentiment = Math.max(0, (sentimentScore + 1) / 2 * 100); // Convert -1 to 1 scale to 0-100
  const normalizedRisk = Math.max(0, (1 - riskLevel) * 100); // Convert risk (0-1) to positive score
  
  // Weighted average
  const weights = { enps: 0.3, engagement: 0.4, sentiment: 0.2, risk: 0.1 };
  const score = (
    normalizedENPS * weights.enps +
    normalizedEngagement * weights.engagement +
    normalizedSentiment * weights.sentiment +
    normalizedRisk * weights.risk
  );
  
  let level = 'Poor';
  if (score >= 85) level = 'Excellent';
  else if (score >= 70) level = 'Good';
  else if (score >= 55) level = 'Fair';
  
  return {
    score: Math.round(score),
    level,
    components: {
      enps: Math.round(normalizedENPS),
      engagement: Math.round(normalizedEngagement),
      sentiment: Math.round(normalizedSentiment),
      risk: Math.round(normalizedRisk)
    }
  };
}

function generateAdvancedInsights(data) {
  return {
    strengths: [
      'Strong overall engagement in innovation dimension',
      'Positive sentiment trends in recent feedback'
    ],
    concerns: [
      'Below-average eNPS score compared to industry benchmark',
      'High risk employees concentrated in specific departments'
    ],
    opportunities: [
      'Leverage high-performing departments as best practice examples',
      'Implement targeted wellness programs for at-risk groups'
    ],
    priorityActions: [
      {
        priority: 'high',
        action: 'Conduct focus groups with detractors',
        timeline: '2 weeks',
        owner: 'HR Team'
      },
      {
        priority: 'medium',
        action: 'Develop recognition program',
        timeline: '1 month',
        owner: 'Management'
      }
    ],
    recommendations: [
      {
        category: 'engagement',
        action: 'Implement pulse surveys',
        impact: 'high',
        effort: 'medium'
      }
    ]
  };
}

async function getHistoricalEngagementTrends(startDate, endDate, department) {
  // Mock historical trend data
  return {
    enps: [
      { month: '2024-01', score: 20 },
      { month: '2024-02', score: 22 },
      { month: '2024-03', score: 25 }
    ],
    engagement: [
      { month: '2024-01', score: 3.5 },
      { month: '2024-02', score: 3.7 },
      { month: '2024-03', score: 3.8 }
    ],
    sentiment: [
      { month: '2024-01', score: 0.2 },
      { month: '2024-02', score: 0.25 },
      { month: '2024-03', score: 0.3 }
    ]
  };
}

module.exports = new AnalyticsController();