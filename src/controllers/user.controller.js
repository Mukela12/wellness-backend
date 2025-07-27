const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');
const bcrypt = require('bcryptjs');

/**
 * User Management Controller
 * Handles CRUD operations for user management (Admin only)
 */

/**
 * Get all users with pagination and filtering
 * GET /api/users
 * Access: Admin only
 */
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      department = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Role filter
    if (role) {
      query.role = role;
    }
    
    // Department filter
    if (department) {
      query.department = department;
    }
    
    // Status filter
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query
    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select('-password -__v')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    sendSuccessResponse(res, {
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      }
    }, 200);
  } catch (error) {
    console.error('Error fetching users:', error);
    sendErrorResponseResponse(res, 'Failed to fetch users', 500);
  }
};

/**
 * Get user by ID with wellness stats
 * GET /api/users/:id
 * Access: Admin only
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('-password -__v').lean();
    
    if (!user) {
      return sendErrorResponse(res, 'User not found', 404);
    }

    // Get wellness statistics
    const checkInStats = await CheckIn.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalCheckIns: { $sum: 1 },
          averageMood: { $avg: '$mood' },
          totalHappyCoins: { $sum: '$happyCoinsEarned' }
        }
      }
    ]);

    const wellnessStats = checkInStats[0] || {
      totalCheckIns: 0,
      averageMood: 0,
      totalHappyCoins: 0
    };

    sendSuccessResponse(res, {
      message: 'User retrieved successfully',
      data: {
        user: {
          ...user,
          wellnessStats
        }
      }
    }, 200);
  } catch (error) {
    console.error('Error fetching user:', error);
    sendErrorResponse(res, 'Failed to fetch user', 500);
  }
};

/**
 * Create new user
 * POST /api/users
 * Access: Admin only
 */
const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = 'employee',
      department,
      employeeId,
      phone,
      isActive = true
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { employeeId }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return sendErrorResponse(res, 'User with this email already exists', 400);
      }
      if (existingUser.employeeId === employeeId) {
        return sendErrorResponse(res, 'User with this employee ID already exists', 400);
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      department,
      employeeId,
      phone,
      isActive,
      isEmailVerified: true, // Admin created users are verified by default
      wellness: {
        happyCoins: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalCheckIns: 0,
        averageMood: 0,
        riskLevel: 'low'
      }
    });

    await user.save();

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    sendSuccessResponse(res, {
      message: 'User created successfully',
      data: {
        user: userResponse
      }
    }, 201);
  } catch (error) {
    console.error('Error creating user:', error);
    sendErrorResponse(res, 'Failed to create user', 500);
  }
};

/**
 * Update user
 * PUT /api/users/:id
 * Access: Admin only
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remove fields that shouldn't be updated via this endpoint
    delete updates.password;
    delete updates._id;
    delete updates.__v;
    delete updates.wellness;

    // If email or employeeId is being updated, check for duplicates
    if (updates.email || updates.employeeId) {
      const query = { _id: { $ne: id } };
      if (updates.email) query.email = updates.email;
      if (updates.employeeId) query.employeeId = updates.employeeId;
      
      const existingUser = await User.findOne(query);
      if (existingUser) {
        return sendErrorResponse(res, 'User with this email or employee ID already exists', 400);
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!user) {
      return sendErrorResponse(res, 'User not found', 404);
    }

    sendSuccessResponse(res, {
      message: 'User updated successfully',
      data: { user }
    }, 200);
  } catch (error) {
    console.error('Error updating user:', error);
    sendErrorResponse(res, 'Failed to update user', 500);
  }
};

/**
 * Delete user
 * DELETE /api/users/:id
 * Access: Admin only
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deletion of the current admin user
    if (id === req.user.id) {
      return sendErrorResponse(res, 'Cannot delete your own account', 400);
    }

    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return sendErrorResponse(res, 'User not found', 404);
    }

    // TODO: Consider soft delete instead of hard delete
    // and cleanup related data (check-ins, surveys, etc.)

    sendSuccessResponse(res, {
      message: 'User deleted successfully',
      data: {
        deletedUser: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      }
    }, 200);
  } catch (error) {
    console.error('Error deleting user:', error);
    sendErrorResponse(res, 'Failed to delete user', 500);
  }
};

/**
 * Toggle user status (active/inactive)
 * PATCH /api/users/:id/status
 * Access: Admin only
 */
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return sendErrorResponse(res, 'isActive must be a boolean value', 400);
    }

    // Prevent deactivating the current admin user
    if (id === req.user.id && !isActive) {
      return sendErrorResponse(res, 'Cannot deactivate your own account', 400);
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive, updatedAt: new Date() },
      { new: true }
    ).select('-password -__v');

    if (!user) {
      return sendErrorResponse(res, 'User not found', 404);
    }

    sendSuccessResponse(res, {
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        user
      }
    }, 200);
  } catch (error) {
    console.error('Error updating user status:', error);
    sendErrorResponse(res, 'Failed to update user status', 500);
  }
};

/**
 * Bulk user actions
 * POST /api/users/bulk-action
 * Access: Admin only
 */
const bulkUserAction = async (req, res) => {
  try {
    const { action, userIds } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return sendErrorResponse(res, 'userIds must be a non-empty array', 400);
    }

    const validActions = ['activate', 'deactivate', 'delete'];
    if (!validActions.includes(action)) {
      return sendErrorResponse(res, 'Invalid action. Must be: activate, deactivate, or delete', 400);
    }

    // Prevent actions on current admin user
    if (userIds.includes(req.user.id)) {
      return sendErrorResponse(res, 'Cannot perform bulk actions on your own account', 400);
    }

    let result;
    
    switch (action) {
      case 'activate':
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { isActive: true, updatedAt: new Date() }
        );
        break;
        
      case 'deactivate':
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { isActive: false, updatedAt: new Date() }
        );
        break;
        
      case 'delete':
        result = await User.deleteMany({ _id: { $in: userIds } });
        break;
    }

    sendSuccessResponse(res, {
      message: `Bulk ${action} completed successfully`,
      data: {
        action,
        affectedCount: result.modifiedCount || result.deletedCount,
        userIds
      }
    }, 200);
  } catch (error) {
    console.error('Error performing bulk action:', error);
    sendErrorResponse(res, 'Failed to perform bulk action', 500);
  }
};

/**
 * Update user role
 * PATCH /api/users/:id/role
 * Access: Admin only
 */
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    const validRoles = ['employee', 'manager', 'hr', 'admin'];
    if (!validRoles.includes(role)) {
      return sendErrorResponse(res, 'Invalid role. Must be: employee, manager, hr, or admin', 400);
    }

    // Prevent changing role of current admin user
    if (id === req.user.id) {
      return sendErrorResponse(res, 'Cannot change your own role', 400);
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role, updatedAt: new Date() },
      { new: true }
    ).select('-password -__v');

    if (!user) {
      return sendErrorResponse(res, 'User not found', 404);
    }

    sendSuccessResponse(res, {
      message: 'User role updated successfully',
      data: { user }
    }, 200);
  } catch (error) {
    console.error('Error updating user role:', error);
    sendErrorResponse(res, 'Failed to update user role', 500);
  }
};

/**
 * Get user departments (for dropdowns)
 * GET /api/users/departments
 * Access: Admin only
 */
const getDepartments = async (req, res) => {
  try {
    const departments = await User.distinct('department');
    
    sendSuccessResponse(res, {
      message: 'Departments retrieved successfully',
      data: {
        departments: departments.filter(dept => dept).sort()
      }
    }, 200);
  } catch (error) {
    console.error('Error fetching departments:', error);
    sendErrorResponse(res, 'Failed to fetch departments', 500);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  bulkUserAction,
  updateUserRole,
  getDepartments
};