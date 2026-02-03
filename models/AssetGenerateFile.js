const BaseModel = require("./BaseModel");

class AssetGenerateFile extends BaseModel {
  constructor() {
    super("asset_generate_files");
  }

  // Content type constants
  static CONTENT_TYPES = {
    PUBLIC: "public",
    PERSONALIZED: "personalized",
  };

  /**
   * Create a new asset generate file
   * @param {Object} fileData - Asset file data
   * @returns {Promise<Object>} Created asset file
   */
  async create(fileData) {
    try {
      // Validate content type
      if (
        fileData.typeofcontent &&
        !Object.values(AssetGenerateFile.CONTENT_TYPES).includes(
          fileData.typeofcontent
        )
      ) {
        throw new Error(
          `Invalid content type. Must be one of: ${Object.values(
            AssetGenerateFile.CONTENT_TYPES
          ).join(", ")}`
        );
      }

      // Set default content type if not provided
      if (!fileData.typeofcontent) {
        fileData.typeofcontent = AssetGenerateFile.CONTENT_TYPES.PUBLIC;
      }

      return await super.create(fileData);
    } catch (error) {
      throw new Error(`Error creating asset generate file: ${error.message}`);
    }
  }

  /**
   * Find asset files by template ID
   * @param {string} templateId - Template ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of asset files
   */
  async findByTemplateId(templateId, filters = {}) {
    try {
      let query = `
        SELECT agf.*, t.name as template_name, u.email as created_by_email
        FROM asset_generate_files agf
        LEFT JOIN templates t ON agf.template_id = t.id
        LEFT JOIN users u ON agf.created_by = u.id
        WHERE agf.template_id = $1
      `;

      const values = [templateId];
      let paramCount = 1;

      // Apply filters
      if (filters.typeofcontent) {
        paramCount++;
        query += ` AND agf.typeofcontent = $${paramCount}`;
        values.push(filters.typeofcontent);
      }

      if (filters.is_active !== undefined) {
        paramCount++;
        query += ` AND agf.is_active = $${paramCount}`;
        values.push(filters.is_active);
      }

      if (filters.version) {
        paramCount++;
        query += ` AND agf.version = $${paramCount}`;
        values.push(filters.version);
      }

      // Add ordering
      query += ` ORDER BY agf.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw new Error(
        `Error finding asset files by template ID: ${error.message}`
      );
    }
  }

  /**
   * Find asset files by content type
   * @param {string} contentType - Content type ('public' or 'personalized')
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of asset files
   */
  async findByContentType(contentType, filters = {}) {
    try {
      // Validate content type
      if (
        !Object.values(AssetGenerateFile.CONTENT_TYPES).includes(contentType)
      ) {
        throw new Error(
          `Invalid content type. Must be one of: ${Object.values(
            AssetGenerateFile.CONTENT_TYPES
          ).join(", ")}`
        );
      }

      let query = `
        SELECT agf.*, t.name as template_name, t.organization_id, u.email as created_by_email
        FROM asset_generate_files agf
        LEFT JOIN templates t ON agf.template_id = t.id
        LEFT JOIN users u ON agf.created_by = u.id
        WHERE agf.typeofcontent = $1
      `;

      const values = [contentType];
      let paramCount = 1;

      // Apply filters
      if (filters.organization_id) {
        paramCount++;
        query += ` AND t.organization_id = $${paramCount}`;
        values.push(filters.organization_id);
      }

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

      // Add ordering
      query += ` ORDER BY agf.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw new Error(
        `Error finding asset files by content type: ${error.message}`
      );
    }
  }

  /**
   * Update content type of an asset file
   * @param {string} fileId - Asset file ID
   * @param {string} contentType - New content type
   * @returns {Promise<Object>} Updated asset file
   */
  async updateContentType(fileId, contentType) {
    try {
      // Validate content type
      if (
        !Object.values(AssetGenerateFile.CONTENT_TYPES).includes(contentType)
      ) {
        throw new Error(
          `Invalid content type. Must be one of: ${Object.values(
            AssetGenerateFile.CONTENT_TYPES
          ).join(", ")}`
        );
      }

      const updateData = {
        typeofcontent: contentType,
      };

      return await this.update(fileId, updateData);
    } catch (error) {
      throw new Error(`Error updating content type: ${error.message}`);
    }
  }

  /**
   * Get statistics by content type
   * @param {string} organizationId - Organization ID (optional)
   * @returns {Promise<Array>} Statistics array
   */
  async getContentTypeStatistics(organizationId = null) {
    try {
      let query = `
        SELECT 
          agf.typeofcontent,
          COUNT(*) as total_files,
          COUNT(CASE WHEN agf.is_active = true THEN 1 END) as active_files,
          COUNT(CASE WHEN agf.is_active = false THEN 1 END) as inactive_files
        FROM asset_generate_files agf
      `;

      const values = [];
      let paramCount = 0;

      if (organizationId) {
        paramCount++;
        query += `
          LEFT JOIN templates t ON agf.template_id = t.id
          WHERE t.organization_id = $${paramCount}
        `;
        values.push(organizationId);
      }

      query += `
        GROUP BY agf.typeofcontent
        ORDER BY agf.typeofcontent
      `;

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw new Error(
        `Error getting content type statistics: ${error.message}`
      );
    }
  }

  /**
   * Find active asset files for a template
   * @param {string} templateId - Template ID
   * @param {string} contentType - Content type filter (optional)
   * @returns {Promise<Array>} Array of active asset files
   */
  async findActiveByTemplate(templateId, contentType = null) {
    try {
      let query = `
        SELECT * FROM asset_generate_files
        WHERE template_id = $1 AND is_active = true
      `;

      const values = [templateId];
      let paramCount = 1;

      if (contentType) {
        // Validate content type
        if (
          !Object.values(AssetGenerateFile.CONTENT_TYPES).includes(contentType)
        ) {
          throw new Error(
            `Invalid content type. Must be one of: ${Object.values(
              AssetGenerateFile.CONTENT_TYPES
            ).join(", ")}`
          );
        }

        paramCount++;
        query += ` AND typeofcontent = $${paramCount}`;
        values.push(contentType);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding active asset files: ${error.message}`);
    }
  }

  /**
   * Deactivate old versions when creating a new version
   * @param {string} templateId - Template ID
   * @param {string} fileName - File name
   * @param {string} contentType - Content type
   * @returns {Promise<number>} Number of deactivated files
   */
  async deactivateOldVersions(templateId, fileName, contentType) {
    try {
      const query = `
        UPDATE asset_generate_files
        SET is_active = false
        WHERE template_id = $1 
        AND file_name = $2 
        AND typeofcontent = $3
        AND is_active = true
      `;

      const result = await this.pool.query(query, [
        templateId,
        fileName,
        contentType,
      ]);
      return result.rowCount;
    } catch (error) {
      throw new Error(`Error deactivating old versions: ${error.message}`);
    }
  }
}

module.exports = new AssetGenerateFile();
