const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const { authenticate, authorize } = require("../middleware/auth");
const directMessageController = require("../controllers/directMessage");
const instentMessageController = require("../controllers/instentMessageController");

// All routes require authentication
router.use(authenticate);

// Get all pending approvals (super admin and system admin only)
router.get(
  "/pending-approvals",
  authorize("super_admin", "system_admin"),
  adminController.getAllPendingApprovals
);


router.post(
  "/direct-message",
  authorize("super_admin", "system_admin", "organization_admin"),
  directMessageController.sendDirectMessage
);


router.post(
  "/instent-message",
  authorize("super_admin", "system_admin", "organization_admin"),
  instentMessageController.sendInstentMessage
);

module.exports = router;