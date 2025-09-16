const Campaign = require("../models/Campaign");
const Template = require("../models/Template");
const Organization = require("../models/Organization");
const Audience = require("../models/Audience");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Get campaigns for an organization
const getCampaigns = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const {
    page = 1,
    limit = 10,
    status,
    campaign_type,
    template_id,
  } = req.query;
  const offset = (page - 1) * limit;

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  if (
    req.user.role === "organization_user" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const filters = {
    limit: parseInt(limit),
    offset: parseInt(offset),
  };

  if (status) filters.status = status;
  if (campaign_type) filters.campaign_type = campaign_type;
  if (template_id) filters.template_id = template_id;

  const campaigns = await Campaign.findByOrganization(organizationId, filters);
  const total = await Campaign.count({ organization_id: organizationId });

  res.json({
    success: true,
    data: {
      campaigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// Get campaign by ID
const getCampaignById = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== campaign.organization_id
  ) {
    throw new AppError("Access denied to this campaign", 403);
  }

  if (
    req.user.role === "organization_user" &&
    req.user.organization_id !== campaign.organization_id
  ) {
    throw new AppError("Access denied to this campaign", 403);
  }

  res.json({
    success: true,
    data: {
      campaign,
    },
  });
});

// Create new campaign
const createCampaign = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const campaignData = req.body;

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError("Organization users cannot create campaigns", 403);
  }

  // Check if organization exists
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }

  // Check if template exists and belongs to organization
  const template = await Template.findById(campaignData.template_id);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  if (template.organization_id !== organizationId) {
    throw new AppError("Template does not belong to this organization", 403);
  }

  if (template.status !== "approved") {
    throw new AppError(
      "Only approved templates can be used for campaigns",
      400
    );
  }

  if (template.approved_by_admin !== "approved") {
    throw new AppError(
      "Template must be admin approved before it can be used for campaigns",
      400
    );
  }

  // Validate campaign data
  const validationErrors = Campaign.validateCampaign({
    ...campaignData,
    organization_id: organizationId,
    created_by: req.user.id,
  });

  if (validationErrors.length > 0) {
    throw new AppError(
      `Validation failed: ${validationErrors.join(", ")}`,
      400
    );
  }

  // Check for duplicate campaign name in organization
  const existingCampaign = await Campaign.findByNameAndOrganization(
    campaignData.name,
    organizationId
  );
  if (existingCampaign) {
    throw new AppError(
      "Campaign with this name already exists in the organization",
      409
    );
  }

  // Create campaign
  const newCampaignData = {
    ...campaignData,
    organization_id: organizationId,
    created_by: req.user.id,
    status: "draft",
  };

  const newCampaign = await Campaign.create(newCampaignData);

  logger.info("Campaign created successfully", {
    campaignId: newCampaign.id,
    campaignName: newCampaign.name,
    organizationId,
    templateId: newCampaign.template_id,
    createdBy: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: "Campaign created successfully",
    data: {
      campaign: newCampaign,
    },
  });
});

// Update campaign
const updateCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const updateData = req.body;

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== campaign.organization_id
  ) {
    throw new AppError("Access denied to this campaign", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError("Organization users cannot update campaigns", 403);
  }

  // Don't allow updating running or completed campaigns
  if (["running", "completed", "cancelled"].includes(campaign.status)) {
    throw new AppError(
      "Cannot update campaigns that are running, completed, or cancelled",
      400
    );
  }

  // Remove fields that shouldn't be updated directly
  delete updateData.organization_id;
  delete updateData.created_by;
  delete updateData.created_at;
  delete updateData.approved_by;
  delete updateData.approved_at;
  delete updateData.rejected_by;
  delete updateData.rejected_at;
  delete updateData.total_targeted_audience;
  delete updateData.total_sent;
  delete updateData.total_delivered;
  delete updateData.total_read;
  delete updateData.total_replied;
  delete updateData.total_failed;

  const updatedCampaign = await Campaign.update(campaignId, updateData);

  logger.info("Campaign updated successfully", {
    campaignId,
    updatedBy: req.user.id,
    changes: updateData,
  });

  res.json({
    success: true,
    message: "Campaign updated successfully",
    data: {
      campaign: updatedCampaign,
    },
  });
});

// Delete campaign
const deleteCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== campaign.organization_id
  ) {
    throw new AppError("Access denied to this campaign", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError("Organization users cannot delete campaigns", 403);
  }

  // Don't allow deleting running campaigns
  if (["running", "scheduled"].includes(campaign.status)) {
    throw new AppError(
      "Cannot delete running or scheduled campaigns. Cancel the campaign first.",
      400
    );
  }

  await Campaign.delete(campaignId);

  logger.info("Campaign deleted successfully", {
    campaignId,
    campaignName: campaign.name,
    deletedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Campaign deleted successfully",
  });
});

// Submit campaign for approval
const submitForApproval = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== campaign.organization_id
  ) {
    throw new AppError("Access denied to this campaign", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError(
      "Organization users cannot submit campaigns for approval",
      403
    );
  }

  if (campaign.status !== "draft" && campaign.status !== "rejected") {
    throw new AppError(
      "Only draft or rejected campaigns can be submitted for approval",
      400
    );
  }

  // Check if campaign has audience
  if (campaign.total_targeted_audience === 0) {
    throw new AppError(
      "Campaign must have at least one audience member before submission",
      400
    );
  }

  const updatedCampaign = await Campaign.submitForApproval(
    campaignId,
    req.user.id
  );

  logger.info("Campaign submitted for approval", {
    campaignId,
    campaignName: campaign.name,
    submittedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Campaign submitted for approval successfully",
    data: {
      campaign: updatedCampaign,
    },
  });
});

// Get pending approval campaigns (for super admin and system admin)
const getPendingApprovalCampaigns = asyncHandler(async (req, res) => {
  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError("Access denied", 403);
  }

  const campaigns = await Campaign.findPendingApproval();

  res.json({
    success: true,
    data: {
      campaigns,
    },
  });
});

// Approve campaign
const approveCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can approve campaigns",
      403
    );
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  if (campaign.status !== "pending_approval") {
    throw new AppError("Only pending approval campaigns can be approved", 400);
  }

  const updatedCampaign = await Campaign.approveCampaign(
    campaignId,
    req.user.id
  );

  logger.info("Campaign approved", {
    campaignId,
    campaignName: campaign.name,
    approvedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Campaign approved successfully",
    data: {
      campaign: updatedCampaign,
    },
  });
});

// Reject campaign
const rejectCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const { rejection_reason } = req.body;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can reject campaigns",
      403
    );
  }

  if (!rejection_reason || rejection_reason.trim().length === 0) {
    throw new AppError("Rejection reason is required", 400);
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  if (campaign.status !== "pending_approval") {
    throw new AppError("Only pending approval campaigns can be rejected", 400);
  }

  const updatedCampaign = await Campaign.rejectCampaign(
    campaignId,
    req.user.id,
    rejection_reason
  );

  logger.info("Campaign rejected", {
    campaignId,
    campaignName: campaign.name,
    rejectedBy: req.user.id,
    rejectionReason: rejection_reason,
  });

  res.json({
    success: true,
    message: "Campaign rejected successfully",
    data: {
      campaign: updatedCampaign,
    },
  });
});

// Campaign control actions
const startCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can start campaigns",
      403
    );
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  if (campaign.status !== "approved" && campaign.status !== "scheduled") {
    throw new AppError(
      "Only approved or scheduled campaigns can be started",
      400
    );
  }

  const updatedCampaign = await Campaign.startCampaign(campaignId);

  logger.info("Campaign started", {
    campaignId,
    campaignName: campaign.name,
    startedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Campaign started successfully",
    data: {
      campaign: updatedCampaign,
    },
  });
});

const pauseCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can pause campaigns",
      403
    );
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  if (campaign.status !== "running") {
    throw new AppError("Only running campaigns can be paused", 400);
  }

  const updatedCampaign = await Campaign.pauseCampaign(campaignId);

  logger.info("Campaign paused", {
    campaignId,
    campaignName: campaign.name,
    pausedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Campaign paused successfully",
    data: {
      campaign: updatedCampaign,
    },
  });
});

const cancelCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== campaign.organization_id
  ) {
    throw new AppError("Access denied to this campaign", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError("Organization users cannot cancel campaigns", 403);
  }

  if (["completed", "cancelled"].includes(campaign.status)) {
    throw new AppError("Campaign is already completed or cancelled", 400);
  }

  const updatedCampaign = await Campaign.cancelCampaign(campaignId);

  logger.info("Campaign cancelled", {
    campaignId,
    campaignName: campaign.name,
    cancelledBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Campaign cancelled successfully",
    data: {
      campaign: updatedCampaign,
    },
  });
});

// Get campaign statistics
const getCampaignStats = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  if (
    req.user.role === "organization_user" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const stats = await Campaign.getCampaignStats(organizationId);

  res.json({
    success: true,
    data: {
      statistics: stats,
    },
  });
});

// Campaign processing actions
const processCampaignMessages = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can process campaign messages",
      403
    );
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  if (campaign.status !== "asset_generated") {
    throw new AppError(
      "Only campaigns with asset_generated status can be processed",
      400
    );
  }

  // Import campaign processing service
  const campaignProcessingService = require("../services/campaignProcessingService");

  try {
    await campaignProcessingService.processCampaign(campaign);

    logger.info("Campaign messages processed successfully", {
      campaignId,
      campaignName: campaign.name,
      processedBy: req.user.id,
    });

    res.json({
      success: true,
      message: "Campaign messages processed and sent to queue successfully",
      data: {
        campaignId,
        status: "ready_to_launch",
      },
    });
  } catch (error) {
    logger.error("Error processing campaign messages", {
      campaignId,
      error: error.message,
      processedBy: req.user.id,
    });

    throw new AppError(
      `Failed to process campaign messages: ${error.message}`,
      500
    );
  }
});

// Get SQS queue status
const getSQSStatus = asyncHandler(async (req, res) => {
  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can check SQS status",
      403
    );
  }

  const sqsService = require("../services/sqsService");

  try {
    const isConfigured = await sqsService.isConfigured();
    let queueAttributes = null;

    if (isConfigured) {
      queueAttributes = await sqsService.getQueueAttributes();
    }

    res.json({
      success: true,
      data: {
        isConfigured,
        queueUrl: process.env.AWS_SQS_QUEUE_URL || null,
        queueAttributes,
      },
    });
  } catch (error) {
    logger.error("Error checking SQS status", {
      error: error.message,
      checkedBy: req.user.id,
    });

    throw new AppError(`Failed to check SQS status: ${error.message}`, 500);
  }
});

module.exports = {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  submitForApproval,
  getPendingApprovalCampaigns,
  approveCampaign,
  rejectCampaign,
  startCampaign,
  pauseCampaign,
  cancelCampaign,
  getCampaignStats,
  processCampaignMessages,
  getSQSStatus,
};
