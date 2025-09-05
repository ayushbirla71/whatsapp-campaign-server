const express = require('express');
const router = express.Router();

const organizationController = require('../controllers/organizationController');
const { authenticate, authorize, authorizeOrganization } = require('../middleware/auth');
const { 
  validateOrganizationCreation, 
  validateOrganizationUpdate, 
  validateUUID,
  validatePagination,
  handleValidationErrors 
} = require('../middleware/validation');
const { body } = require('express-validator');

// All routes require authentication
router.use(authenticate);

// Get all organizations
router.get('/', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validatePagination,
  organizationController.getOrganizations
);

// Get organization by ID
router.get('/:organizationId', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('organizationId'),
  authorizeOrganization,
  organizationController.getOrganizationById
);

// Create new organization (only super admin and system admin)
router.post('/', 
  authorize('super_admin', 'system_admin'),
  validateOrganizationCreation,
  organizationController.createOrganization
);

// Update organization
router.put('/:organizationId', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('organizationId'),
  validateOrganizationUpdate,
  authorizeOrganization,
  organizationController.updateOrganization
);

// Delete organization (only super admin and system admin)
router.delete('/:organizationId', 
  authorize('super_admin', 'system_admin'),
  validateUUID('organizationId'),
  organizationController.deleteOrganization
);

// Get organization users
router.get('/:organizationId/users', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('organizationId'),
  authorizeOrganization,
  organizationController.getOrganizationUsers
);

// Update WhatsApp Business configuration
router.put('/:organizationId/whatsapp-config', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('organizationId'),
  [
    body('whatsapp_business_account_id')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('WhatsApp Business Account ID cannot be empty'),
    body('whatsapp_access_token')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('WhatsApp Access Token cannot be empty'),
    body('whatsapp_phone_number_id')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('WhatsApp Phone Number ID cannot be empty'),
    handleValidationErrors
  ],
  authorizeOrganization,
  organizationController.updateWhatsAppConfig
);

// Get WhatsApp Business configuration
router.get('/:organizationId/whatsapp-config', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('organizationId'),
  authorizeOrganization,
  organizationController.getWhatsAppConfig
);

module.exports = router;
