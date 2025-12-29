const BaseModel = require("./BaseModel");
const pool = require("../config/database");

class Conversation extends BaseModel {
  constructor() {
    super("conversations");
  }

  /**
   * Get or create conversation using database function
   * This ensures atomic operation and prevents duplicates
   */
  async getOrCreate(organizationId, customerPhone, options = {}) {
    try {
      const {
        customerName = null,
        conversationType = "general",
        relatedCampaignId = null,
      } = options;

      const result = await pool.query(
        `SELECT get_or_create_conversation($1, $2, $3, $4, $5) as conversation_id`,
        [
          organizationId,
          customerPhone,
          customerName,
          conversationType,
          relatedCampaignId,
        ]
      );

      const conversationId = result.rows[0].conversation_id;
      return await this.findById(conversationId);
    } catch (error) {
      throw new Error(
        `Error getting or creating conversation: ${error.message}`
      );
    }
  }

  /**
   * Find conversation by customer phone and organization
   */
  async findByCustomerPhone(organizationId, customerPhone) {
    try {
      const result = await pool.query(
        `SELECT * FROM ${this.tableName} 
         WHERE organization_id = $1 AND customer_phone = $2`,
        [organizationId, customerPhone]
      );

      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding conversation: ${error.message}`);
    }
  }

  /**
   * List conversations with filters and pagination
   */
  async list(filters = {}) {
    try {
      const {
        organizationId,
        status,
        assignedTo,
        unreadOnly = false,
        conversationType,
        search,
        limit = 20,
        offset = 0,
      } = filters;

      let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
      const params = [];
      let paramCount = 1;

      if (organizationId) {
        query += ` AND organization_id = $${paramCount}`;
        params.push(organizationId);
        paramCount++;
      }

      if (status) {
        query += ` AND conversation_status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (assignedTo) {
        query += ` AND assigned_to_user_id = $${paramCount}`;
        params.push(assignedTo);
        paramCount++;
      }

      if (unreadOnly) {
        query += ` AND unread_count > 0`;
      }

      if (conversationType) {
        query += ` AND conversation_type = $${paramCount}`;
        params.push(conversationType);
        paramCount++;
      }

      if (search) {
        query += ` AND (customer_name ILIKE $${paramCount} OR customer_phone ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }

      query += ` ORDER BY last_message_at DESC NULLS LAST, created_at DESC`;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error listing conversations: ${error.message}`);
    }
  }

  /**
   * Count conversations with filters
   */
  async count(filters = {}) {
    try {
      const {
        organizationId,
        status,
        assignedTo,
        unreadOnly = false,
        conversationType,
        search,
      } = filters;

      let query = `SELECT COUNT(*) FROM ${this.tableName} WHERE 1=1`;
      const params = [];
      let paramCount = 1;

      if (organizationId) {
        query += ` AND organization_id = $${paramCount}`;
        params.push(organizationId);
        paramCount++;
      }

      if (status) {
        query += ` AND conversation_status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (assignedTo) {
        query += ` AND assigned_to_user_id = $${paramCount}`;
        params.push(assignedTo);
        paramCount++;
      }

      if (unreadOnly) {
        query += ` AND unread_count > 0`;
      }

      if (conversationType) {
        query += ` AND conversation_type = $${paramCount}`;
        params.push(conversationType);
        paramCount++;
      }

      if (search) {
        query += ` AND (customer_name ILIKE $${paramCount} OR customer_phone ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }

      const result = await pool.query(query, params);
      return parseInt(result.rows[0].count);
    } catch (error) {
      throw new Error(`Error counting conversations: ${error.message}`);
    }
  }

  /**
   * Assign conversation to user
   */
  async assign(conversationId, userId) {
    try {
      const result = await pool.query(
        `UPDATE ${this.tableName}
         SET assigned_to_user_id = $1, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [userId, conversationId]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error assigning conversation: ${error.message}`);
    }
  }

  /**
   * Mark conversation as read (reset unread count)
   */
  async markAsRead(conversationId) {
    try {
      const result = await pool.query(
        `UPDATE ${this.tableName}
         SET unread_count = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [conversationId]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error marking conversation as read: ${error.message}`);
    }
  }

  /**
   * Update conversation status
   */
  async updateStatus(conversationId, status, closedBy = null) {
    try {
      const updates = {
        conversation_status: status,
        updated_at: new Date(),
      };

      if (status === "closed") {
        updates.closed_at = new Date();
        if (closedBy) {
          updates.closed_by = closedBy;
        }
      }

      return await this.update(conversationId, updates);
    } catch (error) {
      throw new Error(`Error updating conversation status: ${error.message}`);
    }
  }

  /**
   * Add tags to conversation
   */
  async addTags(conversationId, tags) {
    try {
      const result = await pool.query(
        `UPDATE ${this.tableName}
         SET tags = array_cat(tags, $1::text[]), updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [tags, conversationId]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error adding tags: ${error.message}`);
    }
  }

  /**
   * Get conversation statistics for organization
   */
  async getStatistics(organizationId) {
    try {
      const result = await pool.query(
        `SELECT
          COUNT(*) as total_conversations,
          COUNT(*) FILTER (WHERE conversation_status = 'active') as active_conversations,
          COUNT(*) FILTER (WHERE conversation_status = 'waiting') as waiting_conversations,
          COUNT(*) FILTER (WHERE conversation_status = 'closed') as closed_conversations,
          COUNT(*) FILTER (WHERE unread_count > 0) as unread_conversations,
          COUNT(*) FILTER (WHERE assigned_to_user_id IS NULL) as unassigned_conversations,
          SUM(total_messages) as total_messages,
          AVG(total_messages) as avg_messages_per_conversation
         FROM ${this.tableName}
         WHERE organization_id = $1`,
        [organizationId]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(
        `Error getting conversation statistics: ${error.message}`
      );
    }
  }
}

module.exports = new Conversation();
