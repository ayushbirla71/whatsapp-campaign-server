const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

router.get("/inbox", messageController.getInboxAudience);
router.get("/:conversationId/messages", messageController.getConversationMessages);
router.get("/:conversationId/can-send", messageController.canSendMessage);
router.post("/:conversationId/send", messageController.sendMessage);
router.post("/:conversationId/read", messageController.markConversationRead);

module.exports = router;