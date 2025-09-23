const express = require("express");
const router = express.Router();

const campaignController = require("../controllers/campaignController");
const audienceController = require("../controllers/audienceController");
const {
  authenticate,
  authorize,
  authorizeOrganization,
} = require("../middleware/auth");
const {
  validateCampaignCreation,
  validateCampaignUpdate,
  validateCampaignRejection,
  validateAudienceCreation,
  validateBulkAudience,
  validateMessageStatusUpdate,
  validateRemoveAudience,
  validateUUID,
  validatePagination,
} = require("../middleware/validation");

// All routes require authentication
router.use(authenticate);

// Campaign approval routes (super admin and system admin only)
router.get(
  "/pending-approval",
  authorize("super_admin", "system_admin"),
  campaignController.getPendingApprovalCampaigns
);

// Organization-specific campaign routes
// Get campaigns for an organization
router.get(
  "/organization/:organizationId",
  authorize(
    "super_admin",
    "system_admin",
    "organization_admin",
    "organization_user"
  ),
  validateUUID("organizationId"),
  validatePagination,
  authorizeOrganization,
  campaignController.getCampaigns
);

// Create campaign for an organization
router.post(
  "/organization/:organizationId",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("organizationId"),
  validateCampaignCreation,
  authorizeOrganization,
  campaignController.createCampaign
);

// Get campaign statistics for an organization
router.get(
  "/organization/:organizationId/stats",
  authorize(
    "super_admin",
    "system_admin",
    "organization_admin",
    "organization_user"
  ),
  validateUUID("organizationId"),
  authorizeOrganization,
  campaignController.getCampaignStats
);

// Campaign-specific routes
// Get campaign by ID
router.get(
  "/:campaignId",
  authorize(
    "super_admin",
    "system_admin",
    "organization_admin",
    "organization_user"
  ),
  validateUUID("campaignId"),
  campaignController.getCampaignById
);

// Update campaign
router.put(
  "/:campaignId",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("campaignId"),
  validateCampaignUpdate,
  campaignController.updateCampaign
);

// Delete campaign
router.delete(
  "/:campaignId",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("campaignId"),
  campaignController.deleteCampaign
);

// Campaign workflow routes
// Submit campaign for approval
router.post(
  "/:campaignId/submit-approval",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("campaignId"),
  campaignController.submitForApproval
);

// Approve campaign (super admin and system admin only)
router.post(
  "/:campaignId/approve",
  authorize("super_admin", "system_admin"),
  validateUUID("campaignId"),
  campaignController.approveCampaign
);

// Reject campaign (super admin and system admin only)
router.post(
  "/:campaignId/reject",
  authorize("super_admin", "system_admin"),
  validateUUID("campaignId"),
  validateCampaignRejection,
  campaignController.rejectCampaign
);

// Campaign control routes
// Start campaign
router.post(
  "/:campaignId/start",
  authorize("super_admin", "system_admin"),
  validateUUID("campaignId"),
  campaignController.startCampaign
);

// Pause campaign
router.post(
  "/:campaignId/pause",
  authorize("super_admin", "system_admin"),
  validateUUID("campaignId"),
  campaignController.pauseCampaign
);

// Cancel campaign
router.post(
  "/:campaignId/cancel",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("campaignId"),
  campaignController.cancelCampaign
);

// Campaign audience routes
// Get campaign audience
router.get(
  "/:campaignId/audience",
  authorize(
    "super_admin",
    "system_admin",
    "organization_admin",
    "organization_user"
  ),
  validateUUID("campaignId"),
  validatePagination,
  audienceController.getCampaignAudience
);

// Add audience to campaign
router.post(
  "/:campaignId/audience",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("campaignId"),
  validateBulkAudience,
  audienceController.addAudienceToCampaign
);

// Remove audience from campaign
router.delete(
  "/:campaignId/audience",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("campaignId"),
  validateRemoveAudience,
  audienceController.removeAudienceFromCampaign
);

// Update message status for campaign audience
router.put(
  "/audience/:campaignAudienceId/status",
  authorize("super_admin", "system_admin"),
  validateUUID("campaignAudienceId"),
  validateMessageStatusUpdate,
  audienceController.updateMessageStatus
);

// Campaign processing routes
// Process campaign messages and send to SQS
router.post(
  "/:campaignId/process-messages",
  authorize("super_admin", "system_admin"),
  validateUUID("campaignId"),
  campaignController.processCampaignMessages
);

// Get SQS queue status
router.get(
  "/sqs-status",
  authorize("super_admin", "system_admin"),
  campaignController.getSQSStatus
);

// Retry failed messages
router.post(
  "/retry-failed-messages",
  authorize("super_admin", "system_admin"),
  campaignController.retryFailedMessages
);

module.exports = router;
