const logger = require("../utils/logger");

class AutoReplyMessageGenerator {
  /**
   * Generate auto reply message payload
   * @param {Object} autoReplyTemplate - Auto reply template data
   * @param {Object} audienceData - Audience data
   * @param {Object} originalMessage - Original incoming message
   * @returns {Object} Auto reply message payload
   */
  generateAutoReplyMessage(autoReplyTemplate, audienceData, originalMessage) {
    try {
      const baseMessage = {
        organizationId: originalMessage.organization_id,
        to: audienceData.msisdn,
        campaignId: originalMessage.context_campaign_id,
        campaignAudienceId: audienceData.id,
        is_auto_reply: true,
        original_message_id: originalMessage.whatsapp_message_id,
        contextMessageId: originalMessage.whatsapp_message_id,
        autoReplyTemplateId: autoReplyTemplate.id,
      };

      // Determine message type based on template category and content
      if (
        autoReplyTemplate.category === "AUTHENTICATION" ||
        autoReplyTemplate.category === "MARKETING" ||
        autoReplyTemplate.category === "UTILITY"
      ) {
        return this.generateAutoReplyTemplateMessage(
          baseMessage,
          autoReplyTemplate,
          audienceData
        );
      } else if (
        autoReplyTemplate.header_type === "IMAGE" ||
        autoReplyTemplate.header_type === "VIDEO" ||
        autoReplyTemplate.header_type === "DOCUMENT"
      ) {
        return this.generateAutoReplyMediaMessage(
          baseMessage,
          autoReplyTemplate,
          audienceData
        );
      } else {
        return this.generateAutoReplyTextMessage(
          baseMessage,
          autoReplyTemplate,
          audienceData
        );
      }
    } catch (error) {
      logger.error("Error generating auto reply message payload", {
        templateId: autoReplyTemplate.id,
        audienceId: audienceData.id,
        error: error.message,
      });
      throw new Error(
        `Failed to generate auto reply message: ${error.message}`
      );
    }
  }

  /**
   * Generate auto reply template message payload
   */
  generateAutoReplyTemplateMessage(baseMessage, template, audienceData) {
    const templateMessage = {
      ...baseMessage,
      templateName: template.name,
      templateLanguage: template.language || "en",
      templateParameters: [],
    };

    // Generate template parameters from audience attributes and template components
    if (template.components && Array.isArray(template.components)) {
      templateMessage.templateParameters =
        this.generateAutoReplyTemplateParameters(
          template.components,
          audienceData.attributes || {},
          template.parameters || {}
        );
    }

    return templateMessage;
  }

  /**
   * Generate auto reply text message payload
   */
  generateAutoReplyTextMessage(baseMessage, template, audienceData) {
    let messageContent = template.body_text || "";

    // Replace placeholders with audience data
    messageContent = this.replaceAutoReplyPlaceholders(
      messageContent,
      audienceData,
      template.parameters || {}
    );

    return {
      ...baseMessage,
      messageType: "text",
      messageContent,
    };
  }

  /**
   * Generate auto reply media message payload
   */
  generateAutoReplyMediaMessage(baseMessage, template, audienceData) {
    const mediaType = template.header_type?.toLowerCase() || "image";
    let mediaUrl = template.header_media_url;
    let caption = template.body_text || "";

    // Replace placeholders in media URL and caption
    if (mediaUrl) {
      mediaUrl = this.replaceAutoReplyPlaceholders(
        mediaUrl,
        audienceData,
        template.parameters || {}
      );
    }
    if (caption) {
      caption = this.replaceAutoReplyPlaceholders(
        caption,
        audienceData,
        template.parameters || {}
      );
    }

    return {
      ...baseMessage,
      messageType: mediaType,
      mediaUrl,
      caption,
    };
  }

  /**
   * Generate template parameters for auto reply
   */
  generateAutoReplyTemplateParameters(
    components,
    attributes,
    templateParameters = {}
  ) {
    const parameters = [];

    components.forEach((component) => {
      if (component.type === "HEADER" && component.format) {
        if (
          component.format === "IMAGE" ||
          component.format === "VIDEO" ||
          component.format === "DOCUMENT"
        ) {
          // Use template's header media URL or get from attributes
          const mediaUrl =
            component.example?.header_media_url ||
            attributes.header_media_url ||
            "https://via.placeholder.com/300x200";

          parameters.push({
            type: "header",
            valueType: component.format.toLowerCase(),
            mediaUrl: mediaUrl,
          });
        } else if (component.format === "TEXT" && component.text) {
          const headerText = this.replaceAutoReplyPlaceholders(
            component.text,
            { attributes },
            templateParameters
          );
          parameters.push({
            type: "header",
            valueType: "text",
            value: headerText,
          });
        }
      } else if (component.type === "BODY" && component.text) {
        const bodyParams = this.extractAutoReplyBodyParameters(
          component.text,
          attributes,
          templateParameters
        );
        parameters.push(...bodyParams);
      } else if (component.type === "BUTTON" && component.buttons) {
        component.buttons.forEach((button, index) => {
          if (button.type === "URL" && button.url) {
            parameters.push({
              type: "button",
              valueType: "text",
              value: this.replaceAutoReplyPlaceholders(
                button.url,
                { attributes },
                templateParameters
              ),
              buttonIndex: index,
            });
          }
        });
      }
    });

    return parameters;
  }

  /**
   * Extract body parameters for auto reply
   */
  extractAutoReplyBodyParameters(
    bodyText,
    attributes,
    templateParameters = {}
  ) {
    const parameters = [];
    const placeholderRegex = /\{\{(\d+)\}\}/g;
    let match;

    while ((match = placeholderRegex.exec(bodyText)) !== null) {
      const paramIndex = parseInt(match[1]);
      let value = `Parameter ${paramIndex}`; // Default fallback

      if (templateParameters[paramIndex]) {
        const paramMapping = templateParameters[paramIndex];
        value = attributes[paramMapping] || paramMapping;
      } else {
        // Fallback to legacy parameter mapping
        const attributeKey = `param_${paramIndex}`;
        value =
          attributes[attributeKey] ||
          attributes[`body_param_${paramIndex}`] ||
          `Parameter ${paramIndex}`;
      }

      parameters.push({
        type: "body",
        valueType: "text",
        value: value.toString(),
      });
    }

    return parameters;
  }

  /**
   * Replace placeholders in auto reply text
   */
  replaceAutoReplyPlaceholders(text, audienceData, templateParameters = {}) {
    if (!text || typeof text !== "string") return text;

    let replacedText = text;
    const attributes = audienceData.attributes || {};

    // Replace common placeholders
    replacedText = replacedText.replace(
      /\{\{name\}\}/gi,
      audienceData.name || "Customer"
    );
    replacedText = replacedText.replace(
      /\{\{phone\}\}/gi,
      audienceData.msisdn || ""
    );

    // Replace numbered placeholders using template parameters
    const placeholderRegex = /\{\{(\d+)\}\}/g;
    replacedText = replacedText.replace(placeholderRegex, (match, number) => {
      const paramIndex = parseInt(number);

      if (templateParameters[paramIndex]) {
        const paramMapping = templateParameters[paramIndex];
        return attributes[paramMapping] || paramMapping || match;
      }

      const paramKey = `param_${number}`;
      return (
        attributes[paramKey] || attributes[`body_param_${number}`] || match
      );
    });

    // Replace attribute placeholders
    const attributeRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
    replacedText = replacedText.replace(
      attributeRegex,
      (match, attributeName) => {
        return attributes[attributeName] || match;
      }
    );

    return replacedText;
  }

  /**
   * Validate auto reply message payload
   */
  validateAutoReplyMessagePayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    if (!payload.to || !payload.is_auto_reply) return false;
    if (!payload.original_message_id || !payload.autoReplyTemplateId)
      return false;

    // Validate based on message type
    if (payload.templateName) {
      return !!(
        payload.templateLanguage && Array.isArray(payload.templateParameters)
      );
    } else if (payload.messageType === "text") {
      return !!payload.messageContent;
    } else if (
      payload.messageType &&
      ["image", "video", "document"].includes(payload.messageType)
    ) {
      return !!payload.mediaUrl;
    }

    return false;
  }
}

module.exports = new AutoReplyMessageGenerator();
