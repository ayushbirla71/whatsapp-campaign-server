const express = require('express');
const router = express.Router();

const assetGenerateFilesController = require('../controllers/assetGenerateFilesController');
const { authenticate, authorize, authorizeOrganization } = require('../middleware/auth');
const { 
  validateAssetFileCreation,
  validateAssetFileUpdate,
  validateAssetFileVersion,
  validateUUID,
  validatePagination 
} = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// Organization-specific asset files routes
// Get asset files for an organization
router.get('/organization/:organizationId', 
  authorize('super_admin', 'system_admin', 'organization_admin', 'organization_user'),
  validateUUID('organizationId'),
  validatePagination,
  authorizeOrganization,
  assetGenerateFilesController.getAssetFilesByOrganization
);

// Template-specific asset files routes
// Get asset files for a template
router.get('/template/:templateId', 
  authorize('super_admin', 'system_admin', 'organization_admin', 'organization_user'),
  validateUUID('templateId'),
  assetGenerateFilesController.getAssetFilesByTemplate
);

// Create asset file for a template
router.post('/template/:templateId', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('templateId'),
  validateAssetFileCreation,
  assetGenerateFilesController.createAssetFile
);

// Create new version of asset file
router.post('/template/:templateId/version', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('templateId'),
  validateAssetFileVersion,
  assetGenerateFilesController.createAssetFileVersion
);

// Get file versions
router.get('/template/:templateId/versions/:fileName', 
  authorize('super_admin', 'system_admin', 'organization_admin', 'organization_user'),
  validateUUID('templateId'),
  assetGenerateFilesController.getFileVersions
);

// Asset file-specific routes
// Update asset file
router.put('/:assetFileId', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('assetFileId'),
  validateAssetFileUpdate,
  assetGenerateFilesController.updateAssetFile
);

// Deactivate asset file
router.delete('/:assetFileId', 
  authorize('super_admin', 'system_admin', 'organization_admin'),
  validateUUID('assetFileId'),
  assetGenerateFilesController.deactivateAssetFile
);

module.exports = router;
