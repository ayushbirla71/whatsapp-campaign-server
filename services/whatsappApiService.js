// const axios = require("axios");
// const logger = require("../utils/logger");

// class WhatsAppApiService {
//   constructor() {
//     this.baseURL = "https://graph.facebook.com/v18.0";
//   }

//   /**
//    * Get message templates from WhatsApp Business API
//    * @param {string} businessAccountId - WhatsApp Business Account ID
//    * @param {string} accessToken - WhatsApp Access Token
//    * @returns {Promise<Array>} Array of templates
//    */
//   async getMessageTemplates(businessAccountId, accessToken) {
//     try {
//       const url = `${this.baseURL}/${businessAccountId}/message_templates`;

//       const response = await axios.get(url, {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           "Content-Type": "application/json",
//         },
//         params: {
//           fields:
//             "id,name,status,category,language,components,quality_score,rejected_reason,created_time,updated_time",
//         },
//       });

//       if (response.data && response.data.data) {
//         return response.data.data;
//       }

//       return [];
//     } catch (error) {
//       logger.error("Error fetching templates from WhatsApp API", {
//         businessAccountId,
//         error: error.message,
//         response: error.response?.data,
//       });

//       if (error.response?.status === 401) {
//         throw new Error("Invalid WhatsApp access token");
//       } else if (error.response?.status === 403) {
//         throw new Error("Access denied to WhatsApp Business Account");
//       } else if (error.response?.status === 404) {
//         throw new Error("WhatsApp Business Account not found");
//       } else if (error.response?.status === 429) {
//         throw new Error("WhatsApp API rate limit exceeded");
//       }

//       throw new Error(`WhatsApp API error: ${error.message}`);
//     }
//   }

//   /**
//    * Get a specific message template by ID
//    * @param {string} templateId - WhatsApp Template ID
//    * @param {string} accessToken - WhatsApp Access Token
//    * @returns {Promise<Object>} Template object
//    */
//   async getMessageTemplate(templateId, accessToken) {
//     try {
//       const url = `${this.baseURL}/${templateId}`;

//       const response = await axios.get(url, {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           "Content-Type": "application/json",
//         },
//         params: {
//           fields:
//             "id,name,status,category,language,components,quality_score,rejected_reason,created_time,updated_time",
//         },
//       });

//       return response.data;
//     } catch (error) {
//       logger.error("Error fetching template from WhatsApp API", {
//         templateId,
//         error: error.message,
//         response: error.response?.data,
//       });

//       if (error.response?.status === 404) {
//         throw new Error("Template not found in WhatsApp Business API");
//       }

//       throw new Error(`WhatsApp API error: ${error.message}`);
//     }
//   }

//   /**
//    * Validate WhatsApp Business API credentials
//    * @param {string} businessAccountId - WhatsApp Business Account ID
//    * @param {string} accessToken - WhatsApp Access Token
//    * @returns {Promise<boolean>} True if credentials are valid
//    */
//   async validateCredentials(businessAccountId, accessToken) {
//     try {
//       const url = `${this.baseURL}/${businessAccountId}`;

//       const response = await axios.get(url, {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           "Content-Type": "application/json",
//         },
//         params: {
//           fields: "id,name",
//         },
//       });

//       return response.status === 200 && response.data.id === businessAccountId;
//     } catch (error) {
//       logger.error("Error validating WhatsApp credentials", {
//         businessAccountId,
//         error: error.message,
//       });
//       return false;
//     }
//   }

//   /**
//    * Transform WhatsApp API template to our internal format
//    * @param {Object} whatsappTemplate - Template from WhatsApp API
//    * @param {string} organizationId - Organization ID
//    * @returns {Object} Transformed template data
//    */
//   transformWhatsAppTemplate(whatsappTemplate, organizationId) {
//     try {
//       // Map WhatsApp status to our internal status
//       const statusMapping = {
//         APPROVED: "approved",
//         PENDING: "pending_approval",
//         REJECTED: "rejected",
//         DISABLED: "rejected",
//         PAUSED: "draft",
//       };

//       // Map WhatsApp category to our internal category
//       const categoryMapping = {
//         MARKETING: "MARKETING",
//         UTILITY: "UTILITY",
//         AUTHENTICATION: "AUTHENTICATION",
//         TRANSACTIONAL: "UTILITY",
//       };

//       return {
//         name: whatsappTemplate.name,
//         category: categoryMapping[whatsappTemplate.category] || "UTILITY",
//         language: whatsappTemplate.language || "en",
//         components: whatsappTemplate.components || [],
//         organization_id: organizationId,
//         status: statusMapping[whatsappTemplate.status] || "draft",
//         whatsapp_template_id: whatsappTemplate.id,
//         whatsapp_status: whatsappTemplate.status,
//         whatsapp_quality_score: whatsappTemplate.quality_score
//           ? JSON.stringify(whatsappTemplate.quality_score)
//           : null,
//         whatsapp_rejected_reason: whatsappTemplate.rejected_reason || null,
//         whatsapp_created_time: whatsappTemplate.created_time
//           ? new Date(whatsappTemplate.created_time * 1000)
//           : null,
//         whatsapp_updated_time: whatsappTemplate.updated_time
//           ? new Date(whatsappTemplate.updated_time * 1000)
//           : null,
//       };
//     } catch (error) {
//       logger.error("Error transforming WhatsApp template", {
//         templateId: whatsappTemplate.id,
//         error: error.message,
//       });
//       throw new Error(`Error transforming template: ${error.message}`);
//     }
//   }

//   /**
//    * Get phone numbers associated with WhatsApp Business Account
//    * @param {string} businessAccountId - WhatsApp Business Account ID
//    * @param {string} accessToken - WhatsApp Access Token
//    * @returns {Promise<Array>} Array of phone numbers
//    */
//   async getPhoneNumbers(businessAccountId, accessToken) {
//     try {
//       const url = `${this.baseURL}/${businessAccountId}/phone_numbers`;

//       const response = await axios.get(url, {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           "Content-Type": "application/json",
//         },
//         params: {
//           fields: "id,display_phone_number,verified_name,quality_rating,status",
//         },
//       });

//       return response.data.data || [];
//     } catch (error) {
//       logger.error("Error fetching phone numbers from WhatsApp API", {
//         businessAccountId,
//         error: error.message,
//       });
//       throw new Error(`WhatsApp API error: ${error.message}`);
//     }
//   }

//   /**
//    * Get WhatsApp Business Account information
//    * @param {string} businessAccountId - WhatsApp Business Account ID
//    * @param {string} accessToken - WhatsApp Access Token
//    * @returns {Promise<Object>} Business account information
//    */
//   async getBusinessAccountInfo(businessAccountId, accessToken) {
//     try {
//       const url = `${this.baseURL}/${businessAccountId}`;

//       const response = await axios.get(url, {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           "Content-Type": "application/json",
//         },
//         params: {
//           fields:
//             "id,name,timezone_id,message_template_namespace,account_review_status",
//         },
//       });

//       return response.data;
//     } catch (error) {
//       logger.error("Error fetching business account info from WhatsApp API", {
//         businessAccountId,
//         error: error.message,
//       });
//       throw new Error(`WhatsApp API error: ${error.message}`);
//     }
//   }
// }

// module.exports = new WhatsAppApiService();








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

  /**
   * Mark an inbound message as read (and optionally show typing indicator)
   * POST /{phone-number-id}/messages { status: "read", message_id }
   * @param {string} phoneNumberId - WhatsApp Phone Number ID (the business number)
   * @param {string} whatsappMessageId - The wamid of the inbound message to mark read
   * @param {string} accessToken - WhatsApp Access Token
   * @returns {Promise<Object>} API response
   */
  async markMessageAsRead(phoneNumberId, whatsappMessageId, accessToken) {
    try {
      const url = `${this.baseURL}/${phoneNumberId}/messages`;

      const response = await axios.post(
        url,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: whatsappMessageId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      return response.data;
    } catch (error) {
      logger.error("Error marking message as read on WhatsApp API", {
        phoneNumberId,
        whatsappMessageId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }

  /**
   * Resolve a WhatsApp media ID to a short-lived download URL
   * GET /{media-id}
   * @param {string} mediaId - WhatsApp media ID (from an inbound message)
   * @param {string} accessToken - WhatsApp Access Token
   * @returns {Promise<Object>} { url, mime_type, sha256, file_size, id }
   */
  async getMediaUrl(mediaId, accessToken) {
    try {
      const url = `${this.baseURL}/${mediaId}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15000,
      });

      return response.data;
    } catch (error) {
      logger.error("Error resolving WhatsApp media URL", {
        mediaId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }

  /**
   * Download the actual media bytes from the short-lived URL returned by getMediaUrl().
   * Must be called with the same access token - WhatsApp media URLs are not public.
   * @param {string} mediaUrl - URL returned from getMediaUrl()
   * @param {string} accessToken - WhatsApp Access Token
   * @returns {Promise<{buffer: Buffer, contentType: string}>}
   */
  async downloadMedia(mediaUrl, accessToken) {
    try {
      const response = await axios.get(mediaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: "arraybuffer",
        timeout: 30000,
      });

      return {
        buffer: Buffer.from(response.data),
        contentType: response.headers["content-type"] || "application/octet-stream",
      };
    } catch (error) {
      logger.error("Error downloading WhatsApp media", {
        mediaUrl,
        error: error.message,
      });
      throw new Error(`WhatsApp media download error: ${error.message}`);
    }
  }

  /**
   * Create a new message template on WhatsApp (push local template to Meta)
   * POST /{waba-id}/message_templates
   * @param {string} businessAccountId
   * @param {Object} templateData - { name, category, language, components }
   * @param {string} accessToken
   * @returns {Promise<Object>} { id, status, category }
   */
  async createTemplateOnWhatsApp(businessAccountId, templateData, accessToken) {
    try {
      const url = `${this.baseURL}/${businessAccountId}/message_templates`;

      const response = await axios.post(
        url,
        {
          name: templateData.name,
          category: templateData.category,
          language: templateData.language || "en",
          components: templateData.components || [],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );

      return response.data;
    } catch (error) {
      logger.error("Error creating template on WhatsApp API", {
        businessAccountId,
        templateName: templateData?.name,
        error: error.message,
        response: error.response?.data,
      });

      const metaError = error.response?.data?.error?.message;
      throw new Error(
        metaError ? `WhatsApp API error: ${metaError}` : `WhatsApp API error: ${error.message}`
      );
    }
  }

  /**
   * Edit an existing template's content on WhatsApp.
   * POST /{template-id} with the fields to change (only allowed pre-approval,
   * or a limited set of fields post-approval per Meta's rules).
   * @param {string} whatsappTemplateId - The WhatsApp-assigned template ID (not the name)
   * @param {Object} templateData - { category, components }
   * @param {string} accessToken
   */
  async updateTemplateOnWhatsApp(whatsappTemplateId, templateData, accessToken) {
    try {
      const url = `${this.baseURL}/${whatsappTemplateId}`;

      const payload = {};
      if (templateData.category) payload.category = templateData.category;
      if (templateData.components) payload.components = templateData.components;

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      });

      return response.data;
    } catch (error) {
      logger.error("Error updating template on WhatsApp API", {
        whatsappTemplateId,
        error: error.message,
        response: error.response?.data,
      });

      const metaError = error.response?.data?.error?.message;
      throw new Error(
        metaError ? `WhatsApp API error: ${metaError}` : `WhatsApp API error: ${error.message}`
      );
    }
  }

  /**
   * Delete a message template from WhatsApp by name.
   * DELETE /{waba-id}/message_templates?name={template_name}
   * @param {string} businessAccountId
   * @param {string} templateName
   * @param {string} accessToken
   */
  async deleteTemplateOnWhatsApp(businessAccountId, templateName, accessToken) {
    try {
      const url = `${this.baseURL}/${businessAccountId}/message_templates`;

      const response = await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: { name: templateName },
        timeout: 20000,
      });

      return response.data;
    } catch (error) {
      // Meta returns 400/100 if template doesn't exist anymore - treat as success (idempotent delete)
      if (error.response?.status === 400) {
        logger.warn("Template delete on WhatsApp API returned 400 - treating as already deleted", {
          businessAccountId,
          templateName,
          response: error.response?.data,
        });
        return { success: true, alreadyDeleted: true };
      }

      logger.error("Error deleting template on WhatsApp API", {
        businessAccountId,
        templateName,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }

  /**
   * Get the WhatsApp Business Profile (about, description, address, email, website, profile picture)
   * GET /{phone-number-id}/whatsapp_business_profile
   */
  async getBusinessProfile(phoneNumberId, accessToken) {
    try {
      const url = `${this.baseURL}/${phoneNumberId}/whatsapp_business_profile`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: "about,address,description,email,profile_picture_url,websites,vertical",
        },
        timeout: 15000,
      });

      return response.data?.data?.[0] || null;
    } catch (error) {
      logger.error("Error fetching WhatsApp business profile", {
        phoneNumberId,
        error: error.message,
      });
      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }

  /**
   * Update the WhatsApp Business Profile
   * POST /{phone-number-id}/whatsapp_business_profile
   * @param {string} phoneNumberId
   * @param {Object} profileData - subset of { about, address, description, email, vertical, websites }
   * @param {string} accessToken
   */
  async updateBusinessProfile(phoneNumberId, profileData, accessToken) {
    try {
      const url = `${this.baseURL}/${phoneNumberId}/whatsapp_business_profile`;

      const response = await axios.post(
        url,
        {
          messaging_product: "whatsapp",
          ...profileData,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      return response.data;
    } catch (error) {
      logger.error("Error updating WhatsApp business profile", {
        phoneNumberId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }

  /**
   * Pull current phone number health: quality rating, messaging limit tier, name status.
   * GET /{phone-number-id}?fields=quality_rating,messaging_limit_tier,name_status,status
   * Use this before large campaign sends to avoid pushing a batch through a
   * number that's already rate-limited or flagged.
   */
  async getPhoneNumberHealth(phoneNumberId, accessToken) {
    try {
      const url = `${this.baseURL}/${phoneNumberId}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: "quality_rating,messaging_limit_tier,name_status,status,display_phone_number",
        },
        timeout: 15000,
      });

      return response.data;
    } catch (error) {
      logger.error("Error fetching phone number health from WhatsApp API", {
        phoneNumberId,
        error: error.message,
      });
      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }

  /**
   * Register a phone number for Cloud API use (one-time step, requires a 2-step-verification PIN)
   * POST /{phone-number-id}/register
   */
  async registerPhoneNumber(phoneNumberId, pin, accessToken) {
    try {
      const url = `${this.baseURL}/${phoneNumberId}/register`;

      const response = await axios.post(
        url,
        {
          messaging_product: "whatsapp",
          pin,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );

      return response.data;
    } catch (error) {
      logger.error("Error registering phone number on WhatsApp API", {
        phoneNumberId,
        error: error.message,
        response: error.response?.data,
      });

      const metaError = error.response?.data?.error?.message;
      throw new Error(
        metaError ? `WhatsApp API error: ${metaError}` : `WhatsApp API error: ${error.message}`
      );
    }
  }

  /**
   * Deregister a phone number from Cloud API use
   * POST /{phone-number-id}/deregister
   */
  async deregisterPhoneNumber(phoneNumberId, accessToken) {
    try {
      const url = `${this.baseURL}/${phoneNumberId}/deregister`;

      const response = await axios.post(url, null, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 20000,
      });

      return response.data;
    } catch (error) {
      logger.error("Error deregistering phone number on WhatsApp API", {
        phoneNumberId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }
}

module.exports = new WhatsAppApiService();
