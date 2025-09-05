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
};
