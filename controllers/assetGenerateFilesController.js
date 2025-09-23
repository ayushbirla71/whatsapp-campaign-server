const AssetGenerateFiles = require("../models/AssetGenerateFiles");
const Template = require("../models/Template");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Get asset files for a template
const getAssetFilesByTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { include_inactive = false } = req.query;

  // Check if template exists and user has access
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

  const activeOnly = include_inactive !== "true";
  const assetFiles = await AssetGenerateFiles.findByTemplateId(
    templateId,
    activeOnly
  );

  res.json({
    success: true,
    data: {
      asset_files: assetFiles,
      template: {
        id: template.id,
        name: template.name,
        category: template.category,
      },
    },
  });
});

// Get asset files for an organization
const getAssetFilesByOrganization = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { page = 1, limit = 10, is_active, template_id, search } = req.query;
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

  if (is_active !== undefined) filters.is_active = is_active === "true";
  if (template_id) filters.template_id = template_id;
  if (search) filters.search = search;

  const assetFiles = await AssetGenerateFiles.getAssetFilesByOrganization(
    organizationId,
    filters
  );
  const stats = await AssetGenerateFiles.getAssetFileStats(organizationId);

  res.json({
    success: true,
    data: {
      asset_files: assetFiles,
      statistics: stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: stats.total_files,
        pages: Math.ceil(stats.total_files / limit),
      },
    },
  });
});

// Create asset file
const createAssetFile = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const assetFileData = req.body;

  // Check if template exists and user has access
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
    throw new AppError("Organization users cannot create asset files", 403);
  }

  // Validate asset file data
  const validationErrors = await AssetGenerateFiles.validateAssetFileData({
    ...assetFileData,
    template_id: templateId,
  });

  if (validationErrors.length > 0) {
    throw new AppError(
      `Validation failed: ${validationErrors.join(", ")}`,
      400
    );
  }

  const newAssetFileData = {
    ...assetFileData,
    template_id: templateId,
    created_by: req.user.id,
  };

  const newAssetFile = await AssetGenerateFiles.createAssetFile(
    newAssetFileData
  );

  await Template.update(templateId, { is_asset_generation_file: true });

  logger.info("Asset file created successfully", {
    assetFileId: newAssetFile.id,
    fileName: newAssetFile.file_name,
    templateId,
    createdBy: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: "Asset file created successfully",
    data: {
      asset_file: newAssetFile,
    },
  });
});

// Update asset file
const updateAssetFile = asyncHandler(async (req, res) => {
  const { assetFileId } = req.params;
  const updateData = req.body;

  const assetFile = await AssetGenerateFiles.findById(assetFileId);
  if (!assetFile) {
    throw new AppError("Asset file not found", 404);
  }

  // Get template to check organization access
  const template = await Template.findById(assetFile.template_id);
  if (!template) {
    throw new AppError("Associated template not found", 404);
  }

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== template.organization_id
  ) {
    throw new AppError("Access denied to this asset file", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError("Organization users cannot update asset files", 403);
  }

  // Validate update data if file_content is being updated
  if (updateData.file_content) {
    const validationErrors = await AssetGenerateFiles.validateAssetFileData({
      template_id: assetFile.template_id,
      file_name: assetFile.file_name,
      file_content: updateData.file_content,
    });

    if (validationErrors.length > 0) {
      throw new AppError(
        `Validation failed: ${validationErrors.join(", ")}`,
        400
      );
    }
  }

  const updatedAssetFile = await AssetGenerateFiles.updateAssetFile(
    assetFileId,
    updateData
  );

  logger.info("Asset file updated successfully", {
    assetFileId,
    fileName: assetFile.file_name,
    updatedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Asset file updated successfully",
    data: {
      asset_file: updatedAssetFile,
    },
  });
});

// Create new version of asset file
const createAssetFileVersion = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { file_name, file_content, description, typeOfContent } = req.body;

  // Check if template exists and user has access
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
      "Organization users cannot create asset file versions",
      403
    );
  }

  // Validate required fields
  if (!file_name || !file_content || !typeOfContent) {
    throw new AppError(
      "File name, content, and typeOfContent are required",
      400
    );
  }

  const newVersion = await AssetGenerateFiles.createVersionedAssetFile(
    templateId,
    file_name,
    file_content,
    description,
    typeOfContent,
    req.user.id
  );

  logger.info("Asset file version created successfully", {
    assetFileId: newVersion.id,
    fileName: file_name,
    version: newVersion.version,
    templateId,
    createdBy: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: "Asset file version created successfully",
    data: {
      asset_file: newVersion,
    },
  });
});

// Get file versions
const getFileVersions = asyncHandler(async (req, res) => {
  const { templateId, fileName } = req.params;

  // Check if template exists and user has access
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

  const versions = await AssetGenerateFiles.getFileVersions(
    templateId,
    fileName
  );

  res.json({
    success: true,
    data: {
      versions,
      template: {
        id: template.id,
        name: template.name,
      },
      file_name: fileName,
    },
  });
});

// Deactivate asset file
const deactivateAssetFile = asyncHandler(async (req, res) => {
  const { assetFileId } = req.params;

  const assetFile = await AssetGenerateFiles.findById(assetFileId);
  if (!assetFile) {
    throw new AppError("Asset file not found", 404);
  }

  // Get template to check organization access
  const template = await Template.findById(assetFile.template_id);
  if (!template) {
    throw new AppError("Associated template not found", 404);
  }

  // Check organization access
  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== template.organization_id
  ) {
    throw new AppError("Access denied to this asset file", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError("Organization users cannot deactivate asset files", 403);
  }

  const deactivatedAssetFile = await AssetGenerateFiles.deactivateAssetFile(
    assetFileId
  );
  await Template.update(template.id, { is_asset_generation_file: false });

  logger.info("Asset file deactivated successfully", {
    assetFileId,
    fileName: assetFile.file_name,
    deactivatedBy: req.user.id,
  });

  res.json({
    success: true,
    message: "Asset file deactivated successfully",
    data: {
      asset_file: deactivatedAssetFile,
    },
  });
});

// Get asset files by content type
const getAssetFilesByContentType = asyncHandler(async (req, res) => {
  const { organizationId, contentType } = req.params;
  const { page = 1, limit = 10, is_active, template_id } = req.query;
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

  // Validate content type
  if (!["public", "personalized"].includes(contentType)) {
    throw new AppError(
      'Invalid content type. Must be "public" or "personalized"',
      400
    );
  }

  const filters = {
    organization_id: organizationId,
    limit: parseInt(limit),
    offset: parseInt(offset),
  };

  if (is_active !== undefined) filters.is_active = is_active === "true";
  if (template_id) filters.template_id = template_id;

  const AssetGenerateFile = require("../models/AssetGenerateFile");
  const assetFiles = await AssetGenerateFile.findByContentType(
    contentType,
    filters
  );
  const stats = await AssetGenerateFile.getContentTypeStatistics(
    organizationId
  );

  res.json({
    success: true,
    data: {
      asset_files: assetFiles,
      content_type: contentType,
      statistics: stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: assetFiles.length,
        pages: Math.ceil(assetFiles.length / limit),
      },
    },
  });
});

module.exports = {
  getAssetFilesByTemplate,
  getAssetFilesByOrganization,
  createAssetFile,
  updateAssetFile,
  createAssetFileVersion,
  getFileVersions,
  deactivateAssetFile,
  getAssetFilesByContentType,
};
