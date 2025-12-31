const logger = require("../utils/logger");

class CustomMessageGenerator {
  /**
   * Generate whatsapp message payload based on custome input not for campaigns there template uses or not both cases

   */
  generateMessage(messageData) {
    try {
      const { organizationId,template, messageContent, isTemplate, templateId,
        templateParameters, messageType, mediaUrl, mediaType, caption, audienceData } = messageData;

        const baseMessage = {
        organizationId,
        to : audienceData.msisdn,
      };

      console.log("baseMessage", baseMessage);  

      if (isTemplate) {
        if ( template.category === "AUTHENTICATION" ||
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
      } else {
        console.log("messageContent", messageContent);
        return this.generateTextMessage(baseMessage, messageContent, audienceData);
      }
    } catch (error) {
      logger.error("Error generating message payload", {
        error: error.message,
      });
      throw error;
    }
  }



/**
 * Generate template message payload
 */
generateTemplateMessage(baseMessage, template, audienceData) {
  const templateMessage = {
    ...baseMessage,
    templateName: template.name,
    templateLanguage: template.language || "en",
    templateParameters: [],
  };

  // Generate template parameters from audience attributes and template components
  if (template.components && Array.isArray(template.components)) {
    templateMessage.templateParameters = this.generateTemplateParameters(
      template.components,
      audienceData.attributes || {},
      audienceData.generated_asset_urls || {},
      template
    );
  }

  return templateMessage;
}

/**
 * Generate text message payload
 */

generateTextMessage(baseMessage, messageContent, audienceData) {
  let messageContentOne = messageContent || "";


  console.log("messageContentOne", messageContentOne);
  // Replace placeholders with audience data
  messageContentOne = this.replacePlaceholders(
    messageContent,
    audienceData,
    {}
  );
  console.log("messageContentOne", messageContentOne);

  return {
    ...baseMessage,
    messageType: "text",
    messageContent,
  };
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
      if (component.type === "HEADER" && component.format) {
        if (
          component.format === "IMAGE" ||
          component.format === "VIDEO" ||
          component.format === "DOCUMENT"
        ) {
          // Use template's header media URL or get from attributes
          const mediaUrl =
            generatedAssetUrls[component.format.toLowerCase()] || null;

          if (mediaUrl) {
            parameters.push({
              type: "header",
              valueType: component.format.toLowerCase(),
              mediaUrl: mediaUrl,
            });
          }
        } else if (component.format === "TEXT" && component.text) {
          parameters.push({
            type: "header",
            valueType: "text",
            value: this.replacePlaceholders(
              component.text,
              { attributes },
              template.parameters || {}
            ),
          });
        }
      } else if (component.type === "BODY" && component.text) {
        parameters.push({
          type: "body",
          valueType: "text",
          value: this.replacePlaceholders(
            component.text,
            { attributes },
            template.parameters || {}
          ),
        });
      }
    });

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
   * Validate message payload before sending
   * @param {Object} messagePayload - Generated message payload
   * @returns {boolean} True if valid
   */
  validateMessagePayload(messagePayload) {
    if (!messagePayload || typeof messagePayload !== "object") return false;
    if (!messagePayload.to) return false;

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


module.exports = new CustomMessageGenerator();
