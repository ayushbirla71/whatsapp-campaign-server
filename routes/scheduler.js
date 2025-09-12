const express = require("express");
const router = express.Router();

const schedulerController = require("../controllers/schedulerController");
const { authenticate, authorize } = require("../middleware/auth");

// All routes require authentication
router.use(authenticate);

/**
 * @route POST /api/scheduler/start
 * @desc Start the campaign scheduler service
 * @access Private (Super Admin, System Admin only)
 */
router.post(
  "/start",
  authorize("super_admin", "system_admin"),
  schedulerController.startScheduler
);

/**
 * @route POST /api/scheduler/stop
 * @desc Stop the campaign scheduler service
 * @access Private (Super Admin, System Admin only)
 */
router.post(
  "/stop",
  authorize("super_admin", "system_admin"),
  schedulerController.stopScheduler
);

/**
 * @route GET /api/scheduler/status
 * @desc Get scheduler status and health information
 * @access Private (Super Admin, System Admin only)
 */
router.get(
  "/status",
  authorize("super_admin", "system_admin"),
  schedulerController.getSchedulerStatus
);

/**
 * @route POST /api/scheduler/check-campaigns
 * @desc Manually trigger campaign check (for testing/debugging)
 * @access Private (Super Admin, System Admin only)
 */
router.post(
  "/check-campaigns",
  authorize("super_admin", "system_admin"),
  schedulerController.checkCampaigns
);

/**
 * @route GET /api/scheduler/queue-health
 * @desc Get SQS queue health information
 * @access Private (Super Admin, System Admin only)
 */
router.get(
  "/queue-health",
  authorize("super_admin", "system_admin"),
  schedulerController.getQueueHealth
);

module.exports = router;
