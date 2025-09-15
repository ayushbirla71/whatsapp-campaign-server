const logger = require("../utils/logger");

class CampaignMessageGenerator {
  /**
   * Generate WhatsApp message payload based on campaign, template, and audience data
   * @param {Object} campaign - Campaign data
   * @param {Object} template - Template data
   * @param {Object} audienceData - Campaign audience data
   * @returns {Object} WhatsApp message payload
   */
  generateMessage(campaign, template, audienceData) {
    try {
      const baseMessage = {
        organizationId: campaign.organization_id,
        campaignId: campaign.id,
        campaignAudienceId: audienceData.id,
        to: audienceData.msisdn,
      };

      // Determine message type based on template category and content

      console.log("Template category:", template);
      if (
        template.category === "AUTHENTICATION" ||
        template.category === "MARKETING" ||
        template.category === "UTILITY"
      ) {
        return this.generateTemplateMessage(
          baseMessage,
          template,
          audienceData
        );
      } else if (
        template.header_type === "IMAGE" ||
        template.header_type === "VIDEO" ||
        template.header_type === "DOCUMENT"
      ) {
        return this.generateMediaMessage(baseMessage, template, audienceData);
      } else {
        return this.generateTextMessage(baseMessage, template, audienceData);
      }
    } catch (error) {
      logger.error("Error generating message payload", {
        campaignId: campaign.id,
        templateId: template.id,
        audienceId: audienceData.id,
        error: error.message,
      });
      throw new Error(`Failed to generate message: ${error.message}`);
    }
  }

  /**
   * Generate template message payload
   * @param {Object} baseMessage - Base message structure
   * @param {Object} template - Template data
   * @param {Object} audienceData - Audience data
   * @returns {Object} Template message payload
   */
  generateTemplateMessage(baseMessage, template, audienceData) {
    const templateMessage = {
      ...baseMessage,
      templateName: template.name,
      templateLanguage: template.language || "en",
      templateParameters: [],
    };

    console.log("audienceData", audienceData);

    // Generate template parameters from audience attributes and template components
    if (template.components && Array.isArray(template.components)) {
      templateMessage.templateParameters = this.generateTemplateParameters(
        template.components,
        audienceData.attributes || {},
        audienceData.generated_asset_urls || {}
      );
    }

    return templateMessage;
  }

  /**
   * Generate text message payload
   * @param {Object} baseMessage - Base message structure
   * @param {Object} template - Template data
   * @param {Object} audienceData - Audience data
   * @returns {Object} Text message payload
   */
  generateTextMessage(baseMessage, template, audienceData) {
    let messageContent = template.body_text || "";

    // Replace placeholders with audience data
    messageContent = this.replacePlaceholders(messageContent, audienceData);

    return {
      ...baseMessage,
      messageType: "text",
      messageContent,
    };
  }

  /**
   * Generate media message payload (image, video, document, audio)
   * @param {Object} baseMessage - Base message structure
   * @param {Object} template - Template data
   * @param {Object} audienceData - Audience data
   * @returns {Object} Media message payload
   */
  generateMediaMessage(baseMessage, template, audienceData) {
    const mediaType = template.header_type?.toLowerCase() || "image";
    let mediaUrl = template.header_media_url;
    let caption = template.body_text || "";

    // Replace placeholders in media URL and caption
    if (mediaUrl) {
      mediaUrl = this.replacePlaceholders(mediaUrl, audienceData);
    }
    if (caption) {
      caption = this.replacePlaceholders(caption, audienceData);
    }

    const mediaMessage = {
      ...baseMessage,
      messageType: mediaType,
      mediaUrl,
      caption: caption, // Always include caption, even if empty
    };

    // Add filename for document messages
    if (mediaType === "document" && audienceData.attributes?.filename) {
      mediaMessage.filename = audienceData.attributes.filename;
    }

    return mediaMessage;
  }

  /**
   * Generate template parameters from components and audience attributes
   * @param {Array} components - Template components
   * @param {Object} attributes - Audience attributes
   * @returns {Array} Template parameters
   */
  generateTemplateParameters(components, attributes, generatedAssetUrls) {
    const parameters = [];

    components.forEach((component) => {
      if (component.type === "HEADER") {
        if (component.format === "TEXT" && component.text) {
          parameters.push({
            type: "header",
            valueType: "text",
            value: this.replacePlaceholders(component.text, attributes),
          });
        } else if (
          component.format === "IMAGE" ||
          component.format === "VIDEO" ||
          component.format === "DOCUMENT"
        ) {
          // const mediaUrl = this.getMediaUrlFromAttributes(
          //   attributes,
          //   component.format.toLowerCase()
          // );

          console.log("Generated asset URLs:", generatedAssetUrls);
          const mediaUrl =
            generatedAssetUrls[component.format.toLowerCase()] || null;
          console.log("Media URL:", mediaUrl);
          console.log("Media type:", component.format.toLowerCase());
          if (mediaUrl) {
            parameters.push({
              type: "header",
              valueType: component.format.toLowerCase(),
              mediaUrl: mediaUrl,
            });
          }
        }
      } else if (component.type === "BODY" && component.text) {
        // Extract placeholders from body text and map to attributes
        const bodyParams = this.extractBodyParameters(
          component.text,
          attributes
        );
        parameters.push(...bodyParams);
      } else if (component.type === "BUTTON" && component.buttons) {
        component.buttons.forEach((button, index) => {
          if (button.type === "URL" && button.url) {
            parameters.push({
              type: "button",
              valueType: "text",
              value: this.replacePlaceholders(button.url, attributes),
              buttonIndex: index,
            });
          }
        });
      }
    });

    return parameters;
  }

  /**
   * Extract body parameters from template text
   * @param {string} bodyText - Template body text with placeholders
   * @param {Object} attributes - Audience attributes
   * @returns {Array} Body parameters
   */
  extractBodyParameters(bodyText, attributes) {
    const parameters = [];
    const placeholderRegex = /\{\{(\d+)\}\}/g;
    let match;

    while ((match = placeholderRegex.exec(bodyText)) !== null) {
      const paramIndex = parseInt(match[1]);
      const attributeKey = `param_${paramIndex}`;
      const value =
        attributes[attributeKey] ||
        attributes[`body_param_${paramIndex}`] ||
        `Parameter ${paramIndex}`;

      parameters.push({
        type: "body",
        valueType: "text",
        value: value.toString(),
      });
    }

    return parameters;
  }

  /**
   * Replace placeholders in text with audience data
   * @param {string} text - Text with placeholders
   * @param {Object} audienceData - Audience data
   * @returns {string} Text with replaced placeholders
   */
  replacePlaceholders(text, audienceData) {
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

    // Replace numbered placeholders {{1}}, {{2}}, etc.
    const placeholderRegex = /\{\{(\d+)\}\}/g;
    replacedText = replacedText.replace(placeholderRegex, (match, number) => {
      const paramKey = `param_${number}`;
      return (
        attributes[paramKey] || attributes[`body_param_${number}`] || match
      );
    });

    // Replace attribute placeholders {{attribute_name}}
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
   * Get media URL from audience attributes
   * @param {Object} attributes - Audience attributes
   * @param {string} mediaType - Media type (image, video, document)
   * @returns {string|null} Media URL
   */
  getMediaUrlFromAttributes(attributes, mediaType) {
    const mediaUrlKey = `${mediaType}_url`;
    return attributes[mediaUrlKey] || attributes.media_url || null;
  }

  /**
   * Validate message payload before sending
   * @param {Object} messagePayload - Generated message payload
   * @returns {boolean} True if valid
   */
  validateMessagePayload(messagePayload) {
    if (
      !messagePayload.organizationId ||
      !messagePayload.campaignId ||
      !messagePayload.campaignAudienceId ||
      !messagePayload.to
    ) {
      return false;
    }

    // Validate based on message type
    if (messagePayload.templateName) {
      return !!(messagePayload.templateName && messagePayload.templateLanguage);
    } else if (messagePayload.messageType === "text") {
      return !!messagePayload.messageContent;
    } else if (
      ["image", "video", "document", "audio"].includes(
        messagePayload.messageType
      )
    ) {
      return !!messagePayload.mediaUrl;
    }

    return false;
  }
}

module.exports = new CampaignMessageGenerator();
