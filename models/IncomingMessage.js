const BaseModel = require("./BaseModel");

class IncomingMessage extends BaseModel {
  constructor() {
    super("incoming_messages");
  }

  /**
   * Create a new incoming message
   * @param {Object} messageData - Incoming message data
   * @returns {Promise<Object>} Created incoming message
   */
  async create(messageData) {
    try {
      // Ensure raw_payload is stored as JSON
      if (messageData.raw_payload && typeof messageData.raw_payload === "object") {
        messageData.raw_payload = JSON.stringify(messageData.raw_payload);
      }

      // Ensure interactive_data is stored as JSON
      if (messageData.interactive_data && typeof messageData.interactive_data === "object") {
        messageData.interactive_data = JSON.stringify(messageData.interactive_data);
      }

      return await super.create(messageData);
    } catch (error) {
      throw new Error(`Error creating incoming message: ${error.message}`);
    }
  }

  /**
   * Find incoming messages by organization
   * @param {string} organizationId - Organization ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of incoming messages
   */
  async findByOrganization(organizationId, filters = {}) {
    try {
      let query = `
        SELECT im.*, c.name as campaign_name
        FROM incoming_messages im
        LEFT JOIN campaigns c ON im.context_campaign_id = c.id
        WHERE im.organization_id = $1
      `;

      const values = [organizationId];
      let paramCount = 1;

      // Apply filters
      if (filters.message_type) {
        paramCount++;
        query += ` AND im.message_type = $${paramCount}`;
        values.push(filters.message_type);
      }

      if (filters.processed !== undefined) {
        paramCount++;
        query += ` AND im.processed = $${paramCount}`;
        values.push(filters.processed);
      }

      if (filters.from_phone_number) {
        paramCount++;
        query += ` AND im.from_phone_number = $${paramCount}`;
        values.push(filters.from_phone_number);
      }

      if (filters.to_phone_number) {
        paramCount++;
        query += ` AND im.to_phone_number = $${paramCount}`;
        values.push(filters.to_phone_number);
      }

      if (filters.context_campaign_id) {
        paramCount++;
        query += ` AND im.context_campaign_id = $${paramCount}`;
        values.push(filters.context_campaign_id);
      }

      if (filters.from_date) {
        paramCount++;
        query += ` AND im.timestamp >= $${paramCount}`;
        values.push(filters.from_date);
      }

      if (filters.to_date) {
        paramCount++;
        query += ` AND im.timestamp <= $${paramCount}`;
        values.push(filters.to_date);
      }

      // Add ordering and pagination
      query += ` ORDER BY im.timestamp DESC`;

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
      return result.rows.map(row => this.parseIncomingMessage(row));
    } catch (error) {
      throw new Error(`Error finding incoming messages by organization: ${error.message}`);
    }
  }

  /**
   * Find unprocessed incoming messages
   * @param {number} limit - Maximum number of messages to return
   * @returns {Promise<Array>} Array of unprocessed incoming messages
   */
  async findUnprocessed(limit = 100) {
    try {
      const query = `
        SELECT * FROM incoming_messages
        WHERE processed = false
        ORDER BY timestamp ASC
        LIMIT $1
      `;

      const result = await this.pool.query(query, [limit]);
      return result.rows.map(row => this.parseIncomingMessage(row));
    } catch (error) {
      throw new Error(`Error finding unprocessed incoming messages: ${error.message}`);
    }
  }

  /**
   * Mark incoming message as processed
   * @param {string} messageId - Incoming message ID
   * @returns {Promise<Object>} Updated incoming message
   */
  async markAsProcessed(messageId) {
    try {
      const updateData = {
        processed: true
      };

      return await this.update(messageId, updateData);
    } catch (error) {
      throw new Error(`Error marking incoming message as processed: ${error.message}`);
    }
  }

  /**
   * Find incoming message by WhatsApp message ID
   * @param {string} whatsappMessageId - WhatsApp message ID
   * @returns {Promise<Object|null>} Incoming message or null if not found
   */
  async findByWhatsAppMessageId(whatsappMessageId) {
    try {
      const query = `
        SELECT * FROM incoming_messages
        WHERE whatsapp_message_id = $1
      `;

      const result = await this.pool.query(query, [whatsappMessageId]);
      return result.rows.length > 0 ? this.parseIncomingMessage(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding incoming message by WhatsApp message ID: ${error.message}`);
    }
  }

  /**
   * Find incoming messages by phone number
   * @param {string} phoneNumber - Phone number
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of incoming messages
   */
  async findByPhoneNumber(phoneNumber, filters = {}) {
    try {
      let query = `
        SELECT * FROM incoming_messages
        WHERE from_phone_number = $1
      `;

      const values = [phoneNumber];
      let paramCount = 1;

      if (filters.from_date) {
        paramCount++;
        query += ` AND timestamp >= $${paramCount}`;
        values.push(filters.from_date);
      }

      if (filters.to_date) {
        paramCount++;
        query += ` AND timestamp <= $${paramCount}`;
        values.push(filters.to_date);
      }

      if (filters.message_type) {
        paramCount++;
        query += ` AND message_type = $${paramCount}`;
        values.push(filters.message_type);
      }

      query += ` ORDER BY timestamp DESC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.parseIncomingMessage(row));
    } catch (error) {
      throw new Error(`Error finding incoming messages by phone number: ${error.message}`);
    }
  }

  /**
   * Get incoming message statistics for an organization
   * @param {string} organizationId - Organization ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics(organizationId, filters = {}) {
    try {
      let query = `
        SELECT 
          message_type,
          COUNT(*) as count,
          COUNT(CASE WHEN processed = true THEN 1 END) as processed_count,
          COUNT(CASE WHEN processed = false THEN 1 END) as unprocessed_count,
          COUNT(CASE WHEN interactive_type IS NOT NULL THEN 1 END) as interactive_count
        FROM incoming_messages
        WHERE organization_id = $1
      `;

      const values = [organizationId];
      let paramCount = 1;

      if (filters.from_date) {
        paramCount++;
        query += ` AND timestamp >= $${paramCount}`;
        values.push(filters.from_date);
      }

      if (filters.to_date) {
        paramCount++;
        query += ` AND timestamp <= $${paramCount}`;
        values.push(filters.to_date);
      }

      query += ` GROUP BY message_type ORDER BY message_type`;

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting incoming message statistics: ${error.message}`);
    }
  }

  /**
   * Parse incoming message data and handle JSON fields
   * @param {Object} messageRow - Raw database row
   * @returns {Object} Parsed incoming message
   */
  parseIncomingMessage(messageRow) {
    if (!messageRow) return null;

    const message = { ...messageRow };

    // Parse raw_payload JSON
    if (message.raw_payload && typeof message.raw_payload === "string") {
      try {
        message.raw_payload = JSON.parse(message.raw_payload);
      } catch (error) {
        // Keep as string if parsing fails
      }
    }

    // Parse interactive_data JSON
    if (message.interactive_data && typeof message.interactive_data === "string") {
      try {
        message.interactive_data = JSON.parse(message.interactive_data);
      } catch (error) {
        message.interactive_data = null;
      }
    }

    return message;
  }

  /**
   * Delete old incoming messages (cleanup)
   * @param {number} daysOld - Number of days old to delete
   * @returns {Promise<number>} Number of deleted messages
   */
  async deleteOldMessages(daysOld = 90) {
    try {
      const query = `
        DELETE FROM incoming_messages
        WHERE created_at < NOW() - INTERVAL '${daysOld} days'
        AND processed = true
      `;

      const result = await this.pool.query(query);
      return result.rowCount;
    } catch (error) {
      throw new Error(`Error deleting old incoming messages: ${error.message}`);
    }
  }

  /**
   * Find campaign responses (incoming messages related to campaigns)
   * @param {string} campaignId - Campaign ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of campaign responses
   */
  async findCampaignResponses(campaignId, filters = {}) {
    try {
      let query = `
        SELECT * FROM incoming_messages
        WHERE context_campaign_id = $1
      `;

      const values = [campaignId];
      let paramCount = 1;

      if (filters.from_date) {
        paramCount++;
        query += ` AND timestamp >= $${paramCount}`;
        values.push(filters.from_date);
      }

      if (filters.to_date) {
        paramCount++;
        query += ` AND timestamp <= $${paramCount}`;
        values.push(filters.to_date);
      }

      if (filters.message_type) {
        paramCount++;
        query += ` AND message_type = $${paramCount}`;
        values.push(filters.message_type);
      }

      query += ` ORDER BY timestamp DESC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.parseIncomingMessage(row));
    } catch (error) {
      throw new Error(`Error finding campaign responses: ${error.message}`);
    }
  }
}

module.exports = new IncomingMessage();
