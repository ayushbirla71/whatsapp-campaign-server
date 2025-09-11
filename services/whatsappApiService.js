const axios = require("axios");
const logger = require("../utils/logger");

class WhatsAppApiService {
  constructor() {
    this.baseURL = "https://graph.facebook.com/v18.0";
  }

  /**
   * Get message templates from WhatsApp Business API
   * @param {string} businessAccountId - WhatsApp Business Account ID
   * @param {string} accessToken - WhatsApp Access Token
   * @returns {Promise<Array>} Array of templates
   */
  async getMessageTemplates(businessAccountId, accessToken) {
    try {
      const url = `${this.baseURL}/${businessAccountId}/message_templates`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        params: {
          fields:
            "id,name,status,category,language,components,quality_score,rejected_reason,created_time,updated_time",
        },
      });

      if (response.data && response.data.data) {
        return response.data.data;
      }

      return [];
    } catch (error) {
      logger.error("Error fetching templates from WhatsApp API", {
        businessAccountId,
        error: error.message,
        response: error.response?.data,
      });

      if (error.response?.status === 401) {
        throw new Error("Invalid WhatsApp access token");
      } else if (error.response?.status === 403) {
        throw new Error("Access denied to WhatsApp Business Account");
      } else if (error.response?.status === 404) {
        throw new Error("WhatsApp Business Account not found");
      } else if (error.response?.status === 429) {
        throw new Error("WhatsApp API rate limit exceeded");
      }

      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }

  /**
   * Get a specific message template by ID
   * @param {string} templateId - WhatsApp Template ID
   * @param {string} accessToken - WhatsApp Access Token
   * @returns {Promise<Object>} Template object
   */
  async getMessageTemplate(templateId, accessToken) {
    try {
      const url = `${this.baseURL}/${templateId}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        params: {
          fields:
            "id,name,status,category,language,components,quality_score,rejected_reason,created_time,updated_time",
        },
      });

      return response.data;
    } catch (error) {
      logger.error("Error fetching template from WhatsApp API", {
        templateId,
        error: error.message,
        response: error.response?.data,
      });

      if (error.response?.status === 404) {
        throw new Error("Template not found in WhatsApp Business API");
      }

      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }

  /**
   * Validate WhatsApp Business API credentials
   * @param {string} businessAccountId - WhatsApp Business Account ID
   * @param {string} accessToken - WhatsApp Access Token
   * @returns {Promise<boolean>} True if credentials are valid
   */
  async validateCredentials(businessAccountId, accessToken) {
    try {
      const url = `${this.baseURL}/${businessAccountId}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        params: {
          fields: "id,name",
        },
      });

      return response.status === 200 && response.data.id === businessAccountId;
    } catch (error) {
      logger.error("Error validating WhatsApp credentials", {
        businessAccountId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Transform WhatsApp API template to our internal format
   * @param {Object} whatsappTemplate - Template from WhatsApp API
   * @param {string} organizationId - Organization ID
   * @returns {Object} Transformed template data
   */
  transformWhatsAppTemplate(whatsappTemplate, organizationId) {
    try {
      // Map WhatsApp status to our internal status
      const statusMapping = {
        APPROVED: "approved",
        PENDING: "pending_approval",
        REJECTED: "rejected",
        DISABLED: "rejected",
        PAUSED: "draft",
      };

      // Map WhatsApp category to our internal category
      const categoryMapping = {
        MARKETING: "MARKETING",
        UTILITY: "UTILITY",
        AUTHENTICATION: "AUTHENTICATION",
        TRANSACTIONAL: "UTILITY",
      };

      return {
        name: whatsappTemplate.name,
        category: categoryMapping[whatsappTemplate.category] || "UTILITY",
        language: whatsappTemplate.language || "en",
        components: whatsappTemplate.components || [],
        organization_id: organizationId,
        status: statusMapping[whatsappTemplate.status] || "draft",
        whatsapp_template_id: whatsappTemplate.id,
        whatsapp_status: whatsappTemplate.status,
        whatsapp_quality_score: whatsappTemplate.quality_score
          ? JSON.stringify(whatsappTemplate.quality_score)
          : null,
        whatsapp_rejected_reason: whatsappTemplate.rejected_reason || null,
        whatsapp_created_time: whatsappTemplate.created_time
          ? new Date(whatsappTemplate.created_time * 1000)
          : null,
        whatsapp_updated_time: whatsappTemplate.updated_time
          ? new Date(whatsappTemplate.updated_time * 1000)
          : null,
      };
    } catch (error) {
      logger.error("Error transforming WhatsApp template", {
        templateId: whatsappTemplate.id,
        error: error.message,
      });
      throw new Error(`Error transforming template: ${error.message}`);
    }
  }

  /**
   * Get phone numbers associated with WhatsApp Business Account
   * @param {string} businessAccountId - WhatsApp Business Account ID
   * @param {string} accessToken - WhatsApp Access Token
   * @returns {Promise<Array>} Array of phone numbers
   */
  async getPhoneNumbers(businessAccountId, accessToken) {
    try {
      const url = `${this.baseURL}/${businessAccountId}/phone_numbers`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        params: {
          fields: "id,display_phone_number,verified_name,quality_rating,status",
        },
      });

      return response.data.data || [];
    } catch (error) {
      logger.error("Error fetching phone numbers from WhatsApp API", {
        businessAccountId,
        error: error.message,
      });
      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }

  /**
   * Get WhatsApp Business Account information
   * @param {string} businessAccountId - WhatsApp Business Account ID
   * @param {string} accessToken - WhatsApp Access Token
   * @returns {Promise<Object>} Business account information
   */
  async getBusinessAccountInfo(businessAccountId, accessToken) {
    try {
      const url = `${this.baseURL}/${businessAccountId}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        params: {
          fields:
            "id,name,timezone_id,message_template_namespace,account_review_status",
        },
      });

      return response.data;
    } catch (error) {
      logger.error("Error fetching business account info from WhatsApp API", {
        businessAccountId,
        error: error.message,
      });
      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }
}

module.exports = new WhatsAppApiService();
