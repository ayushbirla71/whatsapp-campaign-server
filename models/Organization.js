const BaseModel = require("./BaseModel");
const EncryptionUtil = require("../utils/encryption");

class Organization extends BaseModel {
  constructor() {
    super("organizations");
    this.encryptedFields = ["whatsapp_access_token", "whatsapp_app_secret"];
  }

  async create(organizationData) {
    try {
      // Encrypt sensitive WhatsApp Business API fields
      const encryptedData = EncryptionUtil.encryptObject(
        organizationData,
        this.encryptedFields
      );

      return await super.create(encryptedData);
    } catch (error) {
      throw new Error(`Error creating organization: ${error.message}`);
    }
  }

  async update(id, organizationData) {
    try {
      // Encrypt sensitive WhatsApp Business API fields if they exist in the update data
      const fieldsToEncrypt = this.encryptedFields.filter((field) =>
        organizationData.hasOwnProperty(field)
      );

      const encryptedData = EncryptionUtil.encryptObject(
        organizationData,
        fieldsToEncrypt
      );

      return await super.update(id, encryptedData);
    } catch (error) {
      throw new Error(`Error updating organization: ${error.message}`);
    }
  }

  async findById(id, includeDecrypted = false) {
    try {
      const organization = await super.findById(id);
      if (!organization) return null;

      if (includeDecrypted) {
        return this.decryptSensitiveFields(organization);
      }

      return this.sanitizeOrganization(organization);
    } catch (error) {
      throw new Error(`Error finding organization by ID: ${error.message}`);
    }
  }

  async findAll(
    conditions = {},
    limit = null,
    offset = null,
    includeDecrypted = false
  ) {
    try {
      const organizations = await super.findAll(conditions, limit, offset);

      if (includeDecrypted) {
        return organizations.map((org) => this.decryptSensitiveFields(org));
      }

      return organizations.map((org) => this.sanitizeOrganization(org));
    } catch (error) {
      throw new Error(`Error finding organizations: ${error.message}`);
    }
  }

  async findByName(name) {
    try {
      const query = "SELECT * FROM organizations WHERE name = $1";
      const result = await this.pool.query(query, [name]);
      const organization = result.rows[0] || null;

      if (organization) {
        return this.sanitizeOrganization(organization);
      }

      return null;
    } catch (error) {
      throw new Error(`Error finding organization by name: ${error.message}`);
    }
  }

  async updateWhatsAppConfig(id, whatsappConfig) {
    try {
      const updateData = {};

      if (whatsappConfig.whatsapp_business_account_id) {
        updateData.whatsapp_business_account_id =
          whatsappConfig.whatsapp_business_account_id;
      }

      if (whatsappConfig.whatsapp_access_token) {
        updateData.whatsapp_access_token = whatsappConfig.whatsapp_access_token;
      }

      if (whatsappConfig.whatsapp_phone_number_id) {
        updateData.whatsapp_phone_number_id =
          whatsappConfig.whatsapp_phone_number_id;
      }

      if (whatsappConfig.whatsapp_webhook_verify_token) {
        updateData.whatsapp_webhook_verify_token =
          whatsappConfig.whatsapp_webhook_verify_token;
      }

      if (whatsappConfig.whatsapp_webhook_url) {
        updateData.whatsapp_webhook_url = whatsappConfig.whatsapp_webhook_url;
      }

      if (whatsappConfig.whatsapp_app_id) {
        updateData.whatsapp_app_id = whatsappConfig.whatsapp_app_id;
      }

      if (whatsappConfig.whatsapp_app_secret) {
        updateData.whatsapp_app_secret = whatsappConfig.whatsapp_app_secret;
      }

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(
        `Error updating WhatsApp configuration: ${error.message}`
      );
    }
  }

  async getWhatsAppConfig(id) {
    try {
      const organization = await super.findById(id);
      if (!organization) return null;

      const decrypted = this.decryptSensitiveFields(organization);

      return {
        whatsapp_business_account_id: decrypted.whatsapp_business_account_id,
        whatsapp_access_token: decrypted.whatsapp_access_token,
        whatsapp_phone_number_id: decrypted.whatsapp_phone_number_id,
        whatsapp_webhook_verify_token: decrypted.whatsapp_webhook_verify_token,
        whatsapp_webhook_url: decrypted.whatsapp_webhook_url,
        whatsapp_app_id: decrypted.whatsapp_app_id,
        whatsapp_app_secret: decrypted.whatsapp_app_secret,
      };
    } catch (error) {
      throw new Error(`Error getting WhatsApp configuration: ${error.message}`);
    }
  }

  async findActiveOrganizations() {
    try {
      const organizations = await this.findAll({ status: "active" });
      return organizations;
    } catch (error) {
      throw new Error(`Error finding active organizations: ${error.message}`);
    }
  }

  decryptSensitiveFields(organization) {
    if (!organization) return null;

    return EncryptionUtil.decryptObject(organization, this.encryptedFields);
  }

  sanitizeOrganization(organization) {
    if (!organization) return null;

    const sanitized = { ...organization };

    // Remove encrypted fields from public view
    this.encryptedFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = "[ENCRYPTED]";
      }
    });

    return sanitized;
  }

  // Check if organization has WhatsApp configuration
  async hasWhatsAppConfig(id) {
    try {
      const config = await this.getWhatsAppConfig(id);
      return !!(
        config.whatsapp_business_account_id &&
        config.whatsapp_access_token &&
        config.whatsapp_phone_number_id
      );
    } catch (error) {
      throw new Error(
        `Error checking WhatsApp configuration: ${error.message}`
      );
    }
  }
}

module.exports = new Organization();
