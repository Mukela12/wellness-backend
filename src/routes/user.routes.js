const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  createUserValidation,
  updateUserValidation,
  toggleStatusValidation,
  updateRoleValidation,
  bulkActionValidation,
  getUsersQueryValidation,
  idValidation,
  validate
} = require('../middleware/validation/userValidation');
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  bulkUserAction,
  updateUserRole,
  getDepartments
} = require('../controllers/user.controller');

/**
 * User Management Routes
 * All routes require admin authentication
 */

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filtering
 * @access  Admin only
 * @query   page, limit, search, role, department, status, sortBy, sortOrder
 */
router.get('/', authenticate, authorize('admin'), getUsersQueryValidation, validate, getAllUsers);

/**
 * @route   GET /api/users/departments
 * @desc    Get all departments (for dropdowns)
 * @access  Admin only
 */
router.get('/departments', authenticate, authorize('admin'), getDepartments);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID with wellness stats
 * @access  Admin only
 */
router.get('/:id', authenticate, authorize('admin'), idValidation, validate, getUserById);

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Admin only
 * @body    name, email, password, role, department, employeeId, phone
 */
router.post('/', authenticate, authorize('admin'), createUserValidation, validate, createUser);

/**
 * @route   POST /api/users/bulk-action
 * @desc    Perform bulk actions on users
 * @access  Admin only
 * @body    action (activate|deactivate|delete), userIds[]
 */
router.post('/bulk-action', authenticate, authorize('admin'), bulkActionValidation, validate, bulkUserAction);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user details
 * @access  Admin only
 * @body    name, email, role, department, employeeId, phone, isActive
 */
router.put('/:id', authenticate, authorize('admin'), updateUserValidation, validate, updateUser);

/**
 * @route   PATCH /api/users/:id/status
 * @desc    Toggle user active/inactive status
 * @access  Admin only
 * @body    isActive (boolean)
 */
router.patch('/:id/status', authenticate, authorize('admin'), toggleStatusValidation, validate, toggleUserStatus);

/**
 * @route   PATCH /api/users/:id/role
 * @desc    Update user role
 * @access  Admin only
 * @body    role (employee|manager|hr|admin)
 */
router.patch('/:id/role', authenticate, authorize('admin'), updateRoleValidation, validate, updateUserRole);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Admin only
 */
router.delete('/:id', authenticate, authorize('admin'), idValidation, validate, deleteUser);

module.exports = router;