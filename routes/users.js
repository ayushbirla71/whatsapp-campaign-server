const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const { authenticate, authorize, authorizeUserManagement } = require('../middleware/auth');
const { 
  validateUserRegistration, 
  validateUserUpdate, 
  validateUUID,
  validatePagination 
} = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// Get all users (with role-based filtering)
router.get('/', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validatePagination,
  userController.getUsers
);

// Get user by ID
router.get('/:userId', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('userId'),
  userController.getUserById
);

// Create new user
router.post('/', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUserRegistration,
  authorizeUserManagement,
  userController.createUser
);

// Update user
router.put('/:userId', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('userId'),
  validateUserUpdate,
  authorizeUserManagement,
  userController.updateUser
);

// Delete user
router.delete('/:userId', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('userId'),
  authorizeUserManagement,
  userController.deleteUser
);

module.exports = router;
