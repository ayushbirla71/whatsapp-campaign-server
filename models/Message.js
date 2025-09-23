const BaseModel = require("./BaseModel");

class Message extends BaseModel {
  constructor() {
    super("messages");
  }

  /**
   * Create a new message
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} Created message
   */
  async create(messageData) {
    try {
      // Ensure template_parameters is stored as JSON
      if (
        messageData.template_parameters &&
        typeof messageData.template_parameters === "object"
      ) {
        messageData.template_parameters = JSON.stringify(
          messageData.template_parameters
        );
      }

      // Ensure interaction_data is stored as JSON
      if (
        messageData.interaction_data &&
        typeof messageData.interaction_data === "object"
      ) {
        messageData.interaction_data = JSON.stringify(
          messageData.interaction_data
        );
      }

      return await super.create(messageData);
    } catch (error) {
      throw new Error(`Error creating message: ${error.message}`);
    }
  }

  /**
   * Find messages by organization
   * @param {string} organizationId - Organization ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of messages
   */
  async findByOrganization(organizationId, filters = {}) {
    try {
      let query = `
        SELECT m.*, c.name as campaign_name, ca.name as audience_name
        FROM messages m
        LEFT JOIN campaigns c ON m.campaign_id = c.id
        LEFT JOIN campaign_audience ca ON m.campaign_audience_id = ca.id
        WHERE m.organization_id = $1
      `;

      const values = [organizationId];
      let paramCount = 1;

      // Apply filters
      if (filters.message_type) {
        paramCount++;
        query += ` AND m.message_type = $${paramCount}`;
        values.push(filters.message_type);
      }

      if (filters.message_status) {
        paramCount++;
        query += ` AND m.message_status = $${paramCount}`;
        values.push(filters.message_status);
      }

      if (filters.is_incoming !== undefined) {
        paramCount++;
        query += ` AND m.is_incoming = $${paramCount}`;
        values.push(filters.is_incoming);
      }

      if (filters.campaign_id) {
        paramCount++;
        query += ` AND m.campaign_id = $${paramCount}`;
        values.push(filters.campaign_id);
      }

      if (filters.from_number) {
        paramCount++;
        query += ` AND m.from_number = $${paramCount}`;
        values.push(filters.from_number);
      }

      if (filters.to_number) {
        paramCount++;
        query += ` AND m.to_number = $${paramCount}`;
        values.push(filters.to_number);
      }

      if (filters.from_date) {
        paramCount++;
        query += ` AND m.created_at >= $${paramCount}`;
        values.push(filters.from_date);
      }

      if (filters.to_date) {
        paramCount++;
        query += ` AND m.created_at <= $${paramCount}`;
        values.push(filters.to_date);
      }

      // Add ordering and pagination
      query += ` ORDER BY m.created_at DESC`;

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
      return result.rows.map((row) => this.parseMessage(row));
    } catch (error) {
      throw new Error(
        `Error finding messages by organization: ${error.message}`
      );
    }
  }

  /**
   * Find conversation between two numbers
   * @param {string} organizationId - Organization ID
   * @param {string} number1 - First phone number
   * @param {string} number2 - Second phone number
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of messages in conversation
   */
  async findConversation(organizationId, number1, number2, filters = {}) {
    try {
      let query = `
        SELECT * FROM messages
        WHERE organization_id = $1
        AND (
          (from_number = $2 AND to_number = $3) OR
          (from_number = $3 AND to_number = $2)
        )
      `;

      const values = [organizationId, number1, number2];
      let paramCount = 3;

      if (filters.from_date) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        values.push(filters.from_date);
      }

      if (filters.to_date) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        values.push(filters.to_date);
      }

      query += ` ORDER BY created_at ASC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      const result = await this.pool.query(query, values);
      return result.rows.map((row) => this.parseMessage(row));
    } catch (error) {
      throw new Error(`Error finding conversation: ${error.message}`);
    }
  }

  /**
   * Update message status
   * @param {string} messageId - Message ID
   * @param {string} status - New status
   * @param {Object} additionalData - Additional data to update
   * @returns {Promise<Object>} Updated message
   */
  async updateStatus(messageId, status, additionalData = {}) {
    try {
      const updateData = {
        message_status: status,
        ...additionalData,
      };

      // Set timestamp based on status
      const now = new Date();
      switch (status) {
        case "sent":
          updateData.sent_at = now;
          break;
        case "delivered":
          updateData.delivered_at = now;
          break;
        case "read":
          updateData.read_at = now;
          break;
        case "failed":
          updateData.failed_at = now;
          break;
      }

      return await this.update(messageId, updateData);
    } catch (error) {
      throw new Error(`Error updating message status: ${error.message}`);
    }
  }

  /**
   * Find message by WhatsApp message ID
   * @param {string} whatsappMessageId - WhatsApp message ID
   * @returns {Promise<Object|null>} Message or null if not found
   */
  async findByWhatsAppMessageId(whatsappMessageId) {
    try {
      const query = `
        SELECT * FROM messages
        WHERE whatsapp_message_id = $1
      `;

      const result = await this.pool.query(query, [whatsappMessageId]);
      return result.rows.length > 0 ? this.parseMessage(result.rows[0]) : null;
    } catch (error) {
      throw new Error(
        `Error finding message by WhatsApp message ID: ${error.message}`
      );
    }
  }

  /**
   * Get message statistics for an organization
   * @param {string} organizationId - Organization ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics(organizationId, filters = {}) {
    try {
      let query = `
        SELECT 
          message_type,
          message_status,
          is_incoming,
          COUNT(*) as count
        FROM messages
        WHERE organization_id = $1
      `;

      const values = [organizationId];
      let paramCount = 1;

      if (filters.from_date) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        values.push(filters.from_date);
      }

      if (filters.to_date) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        values.push(filters.to_date);
      }

      if (filters.campaign_id) {
        paramCount++;
        query += ` AND campaign_id = $${paramCount}`;
        values.push(filters.campaign_id);
      }

      query += ` GROUP BY message_type, message_status, is_incoming ORDER BY message_type, message_status`;

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting message statistics: ${error.message}`);
    }
  }

  /**
   * Parse message data and handle JSON fields
   * @param {Object} messageRow - Raw database row
   * @returns {Object} Parsed message
   */
  parseMessage(messageRow) {
    if (!messageRow) return null;

    const message = { ...messageRow };

    // Parse template_parameters JSON
    if (
      message.template_parameters &&
      typeof message.template_parameters === "string"
    ) {
      try {
        message.template_parameters = JSON.parse(message.template_parameters);
      } catch (error) {
        message.template_parameters = null;
      }
    }

    // Parse interaction_data JSON
    if (
      message.interaction_data &&
      typeof message.interaction_data === "string"
    ) {
      try {
        message.interaction_data = JSON.parse(message.interaction_data);
      } catch (error) {
        message.interaction_data = null;
      }
    }

    return message;
  }

  /**
   * Find failed messages eligible for retry
   * @param {number} maxRetryCount - Maximum retry count
   * @param {number} retryAfterHours - Hours to wait before retry
   * @param {number} limit - Maximum number of messages to return
   * @returns {Promise<Array>} Array of failed messages
   */
  async findFailedMessagesForRetry(
    maxRetryCount = 3,
    retryAfterHours = 2,
    limit = 100
  ) {
    try {
      const cutoffTime = new Date();
      // cutoffTime.setHours(cutoffTime.getHours() - retryAfterHours);

      const query = `
        SELECT m.*, c.id as campaign_id, c.organization_id, c.template_id,
               t.name as template_name, t.category as template_category,
               t.language as template_language, t.components, t.body_text,
               t.header_type, t.header_media_url, t.footer_text, t.parameters,
               ca.attributes, ca.generated_asset_urls, ca.name as audience_name,
               ca.msisdn
        FROM messages m
        LEFT JOIN campaigns c ON m.campaign_id = c.id
        LEFT JOIN templates t ON c.template_id = t.id
        LEFT JOIN campaign_audience ca ON m.campaign_audience_id = ca.id
        WHERE m.message_status = 'failed'
        AND m.retry_count < $1
        AND m.updated_at <= $2
        AND m.campaign_id IS NOT NULL
        ORDER BY m.updated_at ASC
        LIMIT $3
      `;

      const result = await this.pool.query(query, [
        maxRetryCount,
        cutoffTime,
        limit,
      ]);
      return result.rows;
    } catch (error) {
      throw new Error(
        `Error finding failed messages for retry: ${error.message}`
      );
    }
  }

  /**
   * Update message retry status
   * @param {string} messageId - Message ID
   * @param {number} retryCount - New retry count
   * @param {string} status - New message status
   * @param {string} failureReason - Optional failure reason
   * @returns {Promise<Object>} Updated message
   */
  async updateRetryStatus(messageId, retryCount, status, failureReason = null) {
    try {
      const query = `
        UPDATE messages
        SET retry_count = $1,
            message_status = $2,
            failure_reason = COALESCE($3, failure_reason),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        retryCount,
        status,
        failureReason,
        messageId,
      ]);
      return result.rows.length > 0 ? this.parseMessage(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Error updating message retry status: ${error.message}`);
    }
  }

  /**
   * Delete old messages (cleanup)
   * @param {number} daysOld - Number of days old to delete
   * @returns {Promise<number>} Number of deleted messages
   */
  async deleteOldMessages(daysOld = 90) {
    try {
      const query = `
        DELETE FROM messages
        WHERE created_at < NOW() - INTERVAL '${daysOld} days'
        AND message_status IN ('delivered', 'read', 'failed')
      `;

      const result = await this.pool.query(query);
      return result.rowCount;
    } catch (error) {
      throw new Error(`Error deleting old messages: ${error.message}`);
    }
  }
}

module.exports = new Message();
