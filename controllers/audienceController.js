const Audience = require("../models/Audience");
const Campaign = require("../models/Campaign");
const Organization = require("../models/Organization");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Get master audience for an organization
const getMasterAudience = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { page = 1, limit = 10, search, country_code } = req.query;
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

  if (search) filters.search = search;
  if (country_code) filters.country_code = country_code;

  const audience = await Audience.findByOrganization(organizationId, filters);
  const total = await Audience.count({ organization_id: organizationId });

  res.json({
    success: true,
    data: {
      audience,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// Create or update master audience record
const createMasterAudienceRecord = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const audienceData = req.body;

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError(
      "Organization users cannot create audience records",
      403
    );
  }

  // Check if organization exists
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }

  // Validate audience data
  const validationErrors = Audience.validateAudienceData(audienceData);
  if (validationErrors.length > 0) {
    throw new AppError(
      `Validation failed: ${validationErrors.join(", ")}`,
      400
    );
  }

  const audienceRecord = await Audience.createOrUpdateMasterRecord({
    ...audienceData,
    organization_id: organizationId,
    created_by: req.user.id,
  });

  logger.info("Master audience record created/updated", {
    audienceId: audienceRecord.id,
    organizationId,
    msisdn: audienceRecord.msisdn,
    createdBy: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: "Audience record created/updated successfully",
    data: {
      audience: audienceRecord,
    },
  });
});

// Bulk create/update master audience records
const bulkCreateMasterAudience = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { audience_list } = req.body;

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError(
      "Organization users cannot create audience records",
      403
    );
  }

  if (
    !audience_list ||
    !Array.isArray(audience_list) ||
    audience_list.length === 0
  ) {
    throw new AppError(
      "Audience list is required and must be a non-empty array",
      400
    );
  }

  // Check if organization exists
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }

  const result = await Audience.bulkCreateOrUpdate(
    audience_list,
    organizationId,
    req.user.id
  );

  logger.info("Bulk audience creation completed", {
    organizationId,
    totalProcessed: result.total_processed,
    successful: result.successful,
    failed: result.failed,
    createdBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Bulk audience creation completed",
    data: result,
  });
});

// Get campaign audience
const getCampaignAudience = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const { page = 1, limit = 10, message_status, search } = req.query;
  const offset = (page - 1) * limit;

  // Check if campaign exists and user has access
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

  const filters = {
    limit: parseInt(limit),
    offset: parseInt(offset),
  };

  if (message_status) filters.message_status = message_status;
  if (search) filters.search = search;

  const audience = await Audience.getCampaignAudience(campaignId, filters);
  const total = await Audience.count(
    { campaign_id: campaignId },
    "campaign_audience"
  );

  res.json({
    success: true,
    data: {
      audience,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// Add audience to campaign
const addAudienceToCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const { audience_list } = req.body;

  // Check if campaign exists and user has access
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
      "Organization users cannot add audience to campaigns",
      403
    );
  }

  // Don't allow adding audience to running or completed campaigns
  if (["running", "completed", "cancelled"].includes(campaign.status)) {
    throw new AppError(
      "Cannot add audience to running, completed, or cancelled campaigns",
      400
    );
  }

  if (
    !audience_list ||
    !Array.isArray(audience_list) ||
    audience_list.length === 0
  ) {
    throw new AppError(
      "Audience list is required and must be a non-empty array",
      400
    );
  }

  const result = await Audience.addToCampaign(
    campaignId,
    campaign.organization_id,
    audience_list
  );

  logger.info("Audience added to campaign", {
    campaignId,
    totalProcessed: result.total_processed,
    successful: result.successful,
    failed: result.failed,
    addedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Audience added to campaign successfully",
    data: result,
  });
});

// Remove audience from campaign
const removeAudienceFromCampaign = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const { msisdn } = req.body;

  // Check if campaign exists and user has access
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
      "Organization users cannot remove audience from campaigns",
      403
    );
  }

  // Don't allow removing audience from running campaigns
  if (["running", "completed"].includes(campaign.status)) {
    throw new AppError(
      "Cannot remove audience from running or completed campaigns",
      400
    );
  }

  if (!msisdn) {
    throw new AppError("Phone number (msisdn) is required", 400);
  }

  const removedRecord = await Audience.removeCampaignAudience(
    campaignId,
    msisdn
  );

  if (!removedRecord) {
    throw new AppError("Audience member not found in campaign", 404);
  }

  logger.info("Audience removed from campaign", {
    campaignId,
    msisdn: removedRecord.msisdn,
    removedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Audience removed from campaign successfully",
  });
});

// Update message status for campaign audience
const updateMessageStatus = asyncHandler(async (req, res) => {
  const { campaignAudienceId } = req.params;
  const { message_status, whatsapp_message_id, failure_reason } = req.body;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can update message status",
      403
    );
  }

  if (!message_status) {
    throw new AppError("Message status is required", 400);
  }

  const validStatuses = ["pending", "sent", "delivered", "read", "failed"];
  if (!validStatuses.includes(message_status)) {
    throw new AppError("Invalid message status", 400);
  }

  const additionalData = {};
  if (whatsapp_message_id)
    additionalData.whatsapp_message_id = whatsapp_message_id;
  if (failure_reason) additionalData.failure_reason = failure_reason;

  const updatedRecord = await Audience.updateMessageStatus(
    campaignAudienceId,
    message_status,
    additionalData
  );

  if (!updatedRecord) {
    throw new AppError("Campaign audience record not found", 404);
  }

  logger.info("Message status updated", {
    campaignAudienceId,
    messageStatus: message_status,
    updatedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Message status updated successfully",
    data: {
      audience: updatedRecord,
    },
  });
});

module.exports = {
  getMasterAudience,
  createMasterAudienceRecord,
  bulkCreateMasterAudience,
  getCampaignAudience,
  addAudienceToCampaign,
  removeAudienceFromCampaign,
  updateMessageStatus,
};
