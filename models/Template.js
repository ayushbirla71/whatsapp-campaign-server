const BaseModel = require("./BaseModel");

class Template extends BaseModel {
  constructor() {
    super("templates");
  }

  async create(templateData) {
    try {
      // Ensure components is stored as JSON
      if (
        templateData.components &&
        typeof templateData.components === "object"
      ) {
        templateData.components = JSON.stringify(templateData.components);
      }

      return await super.create(templateData);
    } catch (error) {
      throw new Error(`Error creating template: ${error.message}`);
    }
  }

  async update(id, templateData) {
    try {
      // Ensure components is stored as JSON
      if (
        templateData.components &&
        typeof templateData.components === "object"
      ) {
        templateData.components = JSON.stringify(templateData.components);
      }

      return await super.update(id, templateData);
    } catch (error) {
      throw new Error(`Error updating template: ${error.message}`);
    }
  }

  async findByOrganization(organizationId, filters = {}) {
    try {
      let query = `
        SELECT t.*, u.first_name as created_by_name, u.last_name as created_by_lastname,
               a.first_name as approved_by_name, a.last_name as approved_by_lastname,
               r.first_name as rejected_by_name, r.last_name as rejected_by_lastname,
               aa.first_name as admin_approved_by_name, aa.last_name as admin_approved_by_lastname
        FROM templates t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN users a ON t.approved_by = a.id
        LEFT JOIN users r ON t.rejected_by = r.id
        LEFT JOIN users aa ON t.admin_approved_by = aa.id
        WHERE t.organization_id = $1
      `;

      const values = [organizationId];
      let paramCount = 1;

      // Apply filters
      if (filters.status) {
        paramCount++;
        query += ` AND t.status = $${paramCount}`;
        values.push(filters.status);
      }

      if (filters.category) {
        paramCount++;
        query += ` AND t.category = $${paramCount}`;
        values.push(filters.category);
      }

      if (filters.language) {
        paramCount++;
        query += ` AND t.language = $${paramCount}`;
        values.push(filters.language);
      }

      if (filters.whatsapp_status) {
        paramCount++;
        query += ` AND t.whatsapp_status = $${paramCount}`;
        values.push(filters.whatsapp_status);
      }

      if (filters.approved_by_admin) {
        paramCount++;
        query += ` AND t.approved_by_admin = $${paramCount}`;
        values.push(filters.approved_by_admin);
      }

      query += ` ORDER BY t.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        values.push(filters.offset);
      }

      const result = await this.pool.query(query, values);
      return result.rows.map((row) => this.parseTemplate(row));
    } catch (error) {
      throw new Error(
        `Error finding templates by organization: ${error.message}`
      );
    }
  }

  async findPendingApproval() {
    try {
      const query = `
        SELECT t.*, u.first_name as created_by_name, u.last_name as created_by_lastname,
               o.name as organization_name
        FROM templates t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN organizations o ON t.organization_id = o.id
        WHERE t.status = 'pending_approval'
        ORDER BY t.submitted_for_approval_at ASC
      `;

      const result = await this.pool.query(query);
      return result.rows.map((row) => this.parseTemplate(row));
    } catch (error) {
      throw new Error(
        `Error finding pending approval templates: ${error.message}`
      );
    }
  }

  async submitForApproval(id, userId) {
    try {
      const updateData = {
        status: "pending_approval",
        submitted_for_approval_at: new Date(),
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(
        `Error submitting template for approval: ${error.message}`
      );
    }
  }

  async approveTemplate(id, approvedBy) {
    try {
      const updateData = {
        status: "approved",
        approved_by: approvedBy,
        approved_at: new Date(),
        rejected_by: null,
        rejected_at: null,
        rejection_reason: null,
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error approving template: ${error.message}`);
    }
  }

  async rejectTemplate(id, rejectedBy, rejectionReason) {
    try {
      const updateData = {
        status: "rejected",
        rejected_by: rejectedBy,
        rejected_at: new Date(),
        rejection_reason: rejectionReason,
        approved_by: null,
        approved_at: null,
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error rejecting template: ${error.message}`);
    }
  }

  // Admin approval methods for campaign usage
  async adminApproveTemplate(
    id,
    approvedBy,
    parameters = {},
    isAutoReplyTemplate = false,
    buttonMappings = {}
  ) {
    try {
      const updateData = {
        approved_by_admin: "approved",
        admin_approved_by: approvedBy,
        admin_approved_at: new Date(),
        admin_rejected_at: null,
        admin_rejection_reason: null,
        parameters: JSON.stringify(parameters),
        is_auto_reply_template: isAutoReplyTemplate,
        auto_reply_button_mappings: JSON.stringify(buttonMappings),
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error admin approving template: ${error.message}`);
    }
  }

  async adminRejectTemplate(id, rejectedBy, rejectionReason) {
    try {
      const updateData = {
        approved_by_admin: "rejected",
        admin_approved_by: null,
        admin_approved_at: null,
        admin_rejected_at: new Date(),
        admin_rejection_reason: rejectionReason,
        parameters: JSON.stringify({}),
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error admin rejecting template: ${error.message}`);
    }
  }

  async findPendingAdminApproval() {
    try {
      const query = `
        SELECT t.*, u.first_name as created_by_name, u.last_name as created_by_lastname,
               o.name as organization_name
        FROM templates t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN organizations o ON t.organization_id = o.id
        WHERE t.status = 'approved' AND t.approved_by_admin = 'pending'
        ORDER BY t.approved_at ASC
      `;

      const result = await this.pool.query(query);
      return result.rows.map((row) => this.parseTemplate(row));
    } catch (error) {
      throw new Error(
        `Error finding pending admin approval templates: ${error.message}`
      );
    }
  }

  async updateTemplateParameters(id, parameters, isAutoReplyTemplate = null) {
    try {
      const updateData = {
        parameters: JSON.stringify(parameters),
      };

      // Only update is_auto_reply_template if explicitly provided
      if (isAutoReplyTemplate !== null) {
        updateData.is_auto_reply_template = isAutoReplyTemplate;
      }

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error updating template parameters: ${error.message}`);
    }
  }

  async updateWhatsAppStatus(
    id,
    whatsappStatus,
    whatsappTemplateId = null,
    qualityScore = null
  ) {
    try {
      const updateData = {
        whatsapp_status: whatsappStatus,
      };

      if (whatsappTemplateId) {
        updateData.whatsapp_template_id = whatsappTemplateId;
      }

      if (qualityScore) {
        updateData.whatsapp_quality_score = qualityScore;
      }

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error updating WhatsApp status: ${error.message}`);
    }
  }

  async updateUsageStats(id, stats) {
    try {
      const updateData = {};

      if (stats.sent_count !== undefined) {
        updateData.sent_count = stats.sent_count;
      }

      if (stats.delivered_count !== undefined) {
        updateData.delivered_count = stats.delivered_count;
      }

      if (stats.read_count !== undefined) {
        updateData.read_count = stats.read_count;
      }

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error updating usage statistics: ${error.message}`);
    }
  }

  async findByNameAndOrganization(name, organizationId, language = "en") {
    try {
      const query = `
        SELECT * FROM templates
        WHERE name = $1 AND organization_id = $2 AND language = $3
      `;
      const result = await this.pool.query(query, [
        name,
        organizationId,
        language,
      ]);
      return result.rows[0] ? this.parseTemplate(result.rows[0]) : null;
    } catch (error) {
      throw new Error(
        `Error finding template by name and organization: ${error.message}`
      );
    }
  }

  async findByWhatsAppTemplateId(whatsappTemplateId) {
    try {
      const query = `
        SELECT * FROM templates
        WHERE whatsapp_template_id = $1
        LIMIT 1
      `;
      const result = await this.pool.query(query, [whatsappTemplateId]);
      return result.rows[0] ? this.parseTemplate(result.rows[0]) : null;
    } catch (error) {
      throw new Error(
        `Error finding template by WhatsApp template ID: ${error.message}`
      );
    }
  }

  async findActiveTemplates(organizationId) {
    try {
      const query = `
        SELECT * FROM templates 
        WHERE organization_id = $1 AND status = 'active'
        ORDER BY created_at DESC
      `;
      const result = await this.pool.query(query, [organizationId]);
      return result.rows.map((row) => this.parseTemplate(row));
    } catch (error) {
      throw new Error(`Error finding active templates: ${error.message}`);
    }
  }

  async getTemplateStats(organizationId) {
    try {
      const query = `
        SELECT 
          status,
          COUNT(*) as count,
          SUM(sent_count) as total_sent,
          SUM(delivered_count) as total_delivered,
          SUM(read_count) as total_read
        FROM templates 
        WHERE organization_id = $1
        GROUP BY status
      `;
      const result = await this.pool.query(query, [organizationId]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting template statistics: ${error.message}`);
    }
  }

  // Parse template data and handle JSON fields
  parseTemplate(templateRow) {
    if (!templateRow) return null;

    const template = { ...templateRow };

    // Parse components JSON
    if (template.components && typeof template.components === "string") {
      try {
        template.components = JSON.parse(template.components);
      } catch (error) {
        template.components = null;
      }
    }

    // Parse parameters JSON
    if (template.parameters && typeof template.parameters === "string") {
      try {
        template.parameters = JSON.parse(template.parameters);
      } catch (error) {
        template.parameters = {};
      }
    }

    return template;
  }

  // Validate template data before saving
  validateTemplate(templateData) {
    const errors = [];

    if (!templateData.name || templateData.name.trim().length === 0) {
      errors.push("Template name is required");
    }

    if (!templateData.category) {
      errors.push("Template category is required");
    }

    if (!templateData.body_text || templateData.body_text.trim().length === 0) {
      errors.push("Template body text is required");
    }

    if (!templateData.organization_id) {
      errors.push("Organization ID is required");
    }

    if (!templateData.created_by) {
      errors.push("Created by user ID is required");
    }

    // Validate category
    const validCategories = ["AUTHENTICATION", "MARKETING", "UTILITY"];
    if (
      templateData.category &&
      !validCategories.includes(templateData.category)
    ) {
      errors.push("Invalid template category");
    }

    // Validate language
    const validLanguages = [
      "en",
      "en_US",
      "es",
      "es_ES",
      "pt_BR",
      "hi",
      "ar",
      "fr",
      "de",
      "it",
      "ja",
      "ko",
      "ru",
      "zh_CN",
      "zh_TW",
    ];
    if (
      templateData.language &&
      !validLanguages.includes(templateData.language)
    ) {
      errors.push("Invalid template language");
    }

    return errors;
  }

  // Get auto reply templates for organization
  async findAutoReplyTemplates(organizationId) {
    try {
      const query = `
        SELECT * FROM templates 
        WHERE organization_id = $1 
        AND approved_by_admin = 'approved'
        AND is_auto_reply_template = true
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [organizationId]);
      return result.rows.map((template) => this.parseTemplate(template));
    } catch (error) {
      throw new Error(`Error finding auto reply templates: ${error.message}`);
    }
  }

  // Update auto reply template status
  async updateAutoReplyStatus(id, isAutoReplyTemplate) {
    try {
      const updateData = {
        is_auto_reply_template: isAutoReplyTemplate,
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error updating auto reply status: ${error.message}`);
    }
  }

  // Helper method to detect interactive components and extract button text
  detectInteractiveButtons(components) {
    const buttons = [];

    if (!components || !Array.isArray(components)) return buttons;

    components.forEach((component) => {
      if (component.type === "BUTTONS" && component.buttons) {
        component.buttons.forEach((button) => {
          if (button.type === "QUICK_REPLY" && button.text) {
            buttons.push({
              text: button.text.trim(),
              type: "QUICK_REPLY",
            });
          }
        });
      }
    });

    return buttons;
  }

  // Check if template has interactive buttons that need auto-reply setup
  hasInteractiveButtons(components) {
    const buttons = this.detectInteractiveButtons(components);
    return buttons.length > 0;
  }

  // Get auto reply templates that can be used for button responses
  async findAutoReplyTemplatesForButtons(organizationId) {
    try {
      const query = `
        SELECT id, name, body_text, components 
        FROM templates 
        WHERE organization_id = $1 
        AND approved_by_admin = 'approved'
        AND is_auto_reply_template = true
        ORDER BY name ASC
      `;

      const result = await this.pool.query(query, [organizationId]);
      return result.rows.map((template) => ({
        id: template.id,
        name: template.name,
        body_text: template.body_text,
        components:
          typeof template.components === "string"
            ? JSON.parse(template.components)
            : template.components,
      }));
    } catch (error) {
      throw new Error(
        `Error finding auto reply templates for buttons: ${error.message}`
      );
    }
  }

  // Update button mappings for a template
  async updateButtonMappings(id, buttonMappings) {
    try {
      const updateData = {
        auto_reply_button_mappings: JSON.stringify(buttonMappings),
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error updating button mappings: ${error.message}`);
    }
  }
}

module.exports = new Template();
