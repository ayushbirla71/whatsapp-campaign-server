const BaseModel = require('./BaseModel');
const pool = require('../config/database');

class ConversationMessage extends BaseModel {
  constructor() {
    super('conversation_messages');
  }

  /**
   * Create a new conversation message
   * Automatically updates conversation statistics via trigger
   */
  async createMessage(messageData) {
    try {
      const {
        conversationId,
        organizationId,
        direction,
        sentByUserId = null,
        messageType = 'text',
        messageContent,
        mediaUrl = null,
        mediaType = null,
        caption = null,
        filename = null,
        whatsappMessageId = null,
        messageStatus = 'pending',
        templateName = null,
        templateLanguage = null,
        templateParameters = null,
        contextMessageId = null,
        interactiveType = null,
        interactiveData = null,
        from_phone_number = null,
        to_phone_number = null,
        
      } = messageData;

      const result = await pool.query(
        `INSERT INTO ${this.tableName} (
          conversation_id, organization_id, direction, sent_by_user_id,
          message_type, message_content, media_url, media_type, caption, filename,
          whatsapp_message_id, message_status, template_name, template_language,
          template_parameters, reply_to_message_id, interactive_type, interactive_data,
          from_phone_number, to_phone_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *`,
        [
          conversationId, organizationId, direction, sentByUserId,
          messageType, messageContent, mediaUrl, mediaType, caption, filename,
          whatsappMessageId, messageStatus, templateName, templateLanguage,
          templateParameters ? JSON.stringify(templateParameters) : null,
          contextMessageId, interactiveType,
          interactiveData ? JSON.stringify(interactiveData) : null,
          from_phone_number, to_phone_number
        ]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating conversation message: ${error.message}`);
    }
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getByConversation(conversationId, options = {}) {
    try {
      const { limit = 50, offset = 0, order = 'DESC' } = options;

      const result = await pool.query(
        `SELECT * FROM ${this.tableName}
         WHERE conversation_id = $1
         ORDER BY created_at ${order}
         LIMIT $2 OFFSET $3`,
        [conversationId, limit, offset]
      );

      return result.rows;
    } catch (error) {
      throw new Error(`Error getting conversation messages: ${error.message}`);
    }
  }

  /**
   * Count messages in a conversation
   */
  async countByConversation(conversationId) {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) FROM ${this.tableName} WHERE conversation_id = $1`,
        [conversationId]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      throw new Error(`Error counting conversation messages: ${error.message}`);
    }
  }

  /**
   * Update message status (for webhook updates)
   */
  async updateStatus(whatsappMessageId, status, timestamp = null) {
    try {
      const statusField = `${status}_at`;
      const validStatusFields = ['sent_at', 'delivered_at', 'read_at', 'failed_at'];

      let query = `UPDATE ${this.tableName} SET message_status = $1, updated_at = CURRENT_TIMESTAMP`;
      const params = [status, whatsappMessageId];

      if (timestamp && validStatusFields.includes(statusField)) {
        query += `, ${statusField} = $3`;
        params.push(timestamp);
      }

      query += ` WHERE whatsapp_message_id = $2 RETURNING *`;

      const result = await pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating message status: ${error.message}`);
    }
  }

  /**
   * Find message by WhatsApp message ID
   */
  async findByWhatsAppId(whatsappMessageId) {
    try {
      const result = await pool.query(
        `SELECT * FROM ${this.tableName} WHERE whatsapp_message_id = $1`,
        [whatsappMessageId]
      );

      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding message by WhatsApp ID: ${error.message}`);
    }
  }

  /**
   * Get latest message in conversation
   */
  async getLatestMessage(conversationId) {
    try {
      const result = await pool.query(
        `SELECT * FROM ${this.tableName}
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [conversationId]
      );

      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error getting latest message: ${error.message}`);
    }
  }

  /**
   * Mark message as failed
   */
  async markAsFailed(messageId, failureReason) {
    try {
      const result = await pool.query(
        `UPDATE ${this.tableName}
         SET message_status = 'failed', failed_at = CURRENT_TIMESTAMP, failure_reason = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [failureReason, messageId]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error marking message as failed: ${error.message}`);
    }
  }
}

module.exports = new ConversationMessage();

