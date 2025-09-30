const BaseModel = require("./BaseModel");

class Campaign extends BaseModel {
  constructor() {
    super("campaigns");
  }

  async create(campaignData) {
    try {
      // Set default scheduled_at if not provided for scheduled campaigns
      if (
        campaignData.campaign_type === "scheduled" &&
        !campaignData.scheduled_at
      ) {
        const bufferHours = campaignData.buffer_hours || 48;
        const scheduledDate = new Date();
        scheduledDate.setHours(scheduledDate.getHours() + bufferHours);
        campaignData.scheduled_at = scheduledDate;
      }

      return await super.create(campaignData);
    } catch (error) {
      throw new Error(`Error creating campaign: ${error.message}`);
    }
  }

  async findByOrganization(organizationId, filters = {}) {
    try {
      let query = `
        SELECT c.*, t.name as template_name, t.category as template_category,
               u.first_name as created_by_name, u.last_name as created_by_lastname,
               a.first_name as approved_by_name, a.last_name as approved_by_lastname,
               r.first_name as rejected_by_name, r.last_name as rejected_by_lastname
        FROM campaigns c
        LEFT JOIN templates t ON c.template_id = t.id
        LEFT JOIN users u ON c.created_by = u.id
        LEFT JOIN users a ON c.approved_by = a.id
        LEFT JOIN users r ON c.rejected_by = r.id
        WHERE c.organization_id = $1
      `;

      const values = [organizationId];
      let paramCount = 1;

      // Apply filters
      if (filters.status) {
        paramCount++;
        query += ` AND c.status = $${paramCount}`;
        values.push(filters.status);
      }

      if (filters.campaign_type) {
        paramCount++;
        query += ` AND c.campaign_type = $${paramCount}`;
        values.push(filters.campaign_type);
      }

      if (filters.template_id) {
        paramCount++;
        query += ` AND c.template_id = $${paramCount}`;
        values.push(filters.template_id);
      }

      query += ` ORDER BY c.created_at DESC`;

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
        `Error finding campaigns by organization: ${error.message}`
      );
    }
  }

  async findPendingApproval() {
    try {
      const query = `
        SELECT c.*, t.name as template_name, t.category as template_category,
               u.first_name as created_by_name, u.last_name as created_by_lastname,
               o.name as organization_name
        FROM campaigns c
        LEFT JOIN templates t ON c.template_id = t.id
        LEFT JOIN users u ON c.created_by = u.id
        LEFT JOIN organizations o ON c.organization_id = o.id
        WHERE c.status = 'pending_approval'
        ORDER BY c.submitted_for_approval_at ASC
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      throw new Error(
        `Error finding pending approval campaigns: ${error.message}`
      );
    }
  }

  async submitForApproval(id, userId) {
    try {
      const updateData = {
        status: "pending_approval",
        submitted_for_approval_at: new Date(),
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(
        `Error submitting campaign for approval: ${error.message}`
      );
    }
  }

  async approveCampaign(id, approvedBy) {
    try {
      const updateData = {
        status: "approved",
        approved_by: approvedBy,
        approved_at: new Date(),
        rejected_by: null,
        rejected_at: null,
        rejection_reason: null,
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error approving campaign: ${error.message}`);
    }
  }

  async rejectCampaign(id, rejectedBy, rejectionReason) {
    try {
      const updateData = {
        status: "rejected",
        rejected_by: rejectedBy,
        rejected_at: new Date(),
        rejection_reason: rejectionReason,
        approved_by: null,
        approved_at: null,
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error rejecting campaign: ${error.message}`);
    }
  }

  async updateStatistics(id, stats) {
    try {
      const updateData = {};

      if (stats.total_targeted_audience !== undefined) {
        updateData.total_targeted_audience = stats.total_targeted_audience;
      }

      if (stats.total_sent !== undefined) {
        updateData.total_sent = stats.total_sent;
      }

      if (stats.total_delivered !== undefined) {
        updateData.total_delivered = stats.total_delivered;
      }

      if (stats.total_read !== undefined) {
        updateData.total_read = stats.total_read;
      }

      if (stats.total_replied !== undefined) {
        updateData.total_replied = stats.total_replied;
      }

      if (stats.total_failed !== undefined) {
        updateData.total_failed = stats.total_failed;
      }

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error updating campaign statistics: ${error.message}`);
    }
  }

  async startCampaign(id) {
    try {
      const updateData = {
        status: "running",
        started_at: new Date(),
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error starting campaign: ${error.message}`);
    }
  }

  async completeCampaign(id) {
    try {
      const updateData = {
        status: "completed",
        completed_at: new Date(),
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error completing campaign: ${error.message}`);
    }
  }

  async pauseCampaign(id) {
    try {
      const updateData = {
        status: "paused",
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error pausing campaign: ${error.message}`);
    }
  }

  async cancelCampaign(id) {
    try {
      const updateData = {
        status: "cancelled",
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error cancelling campaign: ${error.message}`);
    }
  }

  // Asset Generation Methods
  async startAssetGeneration(id) {
    try {
      const updateData = {
        status: "asset_generation",
        asset_generation_started_at: new Date(),
        asset_generation_status: "processing",
        asset_generation_retry_count: 0,
        asset_generation_last_error: null,
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error starting asset generation: ${error.message}`);
    }
  }

  async completeAssetGeneration(id, progress = {}) {
    try {
      const updateData = {
        status: "asset_generated",
        asset_generation_completed_at: new Date(),
        asset_generation_status: "generated",
        asset_generation_progress: progress,
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error completing asset generation: ${error.message}`);
    }
  }

  async failAssetGeneration(id, errorMessage, retryCount = 0) {
    try {
      const updateData = {
        asset_generation_status: "failed",
        asset_generation_last_error: errorMessage,
        asset_generation_retry_count: retryCount,
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(`Error failing asset generation: ${error.message}`);
    }
  }

  async updateAssetGenerationProgress(id, progress) {
    try {
      const updateData = {
        asset_generation_progress: progress,
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(
        `Error updating asset generation progress: ${error.message}`
      );
    }
  }

  async markReadyToLaunch(id) {
    try {
      const updateData = {
        status: "ready_to_launch",
      };

      return await this.update(id, updateData);
    } catch (error) {
      throw new Error(
        `Error marking campaign ready to launch: ${error.message}`
      );
    }
  }

  async findCampaignsForAssetGeneration() {
    try {
      const query = `
        SELECT c.*, t.name as template_name, o.name as organization_name
        FROM campaigns c
        LEFT JOIN templates t ON c.template_id = t.id
        LEFT JOIN organizations o ON c.organization_id = o.id
        WHERE c.status = 'approved'
        AND (c.asset_generation_status IS NULL OR c.asset_generation_status = 'pending')
        ORDER BY c.approved_at ASC
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      throw new Error(
        `Error finding campaigns for asset generation: ${error.message}`
      );
    }
  }

  async findFailedAssetGenerations(maxRetries = 3) {
    try {
      const query = `
        SELECT c.*, t.name as template_name, o.name as organization_name
        FROM campaigns c
        LEFT JOIN templates t ON c.template_id = t.id
        LEFT JOIN organizations o ON c.organization_id = o.id
        WHERE c.asset_generation_status = 'failed'
        AND c.asset_generation_retry_count < $1
        ORDER BY c.asset_generation_started_at ASC
      `;

      const result = await this.pool.query(query, [maxRetries]);
      return result.rows;
    } catch (error) {
      throw new Error(
        `Error finding failed asset generations: ${error.message}`
      );
    }
  }

  async findScheduledCampaigns() {
    try {
      const query = `
        SELECT c.*, t.name as template_name, o.name as organization_name
        FROM campaigns c
        LEFT JOIN templates t ON c.template_id = t.id
        LEFT JOIN organizations o ON c.organization_id = o.id
        WHERE c.status = 'scheduled' 
        AND c.scheduled_at <= NOW()
        ORDER BY c.scheduled_at ASC
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding scheduled campaigns: ${error.message}`);
    }
  }

  async findByNameAndOrganization(name, organizationId) {
    try {
      const query = `
        SELECT * FROM campaigns 
        WHERE name = $1 AND organization_id = $2
      `;
      const result = await this.pool.query(query, [name, organizationId]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(
        `Error finding campaign by name and organization: ${error.message}`
      );
    }
  }

  async getCampaignStats(organizationId) {
    try {
      const query = `
        SELECT 
          status,
          COUNT(*) as count,
          SUM(total_targeted_audience) as total_audience,
          SUM(total_sent) as total_sent,
          SUM(total_delivered) as total_delivered,
          SUM(total_read) as total_read,
          SUM(total_replied) as total_replied,
          SUM(total_failed) as total_failed
        FROM campaigns 
        WHERE organization_id = $1
        GROUP BY status
      `;
      const result = await this.pool.query(query, [organizationId]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting campaign statistics: ${error.message}`);
    }
  }

  async findCampaignById(campaignId) {
    try {
      const query = `
        SELECT * FROM campaigns 
        WHERE id = $1
      `;
      const result = await this.pool.query(query, [campaignId]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding campaign by ID: ${error.message}`);
    }
  }

  // Validate campaign data before saving
  validateCampaign(campaignData) {
    const errors = [];

    if (!campaignData.name || campaignData.name.trim().length === 0) {
      errors.push("Campaign name is required");
    }

    if (!campaignData.template_id) {
      errors.push("Template ID is required");
    }

    if (!campaignData.organization_id) {
      errors.push("Organization ID is required");
    }

    if (!campaignData.created_by) {
      errors.push("Created by user ID is required");
    }

    // Validate campaign type
    const validTypes = ["immediate", "scheduled", "recurring"];
    if (
      campaignData.campaign_type &&
      !validTypes.includes(campaignData.campaign_type)
    ) {
      errors.push("Invalid campaign type");
    }

    // Validate scheduled campaigns have scheduled_at
    if (
      campaignData.campaign_type === "scheduled" &&
      !campaignData.scheduled_at
    ) {
      errors.push("Scheduled campaigns must have a scheduled date");
    }

    // Validate scheduled_at is in the future
    if (
      campaignData.scheduled_at &&
      new Date(campaignData.scheduled_at) <= new Date()
    ) {
      errors.push("Scheduled date must be in the future");
    }

    return errors;
  }
}

module.exports = new Campaign();
