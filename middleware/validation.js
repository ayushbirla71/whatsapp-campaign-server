const { body, param, query, validationResult } = require("express-validator");

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// User validation rules
const validateUserRegistration = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  body("first_name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("First name is required and must be less than 100 characters"),
  body("last_name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Last name is required and must be less than 100 characters"),
  body("role")
    .isIn([
      "super_admin",
      "system_admin",
      "organization_admin",
      "organization_user",
    ])
    .withMessage("Invalid role specified"),
  body("organization_id")
    .optional()
    .isUUID()
    .withMessage("Organization ID must be a valid UUID"),
  handleValidationErrors,
];

const validateUserUpdate = [
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("first_name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("First name must be less than 100 characters"),
  body("last_name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Last name must be less than 100 characters"),
  body("role")
    .optional()
    .isIn([
      "super_admin",
      "system_admin",
      "organization_admin",
      "organization_user",
    ])
    .withMessage("Invalid role specified"),
  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be a boolean"),
  handleValidationErrors,
];

const validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

const validatePasswordChange = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  handleValidationErrors,
];

// Organization validation rules
const validateOrganizationCreation = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage(
      "Organization name is required and must be less than 255 characters"
    ),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  body("whatsapp_business_account_id")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp Business Account ID cannot be empty"),
  body("whatsapp_access_token")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp Access Token cannot be empty"),
  body("whatsapp_phone_number_id")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp Phone Number ID cannot be empty"),
  body("whatsapp_webhook_verify_token")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp Webhook Verify Token cannot be empty"),
  body("whatsapp_webhook_url")
    .optional()
    .trim()
    .isURL()
    .withMessage("WhatsApp Webhook URL must be a valid URL"),
  body("whatsapp_app_id")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp App ID cannot be empty"),
  body("whatsapp_app_secret")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp App Secret cannot be empty"),
  handleValidationErrors,
];

const validateOrganizationUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("Organization name must be less than 255 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  body("status")
    .optional()
    .isIn(["active", "inactive", "suspended"])
    .withMessage("Invalid status specified"),
  body("whatsapp_business_account_id")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp Business Account ID cannot be empty"),
  body("whatsapp_access_token")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp Access Token cannot be empty"),
  body("whatsapp_phone_number_id")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp Phone Number ID cannot be empty"),
  body("whatsapp_webhook_verify_token")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp Webhook Verify Token cannot be empty"),
  body("whatsapp_webhook_url")
    .optional()
    .trim()
    .isURL()
    .withMessage("WhatsApp Webhook URL must be a valid URL"),
  body("whatsapp_app_id")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp App ID cannot be empty"),
  body("whatsapp_app_secret")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp App Secret cannot be empty"),
  handleValidationErrors,
];

// UUID parameter validation
const validateUUID = (paramName) => [
  param(paramName).isUUID().withMessage(`${paramName} must be a valid UUID`),
  handleValidationErrors,
];

// Pagination validation
const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  handleValidationErrors,
];

// Template validation rules
const validateTemplateCreation = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage(
      "Template name is required and must be less than 255 characters"
    ),
  body("category")
    .isIn(["AUTHENTICATION", "MARKETING", "UTILITY"])
    .withMessage("Invalid template category"),
  body("language")
    .optional()
    .isIn([
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
    ])
    .withMessage("Invalid template language"),
  body("header_type")
    .optional()
    .isIn(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"])
    .withMessage("Invalid header type"),
  body("header_text")
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage("Header text must be less than 60 characters"),
  body("body_text")
    .trim()
    .isLength({ min: 1, max: 1024 })
    .withMessage("Body text is required and must be less than 1024 characters"),
  body("footer_text")
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage("Footer text must be less than 60 characters"),
  body("components")
    .optional()
    .isArray()
    .withMessage("Components must be an array"),
  handleValidationErrors,
];

const validateTemplateUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("Template name must be less than 255 characters"),
  body("category")
    .optional()
    .isIn(["AUTHENTICATION", "MARKETING", "UTILITY"])
    .withMessage("Invalid template category"),
  body("language")
    .optional()
    .isIn([
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
    ])
    .withMessage("Invalid template language"),
  body("header_type")
    .optional()
    .isIn(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"])
    .withMessage("Invalid header type"),
  body("header_text")
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage("Header text must be less than 60 characters"),
  body("body_text")
    .optional()
    .trim()
    .isLength({ min: 1, max: 1024 })
    .withMessage("Body text must be less than 1024 characters"),
  body("footer_text")
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage("Footer text must be less than 60 characters"),
  body("components")
    .optional()
    .isArray()
    .withMessage("Components must be an array"),
  handleValidationErrors,
];

const validateTemplateRejection = [
  body("rejection_reason")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage(
      "Rejection reason is required and must be less than 500 characters"
    ),
  handleValidationErrors,
];

// Campaign validation rules
const validateCampaignCreation = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage(
      "Campaign name is required and must be less than 255 characters"
    ),
  body("template_id").isUUID().withMessage("Valid template ID is required"),
  body("campaign_type")
    .optional()
    .isIn(["immediate", "scheduled", "recurring"])
    .withMessage("Invalid campaign type"),
  body("scheduled_at")
    .optional()
    .isISO8601()
    .withMessage("Scheduled date must be a valid ISO 8601 date"),
  body("buffer_hours")
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage("Buffer hours must be between 1 and 168 (7 days)"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  handleValidationErrors,
];

const validateCampaignUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("Campaign name must be less than 255 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  body("scheduled_at")
    .optional()
    .isISO8601()
    .withMessage("Scheduled date must be a valid ISO 8601 date"),
  body("buffer_hours")
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage("Buffer hours must be between 1 and 168 (7 days)"),
  handleValidationErrors,
];

const validateCampaignRejection = [
  body("rejection_reason")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage(
      "Rejection reason is required and must be less than 500 characters"
    ),
  handleValidationErrors,
];

// Audience validation rules
const validateAudienceCreation = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("Name is required and must be less than 255 characters"),
  body("msisdn")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Phone number is required"),
  body("country_code")
    .optional()
    .trim()
    .isLength({ min: 1, max: 5 })
    .withMessage("Country code must be less than 5 characters"),
  body("attributes")
    .optional()
    .isObject()
    .withMessage("Attributes must be an object"),
  handleValidationErrors,
];

const validateBulkAudience = [
  body("audience_list")
    .isArray({ min: 1 })
    .withMessage("Audience list is required and must be a non-empty array"),
  body("audience_list.*.name")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("Each audience member must have a name (max 255 characters)"),
  body("audience_list.*.msisdn")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Each audience member must have a phone number"),
  handleValidationErrors,
];

const validateMessageStatusUpdate = [
  body("message_status")
    .isIn(["pending", "sent", "delivered", "read", "failed"])
    .withMessage("Invalid message status"),
  body("whatsapp_message_id")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("WhatsApp message ID cannot be empty"),
  body("failure_reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Failure reason must be less than 500 characters"),
  handleValidationErrors,
];

const validateRemoveAudience = [
  body("msisdn")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Phone number (msisdn) is required"),
  handleValidationErrors,
];

// Asset Generation Files validation rules
const validateAssetFileCreation = [
  body("file_name")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("File name is required and must be less than 255 characters")
    .matches(/^[a-zA-Z_][a-zA-Z0-9_]*\.py$/)
    .withMessage(
      "File name must be a valid Python filename (e.g., asset_generator.py)"
    ),
  body("file_content")
    .trim()
    .isLength({ min: 1 })
    .withMessage("File content is required")
    .custom((value) => {
      if (!value.includes("def generate_asset(")) {
        throw new Error("File content must contain a generate_asset function");
      }
      return true;
    }),
  body("typeofcontent")
    .trim()
    .isIn(["public", "personalized"])
    .withMessage(
      "typeofcontent is required and must be either 'public' or 'personalized'"
    ),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  body("version")
    .optional()
    .trim()
    .matches(/^\d+\.\d+$/)
    .withMessage("Version must be in format X.Y (e.g., 1.0)"),
  handleValidationErrors,
];

const validateAssetFileUpdate = [
  body("file_content")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("File content cannot be empty")
    .custom((value) => {
      if (value && !value.includes("def generate_asset(")) {
        throw new Error("File content must contain a generate_asset function");
      }
      return true;
    }),
  body("typeofcontent")
    .optional()
    .trim()
    .isIn(["public", "personalized"])
    .withMessage("typeofcontent must be either 'public' or 'personalized'"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be a boolean"),
  handleValidationErrors,
];

const validateAssetFileVersion = [
  body("file_name")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("File name is required and must be less than 255 characters")
    .matches(/^[a-zA-Z_][a-zA-Z0-9_]*\.py$/)
    .withMessage("File name must be a valid Python filename"),
  body("file_content")
    .trim()
    .isLength({ min: 1 })
    .withMessage("File content is required")
    .custom((value) => {
      if (!value.includes("def generate_asset(")) {
        throw new Error("File content must contain a generate_asset function");
      }
      return true;
    }),
  body("typeofcontent")
    .trim()
    .isIn(["public", "personalized"])
    .withMessage(
      "typeofcontent is required and must be either 'public' or 'personalized'"
    ),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserUpdate,
  validateLogin,
  validatePasswordChange,
  validateOrganizationCreation,
  validateOrganizationUpdate,
  validateUUID,
  validatePagination,
  validateTemplateCreation,
  validateTemplateUpdate,
  validateTemplateRejection,
  validateCampaignCreation,
  validateCampaignUpdate,
  validateCampaignRejection,
  validateAudienceCreation,
  validateBulkAudience,
  validateMessageStatusUpdate,
  validateRemoveAudience,
  validateAssetFileCreation,
  validateAssetFileUpdate,
  validateAssetFileVersion,
};
