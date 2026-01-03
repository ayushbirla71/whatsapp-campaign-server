const Conversation = require("../models/Conversation");
const ConversationMessage = require("../models/ConversationMessage");
const sqsService = require("./sqsService");
const { formatPhoneNumber } = require("../utils/phoneUtils");

/**
 * Conversation Service
 * Handles manual chat/chatbot functionality
 * Integrates with existing campaign and auto-reply flows
 */
class ConversationService {
  /**
   * Handle incoming message and create/update conversation
   * This is called from webhook processor
   */
  async handleIncomingMessage(incomingMessageData) {
    try {
      const {
        organizationId,
        fromPhoneNumber,
        toPhoneNumber,
        messageType,
        content,
        mediaUrl,
        mediaType,
        whatsappMessageId,
        timestamp,
        interactiveType,
        interactiveData,
        contextMessageId,
        contextCampaignId,
        customerName = null,
      } = incomingMessageData;

      // Normalize phone number
      const normalizedPhone = formatPhoneNumber(fromPhoneNumber);

      // Determine conversation type
      let conversationType = "general";
      if (contextCampaignId) {
        conversationType = "campaign_reply";
      }

      // Get or create conversation
      const conversation = await Conversation.getOrCreate(
        organizationId,
        normalizedPhone,
        {
          customerName,
          conversationType,
          relatedCampaignId: contextCampaignId,
        }
      );

      // Create conversation message
      const message = await ConversationMessage.createMessage({
        conversationId: conversation.id,
        organizationId,
        direction: "inbound",
        messageType,
        messageContent: content,
        mediaUrl,
        mediaType,
        whatsappMessageId,
        messageStatus: "delivered",
        contextMessageId,
        interactiveType,
        interactiveData,
      });

      return {
        conversation,
        message,
      };
    } catch (error) {
      console.error("Error handling incoming message in conversation:", error);
      // Don't throw - this is optional feature, shouldn't break webhook processing
      return null;
    }
  }

  /**
   * Send manual message from agent/chatbot
   */
  async sendMessage(messageData, userId = null) {
    try {
      const {
        organizationId,
        conversationId,
        messageType = "text",
        messageContent,
        mediaUrl = null,
        mediaType = null,
        caption = null,
        templateName = null,
        templateLanguage = null,
        templateParameters = null,
        contextMessageId = null,
        from_phone_number = null,
        to_phone_number = null,
      } = messageData;

      // Get conversation to get customer phone
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Create conversation message record
      const message = await ConversationMessage.createMessage({
        conversationId,
        organizationId,
        direction: "outbound",
        sentByUserId: userId,
        messageType,
        messageContent,
        mediaUrl,
        mediaType,
        caption,
        templateName,
        templateLanguage,
        templateParameters,
        contextMessageId,
        messageStatus: "pending",
        from_phone_number,
        to_phone_number,

      });

      // Send to SQS for WhatsApp delivery
      // Note: The message sender Lambda expects specific fields
      const sqsPayload = {
        // Conversation-specific fields
        messageId: message.id, // conversation_messages.id
        conversationId,
        source: "conversation",

        // Required fields for message sender Lambda
        organizationId,
        campaignId: null, // Not from campaign
        campaignAudienceId: null, // Not from campaign
        to: to_phone_number,
        from: from_phone_number, // Will use organization's WhatsApp number

        // Message content
        messageType,
        messageContent: messageContent,
        mediaUrl,
        mediaType,
        caption,
        templateName,
        templateLanguage,
        templateParameters,
        contextMessageId,

        // Metadata
        isAutoReply: false,
        timestamp: new Date().toISOString(),
      };

      await sqsService.sendMessage(sqsPayload, {
       messageGroupId:
              process.env.SQS_MESSAGE_GROUP_ID || "whatsapp-outbound-messages",
      });

      return message;
    } catch (error) {
      console.error("Error sending conversation message:", error);
      throw error;
    }
  }

  /**
   * Update message status from webhook
   */
  async updateMessageStatus(whatsappMessageId, status, timestamp = null) {
    try {
      return await ConversationMessage.updateStatus(
        whatsappMessageId,
        status,
        timestamp
      );
    } catch (error) {
      console.error("Error updating conversation message status:", error);
      // Don't throw - this is optional feature
      return null;
    }
  }
}







module.exports = new ConversationService();
