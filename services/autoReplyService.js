const logger = require("../utils/logger");
const IncomingMessage = require("../models/IncomingMessage");
const Template = require("../models/Template");
const Campaign = require("../models/Campaign");
const sqsService = require("./sqsService");
const autoReplyMessageGenerator = require("./autoReplyMessageGenerator");

class AutoReplyService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 1 * 60 * 1000; // 1 minute in milliseconds
  }

  /**
   * Start the auto reply service
   */
  start() {
    if (this.isRunning) {
      logger.warn("Auto reply service is already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting auto reply service", {
      checkInterval: this.checkInterval,
    });

    // Run immediately on start
    this.processPendingAutoReplies();

    // Set up periodic processing
    this.intervalId = setInterval(() => {
      this.processPendingAutoReplies();
    }, this.checkInterval);

    // Handle graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Stop the auto reply service
   */
  stop() {
    if (!this.isRunning) {
      logger.warn("Auto reply service is not running");
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info("Auto reply service stopped");
  }

  /**
   * Process pending auto replies
   */
  async processPendingAutoReplies() {
    try {
      logger.info("Starting auto reply processing");

      // Find incoming messages that need auto replies
      const pendingMessages = await this.findPendingAutoReplyMessages();

      if (pendingMessages.length === 0) {
        logger.debug("No pending auto reply messages found");
        return;
      }

      logger.info(
        `Found ${pendingMessages.length} messages pending auto reply`
      );

      let totalProcessed = 0;
      let totalSuccessful = 0;
      let totalFailed = 0;

      for (const message of pendingMessages) {
        try {
          await this.processAutoReply(message);
          totalSuccessful++;
        } catch (error) {
          logger.error("Error processing auto reply", {
            messageId: message.id,
            error: error.message,
          });

          // Update status to failed
          await this.updateAutoReplyStatus(message.id, "failed");
          totalFailed++;
        }
        totalProcessed++;
      }

      logger.info("Auto reply processing completed", {
        totalProcessed,
        totalSuccessful,
        totalFailed,
      });
    } catch (error) {
      logger.error("Error in auto reply processing", {
        error: error.message,
      });
    }
  }

  /**
   * Find incoming messages that need auto replies
   */
  async findPendingAutoReplyMessages() {
    try {
      const query = `
        SELECT im.*, t.name as template_name, t.body_text, t.components, 
               t.category, t.language, t.header_type, t.header_media_url, 
               t.footer_text, t.parameters
        FROM incoming_messages im
        JOIN templates t ON im.auto_reply_message_id = t.id
        WHERE im.is_auto_reply = true 
        AND im.send_auto_reply_message = 'pending'
        AND t.approved_by_admin = 'approved'
        AND t.is_auto_reply_template = false
        ORDER BY im.created_at ASC
        LIMIT 50
      `;

      const result = await IncomingMessage.pool.query(query);
      return result.rows;
    } catch (error) {
      throw new Error(
        `Error finding pending auto reply messages: ${error.message}`
      );
    }
  }

  /**
   * Process a single auto reply message
   */
  async processAutoReply(incomingMessage) {
    try {
      logger.info("Processing auto reply", {
        messageId: incomingMessage.id,
        fromPhone: incomingMessage.from_phone_number,
        templateId: incomingMessage.auto_reply_message_id,
      });

      // Generate auto reply payload
      const autoReplyPayload = await this.generateAutoReplyPayload(
        incomingMessage
      );

      if (!autoReplyPayload) {
        throw new Error("Failed to generate auto reply payload");
      }

      console.log("Auto reply payload:", autoReplyPayload);

      // Send to SQS
      await this.sendAutoReplyToSQS(autoReplyPayload);

      // // Update status to sent
      await this.updateAutoReplyStatus(incomingMessage.id, "sent");

      logger.info("Auto reply sent successfully", {
        messageId: incomingMessage.id,
        fromPhone: incomingMessage.from_phone_number,
      });
    } catch (error) {
      logger.error("Error processing auto reply", {
        messageId: incomingMessage.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate auto reply payload for SQS
   */
  async generateAutoReplyPayload(incomingMessage) {
    try {
      // Create auto reply template object from the joined data
      const autoReplyTemplate = {
        id: incomingMessage.auto_reply_message_id,
        name: incomingMessage.template_name,
        category: incomingMessage.category,
        language: incomingMessage.language,
        components:
          typeof incomingMessage.components === "string"
            ? JSON.parse(incomingMessage.components)
            : incomingMessage.components,
        body_text: incomingMessage.body_text,
        header_type: incomingMessage.header_type,
        header_media_url: incomingMessage.header_media_url,
        footer_text: incomingMessage.footer_text,
        parameters:
          typeof incomingMessage.parameters === "string"
            ? JSON.parse(incomingMessage.parameters)
            : incomingMessage.parameters,
      };

      const audienceData = await this.getAudienceDataFromCampaign(
        incomingMessage.from_phone_number,
        incomingMessage.context_campaign_id
      );

      if (!audienceData) {
        throw new Error("Audience data not found for auto reply");
      }

      // Generate auto reply message payload using dedicated auto reply generator
      const messagePayload = autoReplyMessageGenerator.generateAutoReplyMessage(
        autoReplyTemplate,
        audienceData,
        incomingMessage
      );

      // Validate the auto reply payload
      if (
        !autoReplyMessageGenerator.validateAutoReplyMessagePayload(
          messagePayload
        )
      ) {
        throw new Error("Invalid auto reply payload generated");
      }

      logger.info("Auto reply payload generated successfully", {
        messageId: incomingMessage.id,
        autoReplyTemplateId: autoReplyTemplate.id,
        autoReplyTemplateName: autoReplyTemplate.name,
        toPhone: audienceData.msisdn,
      });

      return messagePayload;
    } catch (error) {
      logger.error("Error generating auto reply payload", {
        messageId: incomingMessage.id,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Send auto reply to SQS
   */
  async sendAutoReplyToSQS(payload) {
    try {
      const result = await sqsService.sendMessage(payload, {
        messageGroupId:
          process.env.SQS_MESSAGE_GROUP_ID || "whatsapp-auto-replies",
      });

      logger.info("Auto reply sent to SQS", {
        messageId: result.MessageId,
        toPhone: payload.to,
      });

      return result;
    } catch (error) {
      logger.error("Error sending auto reply to SQS", {
        toPhone: payload.to,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update auto reply status
   */
  async updateAutoReplyStatus(messageId, status) {
    try {
      const query = `
        UPDATE incoming_messages 
        SET send_auto_reply_message = $1, updated_at = NOW()
        WHERE id = $2
      `;

      await IncomingMessage.pool.query(query, [status, messageId]);

      logger.debug("Auto reply status updated", {
        messageId,
        status,
      });
    } catch (error) {
      throw new Error(`Error updating auto reply status: ${error.message}`);
    }
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = () => {
      logger.info("Shutting down auto reply service gracefully...");
      this.stop();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }

  /**
   * Manually trigger auto reply processing
   */
  async triggerAutoReplyProcessing() {
    try {
      logger.info("Manually triggering auto reply processing");
      await this.processPendingAutoReplies();
      logger.info("Manual auto reply processing completed");
    } catch (error) {
      logger.error("Error during manual auto reply processing", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get audience data from campaign_audience table
   */
  async getAudienceDataFromCampaign(phoneNumber, campaignId) {
    try {
      const query = `
        SELECT ca.id, ca.campaign_id, ca.organization_id, ca.name, ca.msisdn, 
               ca.attributes, ca.message_status, ca.generated_asset_urls
        FROM campaign_audience ca
        WHERE ca.campaign_id = $1 
        AND (ca.msisdn = $2 OR ca.msisdn = $3 OR REPLACE(ca.msisdn, '+', '') = $4)
        LIMIT 1
      `;

      const normalizedPhone = phoneNumber.startsWith("+")
        ? phoneNumber
        : `+${phoneNumber}`;
      const phoneWithoutPlus = phoneNumber.replace("+", "");

      const result = await IncomingMessage.pool.query(query, [
        campaignId,
        phoneNumber,
        normalizedPhone,
        phoneWithoutPlus,
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      const audienceData = result.rows[0];

      // Parse JSON fields
      return {
        ...audienceData,
        attributes:
          typeof audienceData.attributes === "string"
            ? JSON.parse(audienceData.attributes)
            : audienceData.attributes,
        generated_asset_urls:
          typeof audienceData.generated_asset_urls === "string"
            ? JSON.parse(audienceData.generated_asset_urls)
            : audienceData.generated_asset_urls,
      };
    } catch (error) {
      logger.error("Error getting audience data from campaign", {
        phoneNumber,
        campaignId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new AutoReplyService();
