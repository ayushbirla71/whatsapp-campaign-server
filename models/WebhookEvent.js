const BaseModel = require("./BaseModel");

class WebhookEvent extends BaseModel {
  constructor() {
    super("webhook_events");
  }

  /**
   * Create a new webhook event
   * @param {Object} eventData - Webhook event data
   * @returns {Promise<Object>} Created webhook event
   */
  async create(eventData) {
    try {
      // Ensure raw_payload is stored as JSON
      if (eventData.raw_payload && typeof eventData.raw_payload === "object") {
        eventData.raw_payload = JSON.stringify(eventData.raw_payload);
      }

      // Ensure interactive_data is stored as JSON
      if (eventData.interactive_data && typeof eventData.interactive_data === "object") {
        eventData.interactive_data = JSON.stringify(eventData.interactive_data);
      }

      return await super.create(eventData);
    } catch (error) {
      throw new Error(`Error creating webhook event: ${error.message}`);
    }
  }

  /**
   * Find webhook events by organization
   * @param {string} organizationId - Organization ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of webhook events
   */
  async findByOrganization(organizationId, filters = {}) {
    try {
      let query = `
        SELECT we.*, c.name as campaign_name, ca.name as audience_name
        FROM webhook_events we
        LEFT JOIN campaigns c ON we.campaign_id = c.id
        LEFT JOIN campaign_audience ca ON we.campaign_audience_id = ca.id
        WHERE we.organization_id = $1
      `;

      const values = [organizationId];
      let paramCount = 1;

      // Apply filters
      if (filters.event_type) {
        paramCount++;
        query += ` AND we.event_type = $${paramCount}`;
        values.push(filters.event_type);
      }

      if (filters.processed !== undefined) {
        paramCount++;
        query += ` AND we.processed = $${paramCount}`;
        values.push(filters.processed);
      }

      if (filters.campaign_id) {
        paramCount++;
        query += ` AND we.campaign_id = $${paramCount}`;
        values.push(filters.campaign_id);
      }

      if (filters.from_date) {
        paramCount++;
        query += ` AND we.timestamp >= $${paramCount}`;
        values.push(filters.from_date);
      }

      if (filters.to_date) {
        paramCount++;
        query += ` AND we.timestamp <= $${paramCount}`;
        values.push(filters.to_date);
      }

      // Add ordering and pagination
      query += ` ORDER BY we.timestamp DESC`;

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
      return result.rows.map(row => this.parseWebhookEvent(row));
    } catch (error) {
      throw new Error(`Error finding webhook events by organization: ${error.message}`);
    }
  }

  /**
   * Find unprocessed webhook events
   * @param {number} limit - Maximum number of events to return
   * @returns {Promise<Array>} Array of unprocessed webhook events
   */
  async findUnprocessed(limit = 100) {
    try {
      const query = `
        SELECT * FROM webhook_events
        WHERE processed = false
        ORDER BY timestamp ASC
        LIMIT $1
      `;

      const result = await this.pool.query(query, [limit]);
      return result.rows.map(row => this.parseWebhookEvent(row));
    } catch (error) {
      throw new Error(`Error finding unprocessed webhook events: ${error.message}`);
    }
  }

  /**
   * Mark webhook event as processed
   * @param {string} eventId - Webhook event ID
   * @param {string} errorMessage - Optional error message if processing failed
   * @returns {Promise<Object>} Updated webhook event
   */
  async markAsProcessed(eventId, errorMessage = null) {
    try {
      const updateData = {
        processed: true,
        error_message: errorMessage
      };

      return await this.update(eventId, updateData);
    } catch (error) {
      throw new Error(`Error marking webhook event as processed: ${error.message}`);
    }
  }

  /**
   * Find webhook events by WhatsApp message ID
   * @param {string} whatsappMessageId - WhatsApp message ID
   * @returns {Promise<Array>} Array of webhook events
   */
  async findByWhatsAppMessageId(whatsappMessageId) {
    try {
      const query = `
        SELECT * FROM webhook_events
        WHERE whatsapp_message_id = $1
        ORDER BY timestamp DESC
      `;

      const result = await this.pool.query(query, [whatsappMessageId]);
      return result.rows.map(row => this.parseWebhookEvent(row));
    } catch (error) {
      throw new Error(`Error finding webhook events by WhatsApp message ID: ${error.message}`);
    }
  }

  /**
   * Get webhook event statistics for an organization
   * @param {string} organizationId - Organization ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics(organizationId, filters = {}) {
    try {
      let query = `
        SELECT 
          event_type,
          COUNT(*) as count,
          COUNT(CASE WHEN processed = true THEN 1 END) as processed_count,
          COUNT(CASE WHEN processed = false THEN 1 END) as unprocessed_count,
          COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as error_count
        FROM webhook_events
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

      query += ` GROUP BY event_type ORDER BY event_type`;

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting webhook event statistics: ${error.message}`);
    }
  }

  /**
   * Parse webhook event data and handle JSON fields
   * @param {Object} eventRow - Raw database row
   * @returns {Object} Parsed webhook event
   */
  parseWebhookEvent(eventRow) {
    if (!eventRow) return null;

    const event = { ...eventRow };

    // Parse raw_payload JSON
    if (event.raw_payload && typeof event.raw_payload === "string") {
      try {
        event.raw_payload = JSON.parse(event.raw_payload);
      } catch (error) {
        // Keep as string if parsing fails
      }
    }

    // Parse interactive_data JSON
    if (event.interactive_data && typeof event.interactive_data === "string") {
      try {
        event.interactive_data = JSON.parse(event.interactive_data);
      } catch (error) {
        event.interactive_data = null;
      }
    }

    return event;
  }

  /**
   * Delete old webhook events (cleanup)
   * @param {number} daysOld - Number of days old to delete
   * @returns {Promise<number>} Number of deleted events
   */
  async deleteOldEvents(daysOld = 30) {
    try {
      const query = `
        DELETE FROM webhook_events
        WHERE created_at < NOW() - INTERVAL '${daysOld} days'
        AND processed = true
      `;

      const result = await this.pool.query(query);
      return result.rowCount;
    } catch (error) {
      throw new Error(`Error deleting old webhook events: ${error.message}`);
    }
  }
}

module.exports = new WebhookEvent();
