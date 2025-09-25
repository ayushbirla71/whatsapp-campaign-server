const express = require("express");
const router = express.Router();

const templateController = require("../controllers/templateController");
const {
  authenticate,
  authorize,
  authorizeOrganization,
} = require("../middleware/auth");
const {
  validateTemplateCreation,
  validateTemplateUpdate,
  validateTemplateRejection,
  validateUUID,
  validatePagination,
} = require("../middleware/validation");

// All routes require authentication
router.use(authenticate);

// Get pending approval templates (super admin and system admin only)
router.get(
  "/pending-approval",
  authorize("super_admin", "system_admin"),
  templateController.getPendingApprovalTemplates
);

// Get pending admin approval templates (super admin and system admin only)
router.get(
  "/pending-admin-approval",
  authorize("super_admin", "system_admin"),
  templateController.getPendingAdminApprovalTemplates
);

// Organization-specific template routes
// Get templates for an organization
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
  templateController.getTemplates
);

// Create template for an organization
router.post(
  "/organization/:organizationId",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("organizationId"),
  validateTemplateCreation,
  authorizeOrganization,
  templateController.createTemplate
);

// Get template by ID
router.get(
  "/:templateId",
  authorize(
    "super_admin",
    "system_admin",
    "organization_admin",
    "organization_user"
  ),
  validateUUID("templateId"),
  templateController.getTemplateById
);

// Update template
router.put(
  "/:templateId",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("templateId"),
  validateTemplateUpdate,
  templateController.updateTemplate
);

// Delete template
router.delete(
  "/:templateId",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("templateId"),
  templateController.deleteTemplate
);

// Submit template for approval
router.post(
  "/:templateId/submit-approval",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("templateId"),
  templateController.submitForApproval
);

// Approve template (super admin and system admin only)
router.post(
  "/:templateId/approve",
  authorize("super_admin", "system_admin"),
  validateUUID("templateId"),
  templateController.approveTemplate
);

// Reject template (super admin and system admin only)
router.post(
  "/:templateId/reject",
  authorize("super_admin", "system_admin"),
  validateUUID("templateId"),
  validateTemplateRejection,
  templateController.rejectTemplate
);

// Admin approve template for campaign usage (super admin and system admin only)
router.post(
  "/:templateId/admin-approve",
  authorize("super_admin", "system_admin"),
  validateUUID("templateId"),
  templateController.adminApproveTemplate
);

// Admin reject template for campaign usage (super admin and system admin only)
router.post(
  "/:templateId/admin-reject",
  authorize("super_admin", "system_admin"),
  validateUUID("templateId"),
  validateTemplateRejection,
  templateController.adminRejectTemplate
);

// Update template parameters (super admin and system admin only)
router.put(
  "/:templateId/parameters",
  authorize("super_admin", "system_admin"),
  validateUUID("templateId"),
  templateController.updateTemplateParameters
);

// Sync templates from WhatsApp Business API (super admin and system admin only)
router.post(
  "/organization/:organizationId/sync-whatsapp",
  authorize("super_admin", "system_admin"),
  validateUUID("organizationId"),
  templateController.syncTemplatesFromWhatsApp
);

// Get all templates (role-based filtering)
router.get(
  "/",
  authorize(
    "super_admin",
    "system_admin",
    "organization_admin",
    "organization_user"
  ),
  validatePagination,
  templateController.getAllTemplates
);

// Get auto reply templates for organization
router.get(
  "/organization/:organizationId/auto-reply",
  authorize(
    "super_admin",
    "system_admin",
    "organization_admin",
    "organization_user"
  ),
  validateUUID("organizationId"),
  templateController.getAutoReplyTemplates
);

// Update auto reply template status (super admin and system admin only)
router.put(
  "/:templateId/auto-reply-status",
  authorize("super_admin", "system_admin"),
  validateUUID("templateId"),
  templateController.updateAutoReplyStatus
);

// Get template details for admin approval (including button analysis)
router.get(
  "/:templateId/admin-approval-details",
  authorize("super_admin", "system_admin"),
  validateUUID("templateId"),
  templateController.getTemplateForAdminApproval
);

module.exports = router;
