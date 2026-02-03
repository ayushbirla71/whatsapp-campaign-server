const express = require('express');
const router = express.Router();
const multer = require("multer");
const messageController = require('../controllers/messageController');
const { authenticate, authorizeOrganization } = require("../middleware/auth");


// IMPORTANT: memory storage for S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

router.get("/inbox", authenticate, messageController.getInboxAudience);
router.get("/:conversationId/messages", authenticate, messageController.getConversationMessages);
router.get("/:conversationId/is-active", authenticate, messageController.canSendMessage);
router.post("/:conversationId/send", authenticate, messageController.sendMessage);
router.post("/:conversationId/read", authenticate, messageController.markConversationRead);
router.post(
  "/upload-media",
  authenticate,
  upload.single("file"), // 👈 THIS IS REQUIRED
  messageController.uploadMedia
);

module.exports = router;