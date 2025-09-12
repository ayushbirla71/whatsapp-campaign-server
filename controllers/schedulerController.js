const asyncHandler = require("../middleware/asyncHandler");
const AppError = require("../utils/appError");
const logger = require("../utils/logger");
const campaignSchedulerService = require("../services/campaignSchedulerService");

/**
 * Start the campaign scheduler service
 * @route POST /api/scheduler/start
 * @access Private (Super Admin, System Admin only)
 */
const startScheduler = asyncHandler(async (req, res) => {
  // Only super admin and system admin can control the scheduler
  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Access denied. Only super admin and system admin can control the scheduler",
      403
    );
  }

  try {
    await campaignSchedulerService.startScheduler();

    logger.info("Campaign scheduler started", {
      startedBy: req.user.id,
      userRole: req.user.role,
    });

    res.status(200).json({
      success: true,
      message: "Campaign scheduler started successfully",
      data: {
        status: "running",
        startedAt: new Date().toISOString(),
        startedBy: req.user.id,
      },
    });
  } catch (error) {
    logger.error("Error starting campaign scheduler", {
      error: error.message,
      userId: req.user.id,
    });
    throw new AppError(`Failed to start scheduler: ${error.message}`, 500);
  }
});

/**
 * Stop the campaign scheduler service
 * @route POST /api/scheduler/stop
 * @access Private (Super Admin, System Admin only)
 */
const stopScheduler = asyncHandler(async (req, res) => {
  // Only super admin and system admin can control the scheduler
  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Access denied. Only super admin and system admin can control the scheduler",
      403
    );
  }

  try {
    await campaignSchedulerService.stopScheduler();

    logger.info("Campaign scheduler stopped", {
      stoppedBy: req.user.id,
      userRole: req.user.role,
    });

    res.status(200).json({
      success: true,
      message: "Campaign scheduler stopped successfully",
      data: {
        status: "stopped",
        stoppedAt: new Date().toISOString(),
        stoppedBy: req.user.id,
      },
    });
  } catch (error) {
    logger.error("Error stopping campaign scheduler", {
      error: error.message,
      userId: req.user.id,
    });
    throw new AppError(`Failed to stop scheduler: ${error.message}`, 500);
  }
});

/**
 * Get scheduler status and health information
 * @route GET /api/scheduler/status
 * @access Private (Super Admin, System Admin only)
 */
const getSchedulerStatus = asyncHandler(async (req, res) => {
  // Only super admin and system admin can view scheduler status
  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Access denied. Only super admin and system admin can view scheduler status",
      403
    );
  }

  try {
    const status = await campaignSchedulerService.getSchedulerStatus();

    res.status(200).json({
      success: true,
      message: "Scheduler status retrieved successfully",
      data: status,
    });
  } catch (error) {
    logger.error("Error getting scheduler status", {
      error: error.message,
      userId: req.user.id,
    });
    throw new AppError(`Failed to get scheduler status: ${error.message}`, 500);
  }
});

/**
 * Manually trigger campaign check (for testing/debugging)
 * @route POST /api/scheduler/check-campaigns
 * @access Private (Super Admin, System Admin only)
 */
const checkCampaigns = asyncHandler(async (req, res) => {
  // Only super admin and system admin can manually trigger checks
  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Access denied. Only super admin and system admin can trigger campaign checks",
      403
    );
  }

  try {
    // Manually trigger campaign check
    await campaignSchedulerService.checkAndProcessCampaigns();

    logger.info("Manual campaign check triggered", {
      triggeredBy: req.user.id,
      userRole: req.user.role,
    });

    res.status(200).json({
      success: true,
      message: "Campaign check completed successfully",
      data: {
        checkedAt: new Date().toISOString(),
        triggeredBy: req.user.id,
      },
    });
  } catch (error) {
    logger.error("Error during manual campaign check", {
      error: error.message,
      userId: req.user.id,
    });
    throw new AppError(`Failed to check campaigns: ${error.message}`, 500);
  }
});

/**
 * Get SQS queue health information
 * @route GET /api/scheduler/queue-health
 * @access Private (Super Admin, System Admin only)
 */
const getQueueHealth = asyncHandler(async (req, res) => {
  // Only super admin and system admin can view queue health
  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Access denied. Only super admin and system admin can view queue health",
      403
    );
  }

  try {
    // Get SQS queue attributes for health check
    const queueAttributes = await campaignSchedulerService.sqs
      .getQueueAttributes({
        QueueUrl: campaignSchedulerService.queueUrl,
        AttributeNames: [
          "ApproximateNumberOfMessages",
          "ApproximateNumberOfMessagesNotVisible",
          "ApproximateNumberOfMessagesDelayed",
          "CreatedTimestamp",
          "LastModifiedTimestamp",
        ],
      })
      .promise();

    const healthData = {
      queueUrl: campaignSchedulerService.queueUrl,
      messagesAvailable: parseInt(
        queueAttributes.Attributes.ApproximateNumberOfMessages || "0"
      ),
      messagesInFlight: parseInt(
        queueAttributes.Attributes.ApproximateNumberOfMessagesNotVisible || "0"
      ),
      messagesDelayed: parseInt(
        queueAttributes.Attributes.ApproximateNumberOfMessagesDelayed || "0"
      ),
      queueCreated: new Date(
        parseInt(queueAttributes.Attributes.CreatedTimestamp) * 1000
      ).toISOString(),
      lastModified: new Date(
        parseInt(queueAttributes.Attributes.LastModifiedTimestamp) * 1000
      ).toISOString(),
      healthCheckAt: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      message: "Queue health information retrieved successfully",
      data: healthData,
    });
  } catch (error) {
    logger.error("Error getting queue health", {
      error: error.message,
      userId: req.user.id,
    });
    throw new AppError(`Failed to get queue health: ${error.message}`, 500);
  }
});

module.exports = {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  checkCampaigns,
  getQueueHealth,
};
