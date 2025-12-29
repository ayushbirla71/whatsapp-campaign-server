const express = require("express");
const router = express.Router();

const messageController = require("../controllers/messageController.js");
const { authenticate, authorize } = require("../middleware/auth");
const { body, query, param } = require("express-validator");
const { handleValidationErrors } = require("../middleware/validation");

// All routes require authentication
router.use(authenticate);

// Only super admin and system admin can access these routes
router.use(authorize("super_admin", "system_admin"));

// Start Conversation Message to Send Message to Customer
router.post("/start-conversation", messageController.startConversation);


module.exports = router;

