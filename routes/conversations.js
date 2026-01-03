const express = require("express");
const router = express.Router();
const Conversation = require("../models/Conversation");
const ConversationMessage = require("../models/ConversationMessage");
const conversationService = require("../services/conversationService");
const { authenticate, authorizeOrganization } = require("../middleware/auth");
const { body, query, param } = require("express-validator");
const { handleValidationErrors } = require("../middleware/validation");

/**
 * Conversation Routes
 * Handles manual chat/chatbot functionality
 * All routes require authentication and organization authorization
 */

// Validation middleware
const validateSendMessage = [
  // body("conversationId")
  //   .isUUID()
  //   .withMessage("Valid conversation ID is required"),
  body("messageType")
    .optional()
    .isIn(["text", "image", "video", "audio", "document"])
    .withMessage("Invalid message type"),
  body("messageContent")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Message content cannot be empty"),
  body("templateName")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Template name cannot be empty"),
  handleValidationErrors,
];

const validateListConversations = [
  query("status")
    .optional()
    .isIn(["active", "waiting", "closed", "archived"])
    .withMessage("Invalid status"),
  query("conversationType")
    .optional()
    .isIn(["campaign_reply", "support", "general"])
    .withMessage("Invalid conversation type"),
  query("unreadOnly")
    .optional()
    .isBoolean()
    .withMessage("unreadOnly must be boolean"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("offset")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Offset must be non-negative"),
  handleValidationErrors,
];

const validateUpdateStatus = [
  body("status")
    .isIn(["active", "waiting", "closed", "archived"])
    .withMessage("Invalid status"),
  handleValidationErrors,
];

const validateAssign = [
  body("userId").isUUID().withMessage("Valid user ID is required"),
  handleValidationErrors,
];

/**
 * GET /api/conversations
 * List conversations with filters and pagination
 */
router.get(
  "/",
  authenticate,
  // authorizeOrganization,
  validateListConversations,
  async (req, res) => {
    try {
      const {
        status,
        assignedTo,
        unreadOnly,
        conversationType,
        search,
        limit = 20,
        offset = 0,
      } = req.query;

      const filters = {
        organizationId: req.user.organizationId,
        status,
        assignedTo,
        unreadOnly: unreadOnly === "true",
        conversationType,
        search,
        limit: parseInt(limit),
        offset: parseInt(offset),
      };

      const [conversations, total] = await Promise.all([
        Conversation.list(filters),
        Conversation.count(filters),
      ]);

      res.json({
        success: true,
        data: {
          conversations,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + parseInt(limit) < total,
          },
        },
      });
    } catch (error) {
      console.error("Error listing conversations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to list conversations",
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/conversations/statistics
 * Get conversation statistics for organization
 */
router.get(
  "/statistics",
  authenticate,
  authorizeOrganization,
  async (req, res) => {
    try {
      const statistics = await Conversation.getStatistics(
        req.user.organizationId
      );

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error("Error getting conversation statistics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get conversation statistics",
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/conversations/:id
 * Get conversation by ID
 */
router.get("/:id", authenticate,
  //  authorizeOrganization,
    async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Verify organization access
    // if (conversation.organization_id !== req.user.organizationId) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Access denied",
    //   });
    // }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("Error getting conversation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get conversation",
      error: error.message,
    });
  }
});

/**
 * GET /api/conversations/:id/messages
 * Get messages for a conversation
 */
router.get(
  "/:id/messages",
  authenticate,
  // authorizeOrganization,
  async (req, res) => {
    try {
      const { limit = 50, offset = 0, order = "DESC" } = req.query;

      // Verify conversation exists and user has access
      const conversation = await Conversation.findById(req.params.id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      // if (conversation.organization_id !== req.user.organizationId) {
      //   return res.status(403).json({
      //     success: false,
      //     message: "Access denied",
      //   });
      // }

      const [messages, total] = await Promise.all([
        ConversationMessage.getByConversation(req.params.id, {
          limit: parseInt(limit),
          offset: parseInt(offset),
          order,
        }),
        ConversationMessage.countByConversation(req.params.id),
      ]);

      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + parseInt(limit) < total,
          },
        },
      });
    } catch (error) {
      console.error("Error getting conversation messages:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get conversation messages",
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/conversations/:id/messages
 * Send a message in a conversation
 */
router.post(
  "/:id/messages",
  authenticate,
  // authorizeOrganization,
  validateSendMessage,
  async (req, res) => {
    try {
      const conversationId = req.params.id;

      // Verify conversation exists and user has access
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      console.log("conversation.organization_id: ", conversation.organization_id);
      console.log("req.user.organizationId: ", req.user.organization_id);

      if (conversation.organization_id !== req.user.organization_id) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      let from_phone_number = conversation.business_phone_number;
      let to_phone_number = conversation.customer_phone_number;

      const messageData = {
        organizationId: req.user.organization_id,
        conversationId,
        senderId: req.user.userId,
        from_phone_number,
        to_phone_number,
        messageType: req.body.messageType || "text",
        messageContent: req.body.messageContent,
        mediaUrl: req.body.mediaUrl,
        mediaType: req.body.mediaType,
        caption: req.body.caption,
        templateName: req.body.templateName,
        templateLanguage: req.body.templateLanguage,
        templateParameters: req.body.templateParameters,
        contextMessageId: req.body.contextMessageId,
        direction: "outbound",

      };

      const message = await conversationService.sendMessage(
        messageData,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        message: "Message sent successfully",
        data: message,
      });
    } catch (error) {
      console.error("Error sending conversation message:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send message",
        error: error.message,
      });
    }
  }
);

/**
 * PATCH /api/conversations/:id/status
 * Update conversation status
 */
router.patch(
  "/:id/status",
  authenticate,
  authorizeOrganization,
  validateUpdateStatus,
  async (req, res) => {
    try {
      const conversation = await Conversation.findById(req.params.id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      if (conversation.organization_id !== req.user.organizationId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const updatedConversation = await Conversation.updateStatus(
        req.params.id,
        req.body.status,
        req.user.userId
      );

      res.json({
        success: true,
        message: "Conversation status updated",
        data: updatedConversation,
      });
    } catch (error) {
      console.error("Error updating conversation status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update conversation status",
        error: error.message,
      });
    }
  }
);

/**
 * PATCH /api/conversations/:id/assign
 * Assign conversation to user
 */
router.patch(
  "/:id/assign",
  authenticate,
  authorizeOrganization,
  validateAssign,
  async (req, res) => {
    try {
      const conversation = await Conversation.findById(req.params.id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      if (conversation.organization_id !== req.user.organizationId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const updatedConversation = await Conversation.assign(
        req.params.id,
        req.body.userId
      );

      res.json({
        success: true,
        message: "Conversation assigned successfully",
        data: updatedConversation,
      });
    } catch (error) {
      console.error("Error assigning conversation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to assign conversation",
        error: error.message,
      });
    }
  }
);

/**
 * PATCH /api/conversations/:id/read
 * Mark conversation as read
 */
router.patch(
  "/:id/read",
  authenticate,
  authorizeOrganization,
  async (req, res) => {
    try {
      const conversation = await Conversation.findById(req.params.id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      if (conversation.organization_id !== req.user.organizationId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const updatedConversation = await Conversation.markAsRead(req.params.id);

      res.json({
        success: true,
        message: "Conversation marked as read",
        data: updatedConversation,
      });
    } catch (error) {
      console.error("Error marking conversation as read:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark conversation as read",
        error: error.message,
      });
    }
  }
);

module.exports = router;
