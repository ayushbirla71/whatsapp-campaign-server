const Template = require("../models/Template");
const Campaign = require("../models/Campaign");
const logger = require("../utils/logger");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

// Get all pending approvals (campaigns and templates) for admin
const getAllPendingApprovals = asyncHandler(async (req, res) => {
  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError("Access denied", 403);
  }

  try {
    // Get pending approval templates (standard approval)
    const pendingTemplates = await Template.findPendingApproval();

    // Get pending admin approval templates (admin approval for campaign usage)
    const pendingAdminTemplates = await Template.findPendingAdminApproval();

    // Get pending approval campaigns
    const pendingCampaigns = await Campaign.findPendingApproval();

    const response = {
      success: true,
      data: {
        summary: {
          total_pending:
            pendingTemplates.length +
            pendingAdminTemplates.length +
            pendingCampaigns.length,
          pending_template_approval: pendingTemplates.length,
          pending_admin_template_approval: pendingAdminTemplates.length,
          pending_campaign_approval: pendingCampaigns.length,
        },
        pending_approvals: {
          templates: {
            standard_approval: pendingTemplates,
            admin_approval: pendingAdminTemplates,
          },
          campaigns: pendingCampaigns,
        },
      },
    };

    logger.info("Retrieved all pending approvals", {
      userId: req.user.id,
      totalPending: response.data.summary.total_pending,
      templateApprovals: pendingTemplates.length,
      adminTemplateApprovals: pendingAdminTemplates.length,
      campaignApprovals: pendingCampaigns.length,
    });

    res.json(response);
  } catch (error) {
    logger.error("Error retrieving pending approvals", {
      error: error.message,
      userId: req.user.id,
    });
    throw new AppError("Failed to retrieve pending approvals", 500);
  }
});

module.exports = {
  getAllPendingApprovals,
};
