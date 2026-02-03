const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get dashboard overview data
router.get('/overview', 
  authorize('super_admin', 'system_admin', 'organization_admin', 'organization_user'),
  dashboardController.getDashboardOverview
);

// Get dashboard statistics
router.get('/stats', 
  authorize('super_admin', 'system_admin', 'organization_admin', 'organization_user'),
  dashboardController.getDashboardStats
);

// Get recent activities
router.get('/activities', 
  authorize('super_admin', 'system_admin', 'organization_admin', 'organization_user'),
  dashboardController.getRecentActivities
);

module.exports = router;