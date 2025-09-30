const express = require("express");
const router = express.Router();

const audienceController = require("../controllers/audienceController");
const {
  authenticate,
  authorize,
  authorizeOrganization,
} = require("../middleware/auth");
const {
  validateAudienceCreation,
  validateBulkAudience,
  validateUUID,
  validatePagination,
} = require("../middleware/validation");

// All routes require authentication
router.use(authenticate);

// Organization-specific audience routes
// Get master audience for an organization
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
  audienceController.getMasterAudience
);

// Create or update master audience record
router.post(
  "/organization/:organizationId",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("organizationId"),
  validateAudienceCreation,
  authorizeOrganization,
  audienceController.createMasterAudienceRecord
);

// Bulk create/update master audience records
router.post(
  "/organization/:organizationId/bulk",
  authorize("super_admin", "system_admin", "organization_admin"),
  validateUUID("organizationId"),
  validateBulkAudience,
  authorizeOrganization,
  audienceController.bulkCreateMasterAudience
);

// Get all master audience (super admin and system admin only)
router.get(
  "/",
  authorize(
    "super_admin",
    "system_admin",
    "organization_admin",
    "organization_user"
  ),
  validatePagination,
  audienceController.getAllMasterAudience
);

module.exports = router;
