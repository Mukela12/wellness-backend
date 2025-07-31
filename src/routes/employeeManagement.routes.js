const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const { authenticate: auth, authorize } = require('../middleware/auth');
const employeeManagementController = require('../controllers/employeeManagement.controller');

// Validation rules
const employeeCreateValidation = [
  body('employeeId')
    .notEmpty()
    .withMessage('Employee ID is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('Employee ID must be between 3 and 20 characters')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Employee ID must contain only uppercase letters, numbers, and hyphens'),
  
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .trim(),
  
  body('phone')
    .optional()
    .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
    .withMessage('Invalid phone number format'),
  
  body('department')
    .notEmpty()
    .withMessage('Department is required')
    .isIn(['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Product', 'Design'])
    .withMessage('Invalid department'),
  
  body('role')
    .optional()
    .isIn(['employee', 'manager', 'hr', 'admin'])
    .withMessage('Invalid role'),
  
  body('employment.jobTitle')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Job title cannot exceed 100 characters'),
  
  body('employment.seniority')
    .optional()
    .isIn(['intern', 'junior', 'mid-level', 'senior', 'lead', 'manager', 'director', 'executive'])
    .withMessage('Invalid seniority level'),
  
  body('employment.workLocation')
    .optional()
    .isIn(['remote', 'hybrid', 'on-site'])
    .withMessage('Invalid work location'),
  
  body('demographics.age')
    .optional()
    .isInt({ min: 16, max: 100 })
    .withMessage('Age must be between 16 and 100'),
  
  body('demographics.gender')
    .optional()
    .isIn(['male', 'female', 'non-binary', 'prefer-not-to-say'])
    .withMessage('Invalid gender option')
];

const employeeUpdateValidation = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .trim(),
  
  body('phone')
    .optional()
    .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
    .withMessage('Invalid phone number format'),
  
  body('department')
    .optional()
    .isIn(['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Product', 'Design'])
    .withMessage('Invalid department'),
  
  body('role')
    .optional()
    .isIn(['employee', 'manager', 'hr', 'admin'])
    .withMessage('Invalid role')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .isIn(['name', 'employeeId', 'email', 'department', 'role', 'createdAt', 'wellness.riskLevel'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  query('department')
    .optional()
    .isIn(['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Product', 'Design'])
    .withMessage('Invalid department filter'),
  
  query('role')
    .optional()
    .isIn(['employee', 'manager', 'hr', 'admin'])
    .withMessage('Invalid role filter'),
  
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'all'])
    .withMessage('Invalid status filter'),
  
  query('riskLevel')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid risk level filter')
];

const passwordResetValidation = [
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

// Employee Management Routes (HR and Admin only)

// GET /api/employee-management/dashboard - Get dashboard summary
router.get('/dashboard',
  auth,
  authorize(['hr', 'admin']),
  employeeManagementController.getEmployeeDashboardSummary
);

// GET /api/employee-management/employees - Get all employees with filtering/pagination
router.get('/employees',
  auth,
  authorize(['hr', 'admin']),
  queryValidation,
  employeeManagementController.getAllEmployees
);

// GET /api/employee-management/employees/:employeeId - Get single employee details
router.get('/employees/:employeeId',
  auth,
  authorize(['hr', 'admin']),
  param('employeeId').isMongoId().withMessage('Invalid employee ID'),
  employeeManagementController.getEmployeeById
);

// POST /api/employee-management/employees - Create new employee
router.post('/employees',
  auth,
  authorize(['hr', 'admin']),
  employeeCreateValidation,
  employeeManagementController.createEmployee
);

// PUT /api/employee-management/employees/:employeeId - Update employee
router.put('/employees/:employeeId',
  auth,
  authorize(['hr', 'admin']),
  param('employeeId').isMongoId().withMessage('Invalid employee ID'),
  employeeUpdateValidation,
  employeeManagementController.updateEmployee
);

// DELETE /api/employee-management/employees/:employeeId - Deactivate employee
router.delete('/employees/:employeeId',
  auth,
  authorize(['hr', 'admin']),
  param('employeeId').isMongoId().withMessage('Invalid employee ID'),
  employeeManagementController.deleteEmployee
);

// POST /api/employee-management/employees/:employeeId/activate - Activate employee
router.post('/employees/:employeeId/activate',
  auth,
  authorize(['hr', 'admin']),
  param('employeeId').isMongoId().withMessage('Invalid employee ID'),
  employeeManagementController.activateEmployee
);

// POST /api/employee-management/employees/:employeeId/reset-password - Reset employee password
router.post('/employees/:employeeId/reset-password',
  auth,
  authorize(['hr', 'admin']),
  param('employeeId').isMongoId().withMessage('Invalid employee ID'),
  passwordResetValidation,
  employeeManagementController.resetEmployeePassword
);

module.exports = router;