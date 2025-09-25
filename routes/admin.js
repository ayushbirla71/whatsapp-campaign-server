const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const { authenticate, authorize } = require("../middleware/auth");

// All routes require authentication
router.use(authenticate);

// Get all pending approvals (super admin and system admin only)
router.get(
  "/pending-approvals",
  authorize("super_admin", "system_admin"),
  adminController.getAllPendingApprovals
);

module.exports = router;