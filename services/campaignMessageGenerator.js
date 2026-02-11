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
    console.log("template data..", template);
    console.log("base Message..", baseMessage);

    // Generate template parameters from audience attributes and template components
    if (template.components && Array.isArray(template.components)) {
      templateMessage.templateParameters = this.generateTemplateParameters(
        template.components,
        audienceData.attributes || {},
        audienceData.generated_asset_urls || {},
        template
      );
    }

    console.log("....>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", templateMessage)

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

    // Replace placeholders with audience data using admin-defined parameters
    messageContent = this.replacePlaceholders(
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

    // Replace placeholders in media URL and caption using admin-defined parameters
    if (mediaUrl) {
      mediaUrl = this.replacePlaceholders(
        mediaUrl,
        audienceData,
        template.parameters || {}
      );
    }
    if (caption) {
      caption = this.replacePlaceholders(
        caption,
        audienceData,
        template.parameters || {}
      );
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
   * @param {Object} generatedAssetUrls - Generated asset URLs
   * @param {Object} template - Template object with parameters
   * @returns {Array} Template parameters
   */
  generateTemplateParameters(
    components,
    attributes,
    generatedAssetUrls,
    template = {}
  ) {
    const parameters = [];

    components.forEach((component) => {
      console.log("Component--------------:", component);
      console.log("Attributes--------------:", attributes);
      console.log("Template parameters:", template);

      if (component.type === "HEADER") {
        if (component.format === "TEXT" && component.text) {
          // parameters.push({
          //   type: "header",
          //   valueType: "text",
          //   value: this.replacePlaceholders(
          //     component.text,
          //     { attributes },
          //     template.parameters || {}
          //   ),
          // });

           const headerParams = this.extractBodyParameters(
      component.text,
      attributes,
      template.parameters || {}
    );

    headerParams.forEach(param => {
      parameters.push({
        type: "header",
        valueType: "text",
        value: param.value,
      });
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
        // Extract placeholders from body text and map to attributes using admin-defined parameters
        const bodyParams = this.extractBodyParameters(
          component.text,
          attributes,
          template.parameters || {}
        );
        parameters.push(...bodyParams);
      } else if (component.type === "BUTTON" && component.buttons) {
        component.buttons.forEach((button, index) => {
          if (button.type === "URL" && button.url) {
            parameters.push({
              type: "button",
              valueType: "text",
              value: this.replacePlaceholders(
                button.url,
                { attributes },
                template.parameters || {}
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
   * Extract body parameters from template text using admin-defined parameter mappings
   * @param {string} bodyText - Template body text with placeholders
   * @param {Object} attributes - Audience attributes
   * @param {Object} templateParameters - Admin-defined parameter mappings
   * @returns {Array} Body parameters
   */
  extractBodyParameters(bodyText, attributes, templateParameters = {}) {
    const parameters = [];
    const placeholderRegex = /\{\{(\d+)\}\}/g;
    let match;

    console.log("templateParameters", templateParameters);

    while ((match = placeholderRegex.exec(bodyText)) !== null) {
      const paramIndex = parseInt(match[1]);

      // Use admin-defined parameter mapping if available
      let value = `Parameter ${paramIndex}`; // Default fallback

      if (templateParameters[paramIndex]) {
        const paramMapping = templateParameters[paramIndex];
        // Get value from audience attributes using admin-defined mapping
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

    console.log("Extracted body parameters:", parameters);

    return parameters;
  }

  /**
   * Replace placeholders in text with audience data using admin-defined parameter mappings
   * @param {string} text - Text with placeholders
   * @param {Object} audienceData - Audience data
   * @param {Object} templateParameters - Admin-defined parameter mappings
   * @returns {string} Text with replaced placeholders
   */
  replacePlaceholders(text, audienceData, templateParameters = {}) {
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

    // Replace numbered placeholders {{1}}, {{2}}, etc. using admin-defined mappings
    const placeholderRegex = /\{\{(\d+)\}\}/g;
    replacedText = replacedText.replace(placeholderRegex, (match, number) => {
      const paramIndex = parseInt(number);

      // Use admin-defined parameter mapping if available
      if (templateParameters[paramIndex]) {
        const paramMapping = templateParameters[paramIndex];
        return attributes[paramMapping] || paramMapping || match;
      }

      // Fallback to legacy parameter mapping
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
