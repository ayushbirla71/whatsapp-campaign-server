
const { AppError, asyncHandler } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const ConversationMessage = require("../models/ConversationMessage");
const Conversation = require("../models/Conversation");
const Organization = require("../models/Organization");
const User = require("../models/User");
const Template = require("../models/Template");
const { generateMessage } = require("../services/customeMessageGenerator");
const { sendMessage, sendMessageBatch } = require("../services/sqsService");

// Start Conversation Message to Send Message to Customer

const startConversation = asyncHandler(async (req, res) => {
    const { organizationId, to, messageContent, isTemplate, templateId,
    templateParameters, messageType, mediaUrl, mediaType, caption , audienceData} = req.body;     

    // Validate required fields
        const requiredFields = ["organizationId", "to", "messageContent"];
        const missingFields = requiredFields.filter((field) => !req.body[field]);
        if (missingFields.length > 0) {
          throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
        }

        // Check if organization exists
        const organization = await Organization.findById(organizationId);
        if (!organization) {
          throw new AppError("Organization not found", 404);
        }

        // Check if user has access to organization
        if (req.user.role === "organization_admin" && req.user.organization_id !== organizationId) {
          throw new AppError("Access denied to this organization", 403);
        }

        // Check if to number is valid
        const normalizedTo = Audience.normalizeMSISDN(to);
        if (!normalizedTo) {
          throw new AppError("Invalid to number", 400);
        }

        // Check if template exists and is approved
        if (isTemplate) {
          const template = await Template.findById(templateId);
          if (!template) {
            throw new AppError("Template not found", 404);
          }
          if (template.status !== "approved") {
            throw new AppError("Template is not approved", 400);
          }

          if (template.approved_by_admin !== "approved") {
            throw new AppError("Template is not admin approved", 400);
          }

          let messageData = generateMessage({
            organizationId,
            to,
            messageContent,
            isTemplate,
            templateId,
            templateParameters,
            messageType,
            mediaUrl,
            mediaType,
            caption,
            audienceData,
          });

          console.log("messageData", messageData);
        
          const conversation = await Conversation.getOrCreate(organizationId, to);
          const message = await ConversationMessage.createMessage({
            conversationId: conversation.id,
            organizationId,
            direction: "outbound",
            sentByUserId: req.user.id,
            messageType: messageData.messageType,
            messageContent: messageData.messageContent,
            mediaUrl: messageData.mediaUrl,
            mediaType: messageData.mediaType,
            caption: messageData.caption,
            templateName: messageData.templateName,
            templateLanguage: messageData.templateLanguage,
            templateParameters: messageData.templateParameters,
          });

          sendMessageBatch([messageData]);
          res.json({
            success: true,
            message: "Message sent successfully",
            data: message,
          });
        }    
        
        else {
          let messageData = generateMessage({
            organizationId,
            to,
            messageContent,
            isTemplate,
            templateId,
            templateParameters,
            messageType,
            mediaUrl,
            mediaType,
            caption,
            audienceData,
          });

          const conversation = await Conversation.getOrCreate(organizationId, to);
          const message = await ConversationMessage.createMessage({
            conversationId: conversation.id,
            organizationId,
            direction: "outbound",
            sentByUserId: req.user.id,
            messageType: messageData.messageType,
            messageContent: messageData.messageContent,
            mediaUrl: messageData.mediaUrl,
            mediaType: messageData.mediaType,
            caption: messageData.caption,
          });

          sendMessageBatch([messageData]);
          res.json({
            success: true,
            message: "Message sent successfully",
            data: message,
          });
        }
     
  }
);

module.exports = {
  startConversation,
};
