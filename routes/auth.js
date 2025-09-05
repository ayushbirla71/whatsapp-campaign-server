const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { 
  validateLogin, 
  validatePasswordChange,
  handleValidationErrors 
} = require('../middleware/validation');
const { body } = require('express-validator');

// Public routes
router.post('/login', validateLogin, authController.login);

router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
  handleValidationErrors
], authController.refreshToken);

router.post('/validate', authenticate, authController.validateToken);

// Protected routes (require authentication)
router.use(authenticate);

router.post('/logout', [
  body('refreshToken')
    .optional()
    .notEmpty()
    .withMessage('Refresh token cannot be empty'),
  handleValidationErrors
], authController.logout);

router.post('/logout-all', authController.logoutAll);

router.get('/profile', authController.getProfile);

router.post('/change-password', validatePasswordChange, authController.changePassword);

module.exports = router;
