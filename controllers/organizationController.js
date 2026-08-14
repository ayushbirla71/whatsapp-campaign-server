// const Organization = require("../models/Organization");
// const User = require("../models/User");
// const { AppError, asyncHandler } = require("../middleware/errorHandler");
// const logger = require("../utils/logger");

// // Get all organizations
// const getOrganizations = asyncHandler(async (req, res) => {
//   const { page = 1, limit = 10, status } = req.query;
//   const offset = (page - 1) * limit;

//   let conditions = {};
//   if (status) conditions.status = status;

//   // Organization admin can only see their own organization
//   if (req.user.role === "organization_admin") {
//     conditions.id = req.user.organization_id;
//   }

//   const organizations = await Organization.findAll(conditions, limit, offset);
//   const total = await Organization.count(conditions);

//   res.json({
//     success: true,
//     data: {
//       organizations,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit),
//       },
//     },
//   });
// });

// // Get organization by ID
// const getOrganizationById = asyncHandler(async (req, res) => {
//   const { organizationId } = req.params;

//   // Check permissions
//   if (
//     req.user.role === "organization_admin" &&
//     req.user.organization_id !== organizationId
//   ) {
//     throw new AppError("Access denied to this organization", 403);
//   }

//   const organization = await Organization.findById(organizationId);
//   if (!organization) {
//     throw new AppError("Organization not found", 404);
//   }

//   res.json({
//     success: true,
//     data: {
//       organization,
//     },
//   });
// });

// // Create new organization
// const createOrganization = asyncHandler(async (req, res) => {
//   const {
//     name,
//     description,
//     whatsapp_business_account_id,
//     whatsapp_access_token,
//     whatsapp_phone_number_id,
//     whatsapp_webhook_verify_token,
//     whatsapp_webhook_url,
//     whatsapp_app_id,
//     whatsapp_app_secret,
//   } = req.body;

//   // Check if organization name already exists
//   const existingOrg = await Organization.findByName(name);
//   if (existingOrg) {
//     throw new AppError("Organization with this name already exists", 409);
//   }

//   const organizationData = {
//     name,
//     description,
//     whatsapp_business_account_id,
//     whatsapp_access_token,
//     whatsapp_phone_number_id,
//     whatsapp_webhook_verify_token,
//     whatsapp_webhook_url,
//     whatsapp_app_id,
//     whatsapp_app_secret,
//     created_by: req.user.id,
//   };

//   const newOrganization = await Organization.create(organizationData);

//   logger.info("Organization created successfully", {
//     organizationId: newOrganization.id,
//     organizationName: newOrganization.name,
//     createdBy: req.user.id,
//     createdByEmail: req.user.email,
//   });

//   res.status(201).json({
//     success: true,
//     message: "Organization created successfully",
//     data: {
//       organization: newOrganization,
//     },
//   });
// });

// // Update organization
// const updateOrganization = asyncHandler(async (req, res) => {
//   const { organizationId } = req.params;
//   const updateData = req.body;

//   // Check permissions
//   if (
//     req.user.role === "organization_admin" &&
//     req.user.organization_id !== organizationId
//   ) {
//     throw new AppError("Access denied to this organization", 403);
//   }

//   const organization = await Organization.findById(organizationId);
//   if (!organization) {
//     throw new AppError("Organization not found", 404);
//   }

//   // Check if new name conflicts with existing organization
//   if (updateData.name && updateData.name !== organization.name) {
//     const existingOrg = await Organization.findByName(updateData.name);
//     if (existingOrg) {
//       throw new AppError("Organization with this name already exists", 409);
//     }
//   }

//   // Remove fields that shouldn't be updated directly
//   delete updateData.created_by;
//   delete updateData.created_at;

//   const updatedOrganization = await Organization.update(
//     organizationId,
//     updateData
//   );

//   logger.info("Organization updated successfully", {
//     organizationId,
//     updatedBy: req.user.id,
//     updatedByEmail: req.user.email,
//     changes: updateData,
//   });

//   res.json({
//     success: true,
//     message: "Organization updated successfully",
//     data: {
//       organization: updatedOrganization,
//     },
//   });
// });

// // Delete organization
// const deleteOrganization = asyncHandler(async (req, res) => {
//   const { organizationId } = req.params;

//   const organization = await Organization.findById(organizationId);
//   if (!organization) {
//     throw new AppError("Organization not found", 404);
//   }

//   // Check if organization has users
//   const users = await User.findByOrganization(organizationId);
//   if (users.length > 0) {
//     throw new AppError("Cannot delete organization with existing users", 400);
//   }

//   await Organization.delete(organizationId);

//   logger.info("Organization deleted successfully", {
//     organizationId,
//     organizationName: organization.name,
//     deletedBy: req.user.id,
//     deletedByEmail: req.user.email,
//   });

//   res.json({
//     success: true,
//     message: "Organization deleted successfully",
//   });
// });

// // Get organization users
// const getOrganizationUsers = asyncHandler(async (req, res) => {
//   const { organizationId } = req.params;
//   const { role } = req.query;

//   // Check permissions
//   if (
//     req.user.role === "organization_admin" &&
//     req.user.organization_id !== organizationId
//   ) {
//     throw new AppError("Access denied to this organization", 403);
//   }

//   const organization = await Organization.findById(organizationId);
//   if (!organization) {
//     throw new AppError("Organization not found", 404);
//   }

//   const users = await User.findByOrganization(organizationId, role);
//   const sanitizedUsers = users.map((user) => User.sanitizeUser(user));

//   res.json({
//     success: true,
//     data: {
//       users: sanitizedUsers,
//     },
//   });
// });

// // Update WhatsApp Business configuration
// const updateWhatsAppConfig = asyncHandler(async (req, res) => {
//   const { organizationId } = req.params;
//   const {
//     whatsapp_business_account_id,
//     whatsapp_access_token,
//     whatsapp_phone_number_id,
//   } = req.body;

//   // Check permissions
//   if (
//     req.user.role === "organization_admin" &&
//     req.user.organization_id !== organizationId
//   ) {
//     throw new AppError("Access denied to this organization", 403);
//   }

//   const organization = await Organization.findById(organizationId);
//   if (!organization) {
//     throw new AppError("Organization not found", 404);
//   }

//   const whatsappConfig = {
//     whatsapp_business_account_id,
//     whatsapp_access_token,
//     whatsapp_phone_number_id,
//   };

//   await Organization.updateWhatsAppConfig(organizationId, whatsappConfig);

//   logger.info("WhatsApp configuration updated", {
//     organizationId,
//     updatedBy: req.user.id,
//     updatedByEmail: req.user.email,
//   });

//   res.json({
//     success: true,
//     message: "WhatsApp configuration updated successfully",
//   });
// });

// // Get WhatsApp Business configuration (for authorized users only)
// const getWhatsAppConfig = asyncHandler(async (req, res) => {
//   const { organizationId } = req.params;

//   // Check permissions
//   if (
//     req.user.role === "organization_admin" &&
//     req.user.organization_id !== organizationId
//   ) {
//     throw new AppError("Access denied to this organization", 403);
//   }

//   const organization = await Organization.findById(organizationId);
//   if (!organization) {
//     throw new AppError("Organization not found", 404);
//   }

//   const config = await Organization.getWhatsAppConfig(organizationId);

//   res.json({
//     success: true,
//     data: {
//       whatsapp_config: config,
//     },
//   });
// });

// module.exports = {
//   getOrganizations,
//   getOrganizationById,
//   createOrganization,
//   updateOrganization,
//   deleteOrganization,
//   getOrganizationUsers,
//   updateWhatsAppConfig,
//   getWhatsAppConfig,
// };


const Organization = require("../models/Organization");
const User = require("../models/User");
const whatsappApiService = require("../services/whatsappApiService");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Get all organizations
const getOrganizations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const offset = (page - 1) * limit;

  let conditions = {};
  if (status) conditions.status = status;

  // Organization admin can only see their own organization
  if (req.user.role === "organization_admin") {
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
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// Get organization by ID
const getOrganizationById = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  // Check permissions
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }

  res.json({
    success: true,
    data: {
      organization,
    },
  });
});

// Create new organization
const createOrganization = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    whatsapp_business_account_id,
    whatsapp_access_token,
    whatsapp_phone_number_id,
    whatsapp_webhook_verify_token,
    whatsapp_webhook_url,
    whatsapp_app_id,
    whatsapp_app_secret,
  } = req.body;

  // Check if organization name already exists
  const existingOrg = await Organization.findByName(name);
  if (existingOrg) {
    throw new AppError("Organization with this name already exists", 409);
  }

  const organizationData = {
    name,
    description,
    whatsapp_business_account_id,
    whatsapp_access_token,
    whatsapp_phone_number_id,
    whatsapp_webhook_verify_token,
    whatsapp_webhook_url,
    whatsapp_app_id,
    whatsapp_app_secret,
    created_by: req.user.id,
  };

  const newOrganization = await Organization.create(organizationData);

  logger.info("Organization created successfully", {
    organizationId: newOrganization.id,
    organizationName: newOrganization.name,
    createdBy: req.user.id,
    createdByEmail: req.user.email,
  });

  res.status(201).json({
    success: true,
    message: "Organization created successfully",
    data: {
      organization: newOrganization,
    },
  });
});

// Update organization
const updateOrganization = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const updateData = req.body;

  // Check permissions
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }

  // Check if new name conflicts with existing organization
  if (updateData.name && updateData.name !== organization.name) {
    const existingOrg = await Organization.findByName(updateData.name);
    if (existingOrg) {
      throw new AppError("Organization with this name already exists", 409);
    }
  }

  // Remove fields that shouldn't be updated directly
  delete updateData.created_by;
  delete updateData.created_at;

  const updatedOrganization = await Organization.update(
    organizationId,
    updateData
  );

  logger.info("Organization updated successfully", {
    organizationId,
    updatedBy: req.user.id,
    updatedByEmail: req.user.email,
    changes: updateData,
  });

  res.json({
    success: true,
    message: "Organization updated successfully",
    data: {
      organization: updatedOrganization,
    },
  });
});

// Delete organization
const deleteOrganization = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }

  // Check if organization has users
  const users = await User.findByOrganization(organizationId);
  if (users.length > 0) {
    throw new AppError("Cannot delete organization with existing users", 400);
  }

  await Organization.delete(organizationId);

  logger.info("Organization deleted successfully", {
    organizationId,
    organizationName: organization.name,
    deletedBy: req.user.id,
    deletedByEmail: req.user.email,
  });

  res.json({
    success: true,
    message: "Organization deleted successfully",
  });
});

// Get organization users
const getOrganizationUsers = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { role } = req.query;

  // Check permissions
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }

  const users = await User.findByOrganization(organizationId, role);
  const sanitizedUsers = users.map((user) => User.sanitizeUser(user));

  res.json({
    success: true,
    data: {
      users: sanitizedUsers,
    },
  });
});

// Update WhatsApp Business configuration
const updateWhatsAppConfig = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const {
    whatsapp_business_account_id,
    whatsapp_access_token,
    whatsapp_phone_number_id,
  } = req.body;

  // Check permissions
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }

  const whatsappConfig = {
    whatsapp_business_account_id,
    whatsapp_access_token,
    whatsapp_phone_number_id,
  };

  await Organization.updateWhatsAppConfig(organizationId, whatsappConfig);

  logger.info("WhatsApp configuration updated", {
    organizationId,
    updatedBy: req.user.id,
    updatedByEmail: req.user.email,
  });

  res.json({
    success: true,
    message: "WhatsApp configuration updated successfully",
  });
});

// Get WhatsApp Business configuration (for authorized users only)
const getWhatsAppConfig = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  // Check permissions
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }

  const config = await Organization.getWhatsAppConfig(organizationId);

  res.json({
    success: true,
    data: {
      whatsapp_config: config,
    },
  });
});

// Fetch live phone number health (quality rating, messaging tier, name
// status) from WhatsApp and persist it, so it shows up on the org dashboard
// without needing a fresh API call every page load.
const getWhatsAppHealth = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const config = await Organization.getWhatsAppConfig(organizationId);
  if (!config?.whatsapp_phone_number_id || !config?.whatsapp_access_token) {
    return res.json({
      success: true,
      data: {
        configured: false,
        health: null,
      },
    });
  }

  const health = await whatsappApiService.getPhoneNumberHealth(
    config.whatsapp_phone_number_id,
    config.whatsapp_access_token
  );

  // Persist so the dashboard has a last-known value even before the next
  // webhook/health check, and so campaign-processing's own health check
  // (checkPhoneNumberHealth in campaignProcessingService.js) has a record.
  await Organization.update(organizationId, {
    whatsapp_quality_rating: health.quality_rating || null,
    whatsapp_messaging_tier: health.messaging_limit_tier || null,
    whatsapp_name_status: health.name_status || null,
  });

  logger.info("Fetched WhatsApp phone number health", {
    organizationId,
    qualityRating: health.quality_rating,
    fetchedBy: req.user.id,
  });

  res.json({
    success: true,
    data: {
      configured: true,
      health,
    },
  });
});

// Get the WhatsApp Business Profile (about, description, address, etc.)
const getBusinessProfile = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const config = await Organization.getWhatsAppConfig(organizationId);
  if (!config?.whatsapp_phone_number_id || !config?.whatsapp_access_token) {
    throw new AppError(
      "WhatsApp Business API is not configured for this organization",
      400
    );
  }

  const profile = await whatsappApiService.getBusinessProfile(
    config.whatsapp_phone_number_id,
    config.whatsapp_access_token
  );

  res.json({
    success: true,
    data: { profile },
  });
});

// Update the WhatsApp Business Profile
const updateBusinessProfile = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { about, address, description, email, vertical, websites } = req.body;

  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  const config = await Organization.getWhatsAppConfig(organizationId);
  if (!config?.whatsapp_phone_number_id || !config?.whatsapp_access_token) {
    throw new AppError(
      "WhatsApp Business API is not configured for this organization",
      400
    );
  }

  const profileData = {};
  if (about !== undefined) profileData.about = about;
  if (address !== undefined) profileData.address = address;
  if (description !== undefined) profileData.description = description;
  if (email !== undefined) profileData.email = email;
  if (vertical !== undefined) profileData.vertical = vertical;
  if (websites !== undefined) profileData.websites = websites;

  await whatsappApiService.updateBusinessProfile(
    config.whatsapp_phone_number_id,
    profileData,
    config.whatsapp_access_token
  );

  logger.info("WhatsApp business profile updated", {
    organizationId,
    updatedBy: req.user.id,
    fields: Object.keys(profileData),
  });

  res.json({
    success: true,
    message: "Business profile updated successfully",
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
  getWhatsAppConfig,
  getWhatsAppHealth,
  getBusinessProfile,
  updateBusinessProfile,
};













