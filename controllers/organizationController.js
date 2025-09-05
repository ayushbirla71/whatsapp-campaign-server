const Organization = require('../models/Organization');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Get all organizations
const getOrganizations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const offset = (page - 1) * limit;

  let conditions = {};
  if (status) conditions.status = status;

  // Organization admin can only see their own organization
  if (req.user.role === 'organization_admin') {
    conditions.id = req.user.organization_id;
  }

  const organizations = await Organization.findAll(conditions, limit, offset);
  const total = await Organization.count(conditions);

  res.json({
    success: true,
    data: {
      organizations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get organization by ID
const getOrganizationById = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  // Check permissions
  if (req.user.role === 'organization_admin' && req.user.organization_id !== organizationId) {
    throw new AppError('Access denied to this organization', 403);
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  res.json({
    success: true,
    data: {
      organization
    }
  });
});

// Create new organization
const createOrganization = asyncHandler(async (req, res) => {
  const { 
    name, 
    description, 
    whatsapp_business_account_id, 
    whatsapp_access_token, 
    whatsapp_phone_number_id 
  } = req.body;

  // Check if organization name already exists
  const existingOrg = await Organization.findByName(name);
  if (existingOrg) {
    throw new AppError('Organization with this name already exists', 409);
  }

  const organizationData = {
    name,
    description,
    whatsapp_business_account_id,
    whatsapp_access_token,
    whatsapp_phone_number_id,
    created_by: req.user.id
  };

  const newOrganization = await Organization.create(organizationData);

  logger.info('Organization created successfully', {
    organizationId: newOrganization.id,
    organizationName: newOrganization.name,
    createdBy: req.user.id,
    createdByEmail: req.user.email
  });

  res.status(201).json({
    success: true,
    message: 'Organization created successfully',
    data: {
      organization: newOrganization
    }
  });
});

// Update organization
const updateOrganization = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const updateData = req.body;

  // Check permissions
  if (req.user.role === 'organization_admin' && req.user.organization_id !== organizationId) {
    throw new AppError('Access denied to this organization', 403);
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  // Check if new name conflicts with existing organization
  if (updateData.name && updateData.name !== organization.name) {
    const existingOrg = await Organization.findByName(updateData.name);
    if (existingOrg) {
      throw new AppError('Organization with this name already exists', 409);
    }
  }

  // Remove fields that shouldn't be updated directly
  delete updateData.created_by;
  delete updateData.created_at;

  const updatedOrganization = await Organization.update(organizationId, updateData);

  logger.info('Organization updated successfully', {
    organizationId,
    updatedBy: req.user.id,
    updatedByEmail: req.user.email,
    changes: updateData
  });

  res.json({
    success: true,
    message: 'Organization updated successfully',
    data: {
      organization: updatedOrganization
    }
  });
});

// Delete organization
const deleteOrganization = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  // Check if organization has users
  const users = await User.findByOrganization(organizationId);
  if (users.length > 0) {
    throw new AppError('Cannot delete organization with existing users', 400);
  }

  await Organization.delete(organizationId);

  logger.info('Organization deleted successfully', {
    organizationId,
    organizationName: organization.name,
    deletedBy: req.user.id,
    deletedByEmail: req.user.email
  });

  res.json({
    success: true,
    message: 'Organization deleted successfully'
  });
});

// Get organization users
const getOrganizationUsers = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { role } = req.query;

  // Check permissions
  if (req.user.role === 'organization_admin' && req.user.organization_id !== organizationId) {
    throw new AppError('Access denied to this organization', 403);
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  const users = await User.findByOrganization(organizationId, role);
  const sanitizedUsers = users.map(user => User.sanitizeUser(user));

  res.json({
    success: true,
    data: {
      users: sanitizedUsers
    }
  });
});

// Update WhatsApp Business configuration
const updateWhatsAppConfig = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { whatsapp_business_account_id, whatsapp_access_token, whatsapp_phone_number_id } = req.body;

  // Check permissions
  if (req.user.role === 'organization_admin' && req.user.organization_id !== organizationId) {
    throw new AppError('Access denied to this organization', 403);
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  const whatsappConfig = {
    whatsapp_business_account_id,
    whatsapp_access_token,
    whatsapp_phone_number_id
  };

  await Organization.updateWhatsAppConfig(organizationId, whatsappConfig);

  logger.info('WhatsApp configuration updated', {
    organizationId,
    updatedBy: req.user.id,
    updatedByEmail: req.user.email
  });

  res.json({
    success: true,
    message: 'WhatsApp configuration updated successfully'
  });
});

// Get WhatsApp Business configuration (for authorized users only)
const getWhatsAppConfig = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  // Check permissions
  if (req.user.role === 'organization_admin' && req.user.organization_id !== organizationId) {
    throw new AppError('Access denied to this organization', 403);
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  const config = await Organization.getWhatsAppConfig(organizationId);

  res.json({
    success: true,
    data: {
      whatsapp_config: config
    }
  });
});

module.exports = {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationUsers,
  updateWhatsAppConfig,
  getWhatsAppConfig
};
