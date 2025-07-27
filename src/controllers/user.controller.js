const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const { sendResponse, sendError } = require('../utils/responseUtils');
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

    sendResponse(res, 200, 'Users retrieved successfully', {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    sendError(res, 500, 'Failed to fetch users', error.message);
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
      return sendError(res, 404, 'User not found');
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

    sendResponse(res, 200, 'User retrieved successfully', {
      user: {
        ...user,
        wellnessStats
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    sendError(res, 500, 'Failed to fetch user', error.message);
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
        return sendError(res, 400, 'User with this email already exists');
      }
      if (existingUser.employeeId === employeeId) {
        return sendError(res, 400, 'User with this employee ID already exists');
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

    sendResponse(res, 201, 'User created successfully', {
      user: userResponse
    });
  } catch (error) {
    console.error('Error creating user:', error);
    sendError(res, 500, 'Failed to create user', error.message);
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
        return sendError(res, 400, 'User with this email or employee ID already exists');
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    sendResponse(res, 200, 'User updated successfully', { user });
  } catch (error) {
    console.error('Error updating user:', error);
    sendError(res, 500, 'Failed to update user', error.message);
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
      return sendError(res, 400, 'Cannot delete your own account');
    }

    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // TODO: Consider soft delete instead of hard delete
    // and cleanup related data (check-ins, surveys, etc.)

    sendResponse(res, 200, 'User deleted successfully', {
      deletedUser: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    sendError(res, 500, 'Failed to delete user', error.message);
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
      return sendError(res, 400, 'isActive must be a boolean value');
    }

    // Prevent deactivating the current admin user
    if (id === req.user.id && !isActive) {
      return sendError(res, 400, 'Cannot deactivate your own account');
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive, updatedAt: new Date() },
      { new: true }
    ).select('-password -__v');

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    sendResponse(res, 200, `User ${isActive ? 'activated' : 'deactivated'} successfully`, {
      user
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    sendError(res, 500, 'Failed to update user status', error.message);
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
      return sendError(res, 400, 'userIds must be a non-empty array');
    }

    const validActions = ['activate', 'deactivate', 'delete'];
    if (!validActions.includes(action)) {
      return sendError(res, 400, 'Invalid action. Must be: activate, deactivate, or delete');
    }

    // Prevent actions on current admin user
    if (userIds.includes(req.user.id)) {
      return sendError(res, 400, 'Cannot perform bulk actions on your own account');
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

    sendResponse(res, 200, `Bulk ${action} completed successfully`, {
      action,
      affectedCount: result.modifiedCount || result.deletedCount,
      userIds
    });
  } catch (error) {
    console.error('Error performing bulk action:', error);
    sendError(res, 500, 'Failed to perform bulk action', error.message);
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
      return sendError(res, 400, 'Invalid role. Must be: employee, manager, hr, or admin');
    }

    // Prevent changing role of current admin user
    if (id === req.user.id) {
      return sendError(res, 400, 'Cannot change your own role');
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role, updatedAt: new Date() },
      { new: true }
    ).select('-password -__v');

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    sendResponse(res, 200, 'User role updated successfully', { user });
  } catch (error) {
    console.error('Error updating user role:', error);
    sendError(res, 500, 'Failed to update user role', error.message);
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
    
    sendResponse(res, 200, 'Departments retrieved successfully', {
      departments: departments.filter(dept => dept).sort()
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    sendError(res, 500, 'Failed to fetch departments', error.message);
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