const BaseModel = require("./BaseModel");

class AssetGenerateFiles extends BaseModel {
  constructor() {
    super("asset_generate_files");
  }

  async findByTemplateId(templateId, activeOnly = true) {
    try {
      let query = `
        SELECT agf.*, t.name as template_name, t.category as template_category,
               u.first_name as created_by_name, u.last_name as created_by_lastname
        FROM asset_generate_files agf
        LEFT JOIN templates t ON agf.template_id = t.id
        LEFT JOIN users u ON agf.created_by = u.id
        WHERE agf.template_id = $1
      `;

      const values = [templateId];

      if (activeOnly) {
        query += ` AND agf.is_active = true`;
      }

      query += ` ORDER BY agf.created_at DESC`;

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw new Error(
        `Error finding asset files by template ID: ${error.message}`
      );
    }
  }

  async findActiveByTemplateAndFileName(templateId, fileName) {
    try {
      const query = `
        SELECT * FROM asset_generate_files 
        WHERE template_id = $1 AND file_name = $2 AND is_active = true
      `;
      const result = await this.pool.query(query, [templateId, fileName]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(
        `Error finding asset file by template and filename: ${error.message}`
      );
    }
  }

  async createAssetFile(assetFileData) {
    try {
      // Check for duplicate filename for the same template
      const existingFile = await this.findActiveByTemplateAndFileName(
        assetFileData.template_id,
        assetFileData.file_name
      );

      if (existingFile) {
        throw new Error(
          "Asset file with this name already exists for this template"
        );
      }

      return await super.create(assetFileData);
    } catch (error) {
      throw new Error(`Error creating asset file: ${error.message}`);
    }
  }

  async updateAssetFile(id, updateData) {
    try {
      // Don't allow updating template_id or file_name to prevent conflicts
      delete updateData.template_id;
      delete updateData.created_by;
      delete updateData.created_at;

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error updating asset file: ${error.message}`);
    }
  }

  async deactivateAssetFile(id) {
    try {
      return await this.update(id, { is_active: false });
    } catch (error) {
      throw new Error(`Error deactivating asset file: ${error.message}`);
    }
  }

  async getAssetFilesByOrganization(organizationId, filters = {}) {
    try {
      let query = `
        SELECT agf.*, t.name as template_name, t.category as template_category,
               o.name as organization_name,
               u.first_name as created_by_name, u.last_name as created_by_lastname
        FROM asset_generate_files agf
        LEFT JOIN templates t ON agf.template_id = t.id
        LEFT JOIN organizations o ON t.organization_id = o.id
        LEFT JOIN users u ON agf.created_by = u.id
        WHERE t.organization_id = $1
      `;

      const values = [organizationId];
      let paramCount = 1;

      // Apply filters
      if (filters.is_active !== undefined) {
        paramCount++;
        query += ` AND agf.is_active = $${paramCount}`;
        values.push(filters.is_active);
      }

      if (filters.template_id) {
        paramCount++;
        query += ` AND agf.template_id = $${paramCount}`;
        values.push(filters.template_id);
      }

      if (filters.search) {
        paramCount++;
        query += ` AND (agf.file_name ILIKE $${paramCount} OR agf.description ILIKE $${paramCount})`;
        values.push(`%${filters.search}%`);
      }

      query += ` ORDER BY agf.created_at DESC`;

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
      return result.rows;
    } catch (error) {
      throw new Error(
        `Error finding asset files by organization: ${error.message}`
      );
    }
  }

  async createVersionedAssetFile(
    templateId,
    fileName,
    fileContent,
    description,
    typeOfContent,
    createdBy
  ) {
    try {
      // Find existing file to determine next version
      const existingFiles = await this.pool.query(
        `SELECT version FROM asset_generate_files
         WHERE template_id = $1 AND file_name = $2
         ORDER BY version DESC LIMIT 1`,
        [templateId, fileName]
      );

      let nextVersion = "1.0";
      if (existingFiles.rows.length > 0) {
        const currentVersion = existingFiles.rows[0].version;
        const versionParts = currentVersion.split(".");
        const majorVersion = parseInt(versionParts[0]);
        const minorVersion = parseInt(versionParts[1] || 0);
        nextVersion = `${majorVersion}.${minorVersion + 1}`;
      }

      // Deactivate previous versions
      await this.pool.query(
        `UPDATE asset_generate_files
         SET is_active = false
         WHERE template_id = $1 AND file_name = $2`,
        [templateId, fileName]
      );

      // Create new version
      const newAssetFile = {
        template_id: templateId,
        file_name: fileName,
        file_content: fileContent,
        description: description,
        typeOfContent: typeOfContent,
        version: nextVersion,
        is_active: true,
        created_by: createdBy,
      };

      return await super.create(newAssetFile);
    } catch (error) {
      throw new Error(`Error creating versioned asset file: ${error.message}`);
    }
  }

  async getFileVersions(templateId, fileName) {
    try {
      const query = `
        SELECT agf.*, u.first_name as created_by_name, u.last_name as created_by_lastname
        FROM asset_generate_files agf
        LEFT JOIN users u ON agf.created_by = u.id
        WHERE agf.template_id = $1 AND agf.file_name = $2
        ORDER BY agf.version DESC
      `;

      const result = await this.pool.query(query, [templateId, fileName]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting file versions: ${error.message}`);
    }
  }

  async validateAssetFileData(assetFileData) {
    const errors = [];

    if (!assetFileData.template_id) {
      errors.push("Template ID is required");
    }

    if (
      !assetFileData.file_name ||
      assetFileData.file_name.trim().length === 0
    ) {
      errors.push("File name is required");
    }

    if (
      !assetFileData.file_content ||
      assetFileData.file_content.trim().length === 0
    ) {
      errors.push("File content is required");
    }

    if (!assetFileData.typeOfContent) {
      errors.push("typeOfContent is required");
    } else if (
      !["public", "personalized"].includes(assetFileData.typeOfContent)
    ) {
      errors.push('typeOfContent must be either "public" or "personalized"');
    }

    // Validate file name format (should be a valid Python filename)
    if (
      assetFileData.file_name &&
      !/^[a-zA-Z_][a-zA-Z0-9_]*\.py$/.test(assetFileData.file_name)
    ) {
      errors.push(
        "File name must be a valid Python filename (e.g., asset_generator.py)"
      );
    }

    // Basic validation that file content contains the required function
    if (
      assetFileData.file_content &&
      !assetFileData.file_content.includes("def generate_asset(")
    ) {
      errors.push("File content must contain a generate_asset function");
    }

    return errors;
  }

  async getAssetFileStats(organizationId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_files,
          COUNT(CASE WHEN agf.is_active = true THEN 1 END) as active_files,
          COUNT(DISTINCT agf.template_id) as templates_with_assets,
          COUNT(DISTINCT agf.file_name) as unique_filenames
        FROM asset_generate_files agf
        LEFT JOIN templates t ON agf.template_id = t.id
        WHERE t.organization_id = $1
      `;
      const result = await this.pool.query(query, [organizationId]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting asset file statistics: ${error.message}`);
    }
  }
}

module.exports = new AssetGenerateFiles();
