const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const Journal = require('../models/Journal');
const Survey = require('../models/Survey');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

// Get all employees with pagination and filtering
const getAllEmployees = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      search = '',
      department = '',
      role = '',
      status = '',
      riskLevel = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { role: { $ne: 'super-admin' } }; // Exclude super-admin from employee list

    // Search across multiple fields
    if (search.trim()) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { 'employment.jobTitle': { $regex: search, $options: 'i' } }
      ];
    }

    // Department filter
    if (department) {
      query.department = department;
    }

    // Role filter
    if (role) {
      query.role = role;
    }

    // Status filter
    if (status) {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }

    // Risk level filter
    if (riskLevel) {
      query['wellness.riskLevel'] = riskLevel;
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [employees, totalCount] = await Promise.all([
      User.find(query)
        .select('-password -refreshTokens')
        .populate('employment.manager', 'name employeeId')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ]);

    // Get wellness statistics for each employee
    const employeesWithStats = await Promise.all(
      employees.map(async (employee) => {
        const [checkInCount, journalCount, lastActivity] = await Promise.all([
          CheckIn.countDocuments({ userId: employee._id }),
          Journal.countDocuments({ userId: employee._id, isDeleted: false }),
          CheckIn.findOne({ userId: employee._id }).sort({ createdAt: -1 }).select('createdAt')
        ]);

        return {
          ...employee,
          stats: {
            totalCheckIns: checkInCount,
            totalJournals: journalCount,
            lastActivity: lastActivity?.createdAt || null,
            daysSinceLastActivity: lastActivity 
              ? Math.floor((new Date() - new Date(lastActivity.createdAt)) / (1000 * 60 * 60 * 24))
              : null
          }
        };
      })
    );

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        employees: employeesWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        filters: {
          search,
          department,
          role,
          status,
          riskLevel
        }
      }
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single employee details
const getEmployeeById = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await User.findById(employeeId)
      .select('-password -refreshTokens')
      .populate('employment.manager', 'name employeeId email')
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get detailed wellness statistics
    const [
      checkIns,
      journals,
      surveyResponses,
      recentActivity
    ] = await Promise.all([
      CheckIn.find({ userId: employeeId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('mood energy stress createdAt feedback'),
      Journal.find({ userId: employeeId, isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title mood wordCount createdAt'),
      Survey.find({ 'responses.userId': employeeId })
        .select('title responses.$ responses.completedAt')
        .sort({ 'responses.completedAt': -1 })
        .limit(5),
      CheckIn.findOne({ userId: employeeId })
        .sort({ createdAt: -1 })
        .select('createdAt')
    ]);

    // Calculate wellness trends
    const moodTrend = checkIns.slice(0, 7).map(c => ({
      date: c.createdAt,
      mood: c.mood,
      energy: c.energy,
      stress: c.stress
    }));

    // Calculate engagement score
    const daysSinceLastActivity = recentActivity 
      ? Math.floor((new Date() - new Date(recentActivity.createdAt)) / (1000 * 60 * 60 * 24))
      : null;
    
    const engagementScore = daysSinceLastActivity !== null 
      ? Math.max(0, 100 - (daysSinceLastActivity * 5)) 
      : 0;

    res.json({
      success: true,
      data: {
        employee,
        wellness: {
          recentCheckIns: checkIns,
          recentJournals: journals,
          recentSurveys: surveyResponses.map(s => ({
            title: s.title,
            completedAt: s.responses[0]?.completedAt
          })),
          moodTrend,
          engagementScore,
          daysSinceLastActivity
        },
        stats: {
          totalCheckIns: checkIns.length,
          totalJournals: journals.length,
          totalSurveys: surveyResponses.length,
          lastActivity: recentActivity?.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Error fetching employee details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create new employee
const createEmployee = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      employeeId,
      email,
      password,
      name,
      phone,
      department,
      role = 'employee',
      employment,
      demographics,
      notifications
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { employeeId }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email 
          ? 'Email already registered' 
          : 'Employee ID already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create employee
    const newEmployee = new User({
      employeeId,
      email,
      password: hashedPassword,
      name,
      phone,
      department,
      role,
      employment: {
        hireDate: employment?.hireDate || new Date(),
        jobTitle: employment?.jobTitle,
        seniority: employment?.seniority,
        workLocation: employment?.workLocation || 'on-site',
        manager: employment?.manager
      },
      demographics: demographics || {},
      notifications: {
        checkInReminder: notifications?.checkInReminder !== false,
        surveyReminder: notifications?.surveyReminder !== false,
        rewardUpdates: notifications?.rewardUpdates || false,
        preferredChannel: notifications?.preferredChannel || 'email',
        reminderTime: notifications?.reminderTime || '09:00'
      },
      isActive: true,
      isEmailVerified: false
    });

    await newEmployee.save();

    // Remove password from response
    const employeeResponse = newEmployee.toObject();
    delete employeeResponse.password;

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: employeeResponse
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create employee',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update employee
const updateEmployee = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { employeeId } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.password;
    delete updateData.refreshTokens;
    delete updateData._id;

    // If updating email or employeeId, check for uniqueness
    if (updateData.email || updateData.employeeId) {
      const query = { _id: { $ne: employeeId } };
      if (updateData.email) query.$or = [{ email: updateData.email }];
      if (updateData.employeeId) {
        if (query.$or) {
          query.$or.push({ employeeId: updateData.employeeId });
        } else {
          query.$or = [{ employeeId: updateData.employeeId }];
        }
      }

      const existingUser = await User.findOne(query);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: existingUser.email === updateData.email 
            ? 'Email already in use' 
            : 'Employee ID already in use'
        });
      }
    }

    const updatedEmployee = await User.findByIdAndUpdate(
      employeeId,
      updateData,
      { 
        new: true, 
        runValidators: true,
        select: '-password -refreshTokens'
      }
    ).populate('employment.manager', 'name employeeId');

    if (!updatedEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: updatedEmployee
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employee',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete employee (soft delete)
const deleteEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await User.findByIdAndUpdate(
      employeeId,
      { 
        isActive: false,
        updatedAt: new Date()
      },
      { new: true, select: '-password -refreshTokens' }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee deactivated successfully',
      data: employee
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete employee',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Activate employee
const activateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await User.findByIdAndUpdate(
      employeeId,
      { 
        isActive: true,
        updatedAt: new Date()
      },
      { new: true, select: '-password -refreshTokens' }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee activated successfully',
      data: employee
    });
  } catch (error) {
    console.error('Error activating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate employee',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reset employee password
const resetEmployeePassword = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const employee = await User.findByIdAndUpdate(
      employeeId,
      { 
        password: hashedPassword,
        updatedAt: new Date()
      },
      { new: true, select: 'name email employeeId' }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Password reset successfully',
      data: employee
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get employee dashboard summary
const getEmployeeDashboardSummary = async (req, res) => {
  try {
    const totalEmployees = await User.countDocuments({ role: { $ne: 'super-admin' } });
    const activeEmployees = await User.countDocuments({ role: { $ne: 'super-admin' }, isActive: true });
    const inactiveEmployees = totalEmployees - activeEmployees;

    // Department breakdown
    const departmentStats = await User.aggregate([
      { $match: { role: { $ne: 'super-admin' } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Risk level breakdown
    const riskStats = await User.aggregate([
      { $match: { role: { $ne: 'super-admin' }, isActive: true } },
      { $group: { _id: '$wellness.riskLevel', count: { $sum: 1 } } }
    ]);

    // Recent activities
    const recentEmployees = await User.find({ role: { $ne: 'super-admin' } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name employeeId department createdAt')
      .lean();

    res.json({
      success: true,
      data: {
        overview: {
          totalEmployees,
          activeEmployees,
          inactiveEmployees,
          activePercentage: Math.round((activeEmployees / totalEmployees) * 100)
        },
        departmentStats,
        riskStats,
        recentEmployees
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  activateEmployee,
  resetEmployeePassword,
  getEmployeeDashboardSummary
};