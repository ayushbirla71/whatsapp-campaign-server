const Template = require("../models/Template");
const Organization = require("../models/Organization");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const whatsappApiService = require("../services/whatsappApiService");

// Get templates for an organization
const getTemplates = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const {
    page = 1,
    limit = 10,
    status,
    category,
    language,
    whatsapp_status,
  } = req.query;
  const offset = (page - 1) * limit;

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  if (
    req.user.role === "organization_user" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const filters = {
    limit: parseInt(limit),
    offset: parseInt(offset),
  };

  if (status) filters.status = status;
  if (category) filters.category = category;
  if (language) filters.language = language;
  if (whatsapp_status) filters.whatsapp_status = whatsapp_status;

  const templates = await Template.findByOrganization(organizationId, filters);
  const total = await Template.count({ organization_id: organizationId });

  res.json({
    success: true,
    data: {
      templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// Get template by ID
const getTemplateById = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  const template = await Template.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== template.organization_id
  ) {
    throw new AppError("Access denied to this template", 403);
  }

  if (
    req.user.role === "organization_user" &&
    req.user.organization_id !== template.organization_id
  ) {
    throw new AppError("Access denied to this template", 403);
  }

  res.json({
    success: true,
    data: {
      template: Template.parseTemplate(template),
    },
  });
});

// Create new template
const createTemplate = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const templateData = req.body;

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError("Organization users cannot create templates", 403);
  }

  // Check if organization exists
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }

  // Validate template data
  const validationErrors = Template.validateTemplate({
    ...templateData,
    organization_id: organizationId,
    created_by: req.user.id,
  });

  if (validationErrors.length > 0) {
    throw new AppError(
      `Validation failed: ${validationErrors.join(", ")}`,
      400
    );
  }

  // Check for duplicate template name in organization
  const existingTemplate = await Template.findByNameAndOrganization(
    templateData.name,
    organizationId,
    templateData.language || "en"
  );

  if (existingTemplate) {
    throw new AppError(
      "Template with this name and language already exists in the organization",
      409
    );
  }

  // Create template
  const newTemplateData = {
    ...templateData,
    organization_id: organizationId,
    created_by: req.user.id,
    status: "draft",
  };

  const newTemplate = await Template.create(newTemplateData);

  logger.info("Template created successfully", {
    templateId: newTemplate.id,
    templateName: newTemplate.name,
    organizationId,
    createdBy: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: "Template created successfully",
    data: {
      template: Template.parseTemplate(newTemplate),
    },
  });
});

// Update template
const updateTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const updateData = req.body;

  const template = await Template.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== template.organization_id
  ) {
    throw new AppError("Access denied to this template", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError("Organization users cannot update templates", 403);
  }

  // Don't allow updating approved templates unless you're super/system admin
  if (
    template.status === "approved" &&
    !["super_admin", "system_admin"].includes(req.user.role)
  ) {
    throw new AppError("Cannot update approved templates", 400);
  }

  // Remove fields that shouldn't be updated directly
  delete updateData.organization_id;
  delete updateData.created_by;
  delete updateData.created_at;
  delete updateData.approved_by;
  delete updateData.approved_at;
  delete updateData.rejected_by;
  delete updateData.rejected_at;

  const updatedTemplate = await Template.update(templateId, updateData);

  logger.info("Template updated successfully", {
    templateId,
    updatedBy: req.user.id,
    changes: updateData,
  });

  res.json({
    success: true,
    message: "Template updated successfully",
    data: {
      template: Template.parseTemplate(updatedTemplate),
    },
  });
});

// Delete template
const deleteTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  const template = await Template.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== template.organization_id
  ) {
    throw new AppError("Access denied to this template", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError("Organization users cannot delete templates", 403);
  }

  // Don't allow deleting active templates
  if (template.status === "active") {
    throw new AppError(
      "Cannot delete active templates. Pause the template first.",
      400
    );
  }

  await Template.delete(templateId);

  logger.info("Template deleted successfully", {
    templateId,
    templateName: template.name,
    deletedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Template deleted successfully",
  });
});

// Submit template for approval
const submitForApproval = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  const template = await Template.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== template.organization_id
  ) {
    throw new AppError("Access denied to this template", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError(
      "Organization users cannot submit templates for approval",
      403
    );
  }

  if (template.status !== "draft" && template.status !== "rejected") {
    throw new AppError(
      "Only draft or rejected templates can be submitted for approval",
      400
    );
  }

  const updatedTemplate = await Template.submitForApproval(
    templateId,
    req.user.id
  );

  logger.info("Template submitted for approval", {
    templateId,
    templateName: template.name,
    submittedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Template submitted for approval successfully",
    data: {
      template: Template.parseTemplate(updatedTemplate),
    },
  });
});

// Get pending approval templates (for super admin and system admin)
const getPendingApprovalTemplates = asyncHandler(async (req, res) => {
  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError("Access denied", 403);
  }

  const templates = await Template.findPendingApproval();

  res.json({
    success: true,
    data: {
      templates,
    },
  });
});

// Approve template
const approveTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can approve templates",
      403
    );
  }

  const template = await Template.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  if (template.status !== "pending_approval") {
    throw new AppError("Only pending approval templates can be approved", 400);
  }

  const updatedTemplate = await Template.approveTemplate(
    templateId,
    req.user.id
  );

  logger.info("Template approved", {
    templateId,
    templateName: template.name,
    approvedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Template approved successfully",
    data: {
      template: Template.parseTemplate(updatedTemplate),
    },
  });
});

// Reject template
const rejectTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { rejection_reason } = req.body;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can reject templates",
      403
    );
  }

  if (!rejection_reason || rejection_reason.trim().length === 0) {
    throw new AppError("Rejection reason is required", 400);
  }

  const template = await Template.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  if (template.status !== "pending_approval") {
    throw new AppError("Only pending approval templates can be rejected", 400);
  }

  const updatedTemplate = await Template.rejectTemplate(
    templateId,
    req.user.id,
    rejection_reason
  );

  logger.info("Template rejected", {
    templateId,
    templateName: template.name,
    rejectedBy: req.user.id,
    rejectionReason: rejection_reason,
  });

  res.json({
    success: true,
    message: "Template rejected successfully",
    data: {
      template: Template.parseTemplate(updatedTemplate),
    },
  });
});

// Sync templates from WhatsApp Business API
const syncTemplatesFromWhatsApp = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  // Only super admin and system admin can sync templates
  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Access denied. Only super admin and system admin can sync templates",
      403
    );
  }

  // Check if organization exists
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }

  // Get WhatsApp configuration for the organization
  const whatsappConfig = await Organization.getWhatsAppConfig(organizationId);
  if (
    !whatsappConfig ||
    !whatsappConfig.whatsapp_business_account_id ||
    !whatsappConfig.whatsapp_access_token
  ) {
    throw new AppError(
      "WhatsApp Business API configuration not found for this organization",
      400
    );
  }

  try {
    // Validate WhatsApp credentials first
    const isValidCredentials = await whatsappApiService.validateCredentials(
      whatsappConfig.whatsapp_business_account_id,
      whatsappConfig.whatsapp_access_token
    );

    if (!isValidCredentials) {
      throw new AppError("Invalid WhatsApp Business API credentials", 400);
    }

    // Fetch templates from WhatsApp Business API
    const whatsappTemplates = await whatsappApiService.getMessageTemplates(
      whatsappConfig.whatsapp_business_account_id,
      whatsappConfig.whatsapp_access_token
    );

    console.log("whatsappTemplates", whatsappTemplates);

    if (!whatsappTemplates || whatsappTemplates.length === 0) {
      return res.json({
        success: true,
        message: "No templates found in WhatsApp Business API",
        data: {
          synced_count: 0,
          updated_count: 0,
          created_count: 0,
          templates: [],
        },
      });
    }

    const syncResults = {
      synced_count: 0,
      updated_count: 0,
      created_count: 0,
      errors: [],
      templates: [],
    };

    // Process each template from WhatsApp API
    for (const whatsappTemplate of whatsappTemplates) {
      try {
        // Transform WhatsApp template to our internal format
        const templateData = whatsappApiService.transformWhatsAppTemplate(
          whatsappTemplate,
          organizationId
        );

        // Check if template already exists by WhatsApp template ID
        const existingTemplate = await Template.findByWhatsAppTemplateId(
          whatsappTemplate.id
        );

        if (existingTemplate) {
          // Update existing template
          const updatedTemplate = await Template.update(existingTemplate.id, {
            ...templateData,
            updated_at: new Date(),
            synced_at: new Date(),
            synced_by: req.user.id,
          });

          syncResults.updated_count++;
          syncResults.templates.push({
            action: "updated",
            template: Template.parseTemplate(updatedTemplate),
          });

          logger.info("Template updated from WhatsApp sync", {
            templateId: existingTemplate.id,
            whatsappTemplateId: whatsappTemplate.id,
            organizationId,
            syncedBy: req.user.id,
          });
        } else {
          // Create new template

          console.log("templateData", templateData);
          const newTemplate = await Template.create({
            ...templateData,
            created_by: req.user.id,
            synced_at: new Date(),
            synced_by: req.user.id,
          });

          console.log("newTemplate", newTemplate);
          syncResults.created_count++;
          syncResults.templates.push({
            action: "created",
            template: Template.parseTemplate(newTemplate),
          });

          logger.info("Template created from WhatsApp sync", {
            templateId: newTemplate.id,
            whatsappTemplateId: whatsappTemplate.id,
            organizationId,
            syncedBy: req.user.id,
          });
        }

        syncResults.synced_count++;
      } catch (templateError) {
        logger.error("Error processing template during sync", {
          whatsappTemplateId: whatsappTemplate.id,
          templateName: whatsappTemplate.name,
          error: templateError.message,
        });

        syncResults.errors.push({
          whatsapp_template_id: whatsappTemplate.id,
          template_name: whatsappTemplate.name,
          error: templateError.message,
        });
      }
    }

    logger.info("WhatsApp templates sync completed", {
      organizationId,
      syncedBy: req.user.id,
      totalTemplates: whatsappTemplates.length,
      syncedCount: syncResults.synced_count,
      createdCount: syncResults.created_count,
      updatedCount: syncResults.updated_count,
      errorsCount: syncResults.errors.length,
    });

    res.json({
      success: true,
      message: `Successfully synced ${syncResults.synced_count} templates from WhatsApp Business API`,
      data: syncResults,
    });
  } catch (error) {
    logger.error("Error syncing templates from WhatsApp API", {
      organizationId,
      error: error.message,
      syncedBy: req.user.id,
    });

    throw new AppError(`Failed to sync templates: ${error.message}`, 500);
  }
});

// Get pending admin approval templates (for super admin and system admin)
const getPendingAdminApprovalTemplates = asyncHandler(async (req, res) => {
  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError("Access denied", 403);
  }

  const templates = await Template.findPendingAdminApproval();

  res.json({
    success: true,
    data: {
      templates,
    },
  });
});

// Admin approve template for campaign usage
const adminApproveTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const {
    parameters,
    is_auto_reply_template = false,
    button_mappings = {},
  } = req.body;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can admin approve templates",
      403
    );
  }

  const template = await Template.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  if (template.status !== "approved") {
    throw new AppError("Only approved templates can be admin approved", 400);
  }

  if (template.approved_by_admin === "approved") {
    throw new AppError("Template is already admin approved", 400);
  }

  // Validate parameters if provided
  if (parameters && typeof parameters !== "object") {
    throw new AppError("Parameters must be a valid object", 400);
  }

  // Parse template components to extract required parameters and buttons
  const components =
    typeof template.components === "string"
      ? JSON.parse(template.components)
      : template.components;

  // Extract all parameter placeholders from template body
  const bodyComponent = components?.find((comp) => comp.type === "BODY");
  const requiredParameters = [];

  if (bodyComponent && bodyComponent.text) {
    const parameterMatches = bodyComponent.text.match(/\{\{(\d+)\}\}/g);
    if (parameterMatches) {
      parameterMatches.forEach((match) => {
        const paramNumber = match.replace(/[{}]/g, "");
        if (!requiredParameters.includes(paramNumber)) {
          requiredParameters.push(paramNumber);
        }
      });
    }
  }

  // Validate that all required parameters are provided
  if (requiredParameters.length > 0) {
    if (!parameters || Object.keys(parameters).length === 0) {
      throw new AppError(
        `Template requires parameter mappings for placeholders: ${requiredParameters
          .map((p) => `{{${p}}}`)
          .join(", ")}`,
        400
      );
    }

    const missingParameters = requiredParameters.filter(
      (param) => !parameters[param]
    );
    if (missingParameters.length > 0) {
      throw new AppError(
        `Missing parameter mappings for placeholders: ${missingParameters
          .map((p) => `{{${p}}}`)
          .join(", ")}. Required parameters: ${requiredParameters
          .map((p) => `{{${p}}}`)
          .join(", ")}`,
        400
      );
    }

    // Validate that no extra parameters are provided
    const extraParameters = Object.keys(parameters).filter(
      (param) => !requiredParameters.includes(param)
    );
    if (extraParameters.length > 0) {
      throw new AppError(
        `Invalid parameter mappings provided: ${extraParameters
          .map((p) => `{{${p}}}`)
          .join(", ")}. Template only has parameters: ${requiredParameters
          .map((p) => `{{${p}}}`)
          .join(", ")}`,
        400
      );
    }
  }

  // Check for interactive buttons
  const buttonComponent = components?.find((comp) => comp.type === "BUTTONS");
  const hasInteractiveButtons = !!(buttonComponent && buttonComponent.buttons);
  let detectedButtons = [];

  if (hasInteractiveButtons) {
    detectedButtons = buttonComponent.buttons.map((button) => ({
      text: button.text,
      type: button.type,
    }));
  }

  // Validate button mappings if template has interactive buttons
  if (hasInteractiveButtons && !is_auto_reply_template) {
    if (Object.keys(button_mappings).length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Template has interactive buttons and requires button mappings",
        data: {
          detected_buttons: detectedButtons,
          requires_button_mappings: true,
          available_auto_reply_templates:
            await Template.findAutoReplyTemplatesForButtons(
              template.organization_id
            ),
        },
      });
    }

    // Validate that button mappings match detected buttons exactly
    const detectedButtonTexts = detectedButtons.map((btn) => btn.text);
    const providedButtonTexts = Object.keys(button_mappings);

    const missingButtons = detectedButtonTexts.filter(
      (btnText) => !providedButtonTexts.includes(btnText)
    );
    const extraButtons = providedButtonTexts.filter(
      (btnText) => !detectedButtonTexts.includes(btnText)
    );

    if (missingButtons.length > 0 || extraButtons.length > 0) {
      let errorMessage = "Button mapping validation failed. ";
      if (missingButtons.length > 0) {
        errorMessage += `Missing mappings for buttons: [${missingButtons.join(
          ", "
        )}]. `;
      }
      if (extraButtons.length > 0) {
        errorMessage += `Invalid button mappings provided: [${extraButtons.join(
          ", "
        )}]. `;
      }
      errorMessage += `Template buttons are: [${detectedButtonTexts.join(
        ", "
      )}]`;

      throw new AppError(errorMessage, 400);
    }

    // Validate that all mapped template IDs exist and are auto-reply templates
    const mappedTemplateIds = Object.values(button_mappings);
    for (const mappedTemplateId of mappedTemplateIds) {
      const mappedTemplate = await Template.findById(mappedTemplateId);
      if (!mappedTemplate) {
        throw new AppError(
          `Mapped template ${mappedTemplateId} not found`,
          400
        );
      }
      if (!mappedTemplate.is_auto_reply_template) {
        throw new AppError(
          `Template ${mappedTemplate.name} is not marked as auto-reply template`,
          400
        );
      }
      if (mappedTemplate.organization_id !== template.organization_id) {
        throw new AppError(
          `Template ${mappedTemplate.name} belongs to different organization`,
          400
        );
      }
    }
  }

  const finalIsAutoReply = is_auto_reply_template;
  const finalButtonMappings =
    hasInteractiveButtons && !is_auto_reply_template ? button_mappings : {};

  const updatedTemplate = await Template.adminApproveTemplate(
    templateId,
    req.user.id,
    parameters || {},
    finalIsAutoReply,
    finalButtonMappings
  );

  logger.info("Template admin approved", {
    templateId,
    templateName: template.name,
    adminApprovedBy: req.user.id,
    parameters: parameters || {},
    isAutoReplyTemplate: finalIsAutoReply,
    hasInteractiveButtons,
    buttonMappings: finalButtonMappings,
    requiredParameters,
    detectedButtons,
  });

  res.json({
    success: true,
    message: "Template admin approved successfully",
    data: {
      template: Template.parseTemplate(updatedTemplate),
      has_interactive_buttons: hasInteractiveButtons,
      detected_buttons: detectedButtons,
      required_parameters: requiredParameters,
    },
  });
});

// Admin reject template for campaign usage
const adminRejectTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { rejection_reason } = req.body;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can admin reject templates",
      403
    );
  }

  if (!rejection_reason || rejection_reason.trim().length === 0) {
    throw new AppError("Rejection reason is required", 400);
  }

  const template = await Template.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  if (template.status !== "approved") {
    throw new AppError("Only approved templates can be admin rejected", 400);
  }

  if (template.approved_by_admin === "rejected") {
    throw new AppError("Template is already admin rejected", 400);
  }

  const updatedTemplate = await Template.adminRejectTemplate(
    templateId,
    req.user.id,
    rejection_reason
  );

  logger.info("Template admin rejected", {
    templateId,
    templateName: template.name,
    adminRejectedBy: req.user.id,
    rejectionReason: rejection_reason,
  });

  res.json({
    success: true,
    message: "Template admin rejected successfully",
    data: {
      template: Template.parseTemplate(updatedTemplate),
    },
  });
});

// Update template parameters
const updateTemplateParameters = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { parameters } = req.body;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can update template parameters",
      403
    );
  }

  const template = await Template.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  if (template.status !== "approved") {
    throw new AppError(
      "Only approved templates can have parameters updated",
      400
    );
  }

  // Validate parameters
  if (!parameters || typeof parameters !== "object") {
    throw new AppError("Parameters must be a valid object", 400);
  }

  const updatedTemplate = await Template.updateTemplateParameters(
    templateId,
    parameters
  );

  logger.info("Template parameters updated", {
    templateId,
    templateName: template.name,
    updatedBy: req.user.id,
    parameters,
  });

  res.json({
    success: true,
    message: "Template parameters updated successfully",
    data: {
      template: Template.parseTemplate(updatedTemplate),
    },
  });
});

// Get all templates with role-based filtering
const getAllTemplates = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    category,
    language,
    whatsapp_status,
  } = req.query;
  const offset = (page - 1) * limit;

  const filters = {
    limit: parseInt(limit),
    offset: parseInt(offset),
  };

  if (status) filters.status = status;
  if (category) filters.category = category;
  if (language) filters.language = language;
  if (whatsapp_status) filters.whatsapp_status = whatsapp_status;

  let templates, total;

  try {
    // Role-based filtering
    if (["super_admin", "system_admin"].includes(req.user.role)) {
      // Super admin and system admin can see all templates
      templates = await Template.findAll(filters);
      total = await Template.count();
    } else {
      // Organization admin and user can only see their organization's templates
      templates = await Template.findByOrganization(
        req.user.organization_id,
        filters
      );
      total = await Template.count({
        organization_id: req.user.organization_id,
      });
    }

    res.json({
      success: true,
      data: {
        templates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    throw new AppError(`Error fetching templates: ${error.message}`, 500);
  }
});

// Get auto reply templates for organization
const getAutoReplyTemplates = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  if (
    req.user.role === "organization_user" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const templates = await Template.findAutoReplyTemplates(organizationId);

  res.json({
    success: true,
    data: {
      templates,
    },
  });
});

// Update auto reply template status
const updateAutoReplyStatus = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { is_auto_reply_template } = req.body;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can update auto reply status",
      403
    );
  }

  if (typeof is_auto_reply_template !== "boolean") {
    throw new AppError("is_auto_reply_template must be a boolean", 400);
  }

  const template = await Template.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  const updatedTemplate = await Template.updateAutoReplyStatus(
    templateId,
    is_auto_reply_template
  );

  logger.info("Template auto reply status updated", {
    templateId,
    templateName: template.name,
    updatedBy: req.user.id,
    isAutoReplyTemplate: is_auto_reply_template,
  });

  res.json({
    success: true,
    message: "Auto reply status updated successfully",
    data: {
      template: Template.parseTemplate(updatedTemplate),
    },
  });
});

// Get template details for admin approval (including button analysis)
const getTemplateForAdminApproval = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  if (!["super_admin", "system_admin"].includes(req.user.role)) {
    throw new AppError(
      "Only super admin and system admin can access admin approval details",
      403
    );
  }

  const template = await Template.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  const components =
    typeof template.components === "string"
      ? JSON.parse(template.components)
      : template.components;

  const hasInteractiveButtons = Template.hasInteractiveButtons(components);
  const detectedButtons = Template.detectInteractiveButtons(components);
  const availableAutoReplyTemplates =
    await Template.findAutoReplyTemplatesForButtons(template.organization_id);

  res.json({
    success: true,
    data: {
      template: Template.parseTemplate(template),
      has_interactive_buttons: hasInteractiveButtons,
      detected_buttons: detectedButtons,
      available_auto_reply_templates: availableAutoReplyTemplates,
      requires_button_mappings:
        hasInteractiveButtons && !template.is_auto_reply_template,
    },
  });
});

module.exports = {
  getAllTemplates,
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  submitForApproval,
  getPendingApprovalTemplates,
  approveTemplate,
  rejectTemplate,
  syncTemplatesFromWhatsApp,
  getPendingAdminApprovalTemplates,
  adminApproveTemplate,
  adminRejectTemplate,
  updateTemplateParameters,
  getAutoReplyTemplates,
  updateAutoReplyStatus,
  getTemplateForAdminApproval,
};
