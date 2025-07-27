const { body, param, query, validationResult } = require('express-validator');

/**
 * User Management Validation Rules
 */

// Create user validation
const createUserValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('role')
    .optional()
    .isIn(['employee', 'manager', 'hr', 'admin'])
    .withMessage('Role must be one of: employee, manager, hr, admin'),

  body('department')
    .trim()
    .notEmpty()
    .withMessage('Department is required')
    .isLength({ max: 100 })
    .withMessage('Department name cannot exceed 100 characters'),

  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required')
    .isLength({ max: 50 })
    .withMessage('Employee ID cannot exceed 50 characters'),

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

// Update user validation
const updateUserValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('role')
    .optional()
    .isIn(['employee', 'manager', 'hr', 'admin'])
    .withMessage('Role must be one of: employee, manager, hr, admin'),

  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department name cannot exceed 100 characters'),

  body('employeeId')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Employee ID cannot exceed 50 characters'),

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

// Toggle status validation
const toggleStatusValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('isActive')
    .isBoolean()
    .withMessage('isActive is required and must be a boolean value')
];

// Update role validation
const updateRoleValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('role')
    .isIn(['employee', 'manager', 'hr', 'admin'])
    .withMessage('Role must be one of: employee, manager, hr, admin')
];

// Bulk action validation
const bulkActionValidation = [
  body('action')
    .isIn(['activate', 'deactivate', 'delete'])
    .withMessage('Action must be one of: activate, deactivate, delete'),

  body('userIds')
    .isArray({ min: 1 })
    .withMessage('userIds must be a non-empty array')
    .custom((userIds) => {
      if (!userIds.every(id => /^[0-9a-fA-F]{24}$/.test(id))) {
        throw new Error('All user IDs must be valid MongoDB ObjectIDs');
      }
      return true;
    })
];

// Get users query validation
const getUsersQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term cannot exceed 100 characters'),

  query('role')
    .optional()
    .isIn(['employee', 'manager', 'hr', 'admin'])
    .withMessage('Role filter must be one of: employee, manager, hr, admin'),

  query('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department filter cannot exceed 100 characters'),

  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status filter must be either active or inactive'),

  query('sortBy')
    .optional()
    .isIn(['name', 'email', 'role', 'department', 'createdAt', 'lastLogin'])
    .withMessage('sortBy must be one of: name, email, role, department, createdAt, lastLogin'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be either asc or desc')
];

// ID parameter validation
const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID')
];

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

module.exports = {
  createUserValidation,
  updateUserValidation,
  toggleStatusValidation,
  updateRoleValidation,
  bulkActionValidation,
  getUsersQueryValidation,
  idValidation,
  validate
};