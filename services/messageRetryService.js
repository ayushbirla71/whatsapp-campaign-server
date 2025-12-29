const logger = require("../utils/logger");
const Message = require("../models/Message");
const sqsService = require("./sqsService");
const campaignMessageGenerator = require("./campaignMessageGenerator");

class MessageRetryService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.retryInterval = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    // this.retryInterval = 10000; // 10 seconds for testing
    this.maxRetryCount = parseInt(process.env.MAX_MESSAGE_RETRY_COUNT) || 3;
    this.retryAfterHours = parseInt(process.env.MESSAGE_RETRY_AFTER_HOURS) || 2;
  }

  /**
   * Start the message retry service
   */
  start() {
    if (this.isRunning) {
      logger.warn("Message retry service is already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting message retry service", {
      retryInterval: this.retryInterval,
      maxRetryCount: this.maxRetryCount,
      retryAfterHours: this.retryAfterHours,
    });

    // Run immediately on start
    this.processFailedMessages();

    // Set up periodic retry processing
    this.intervalId = setInterval(() => {
      this.processFailedMessages();
    }, this.retryInterval);

    // Handle graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Stop the message retry service
   */
  stop() {
    if (!this.isRunning) {
      logger.warn("Message retry service is not running");
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info("Message retry service stopped");
  }

  /**
   * Process failed messages and resend them to SQS
   */
  async processFailedMessages() {
    try {
      logger.info("Starting failed message retry processing");

      // Find failed messages that are eligible for retry
      const failedMessages = await this.findFailedMessagesForRetry();

      if (failedMessages.length === 0) {
        logger.info("No failed messages found for retry");
        return;
      }

      logger.info(`Found ${failedMessages.length} failed messages for retry`);

      // Process messages in batches
      const batchSize = 10; // SQS batch limit
      const batches = this.chunkArray(failedMessages, batchSize);

      let totalProcessed = 0;
      let totalSuccessful = 0;
      let totalFailed = 0;

      for (const batch of batches) {
        try {
          logger.info(`Processing batch of ${batch.length} messages`);
          const result = await this.processBatch(batch);
          totalProcessed += batch.length;
          totalSuccessful += result.successful;
          totalFailed += result.failed;
        } catch (error) {
          logger.error("Error processing batch", {
            batchSize: batch.length,
            error: error.message,
          });
          totalFailed += batch.length;
        }
      }

      logger.info("Failed message retry processing completed", {
        totalProcessed,
        totalSuccessful,
        totalFailed,
      });
    } catch (error) {
      logger.error("Error during failed message retry processing", {
        error: error.message,
      });
    }
  }

  /**
   * Find failed messages that are eligible for retry
   * @returns {Promise<Array>} Array of failed messages
   */
  async findFailedMessagesForRetry() {
    try {
      const result = await Message.findFailedMessagesForRetry(
        this.maxRetryCount,
        0, // Pass 0 since we'll handle timing logic here
        100
      );

      // Parse messages - filtering now done in SQL query using next_retry_at
      const eligibleMessages = result.map((row) =>
        this.parseMessageForRetry(row)
      );

      logger.info("Found eligible messages for retry", {
        count: eligibleMessages.length,
        retryableOnly: true,
      });

      return eligibleMessages;
    } catch (error) {
      throw new Error(
        `Error finding failed messages for retry: ${error.message}`
      );
    }
  }

  /**
   * Process a batch of failed messages
   * @param {Array} messages - Array of failed messages
   * @returns {Promise<Object>} Processing result
   */
  async processBatch(messages) {
    try {
      const sqsMessages = [];
      const messageUpdates = [];

      for (const message of messages) {
        try {
          // Generate SQS message payload
          const sqsPayload = await this.generateRetryPayload(message);

          if (sqsPayload) {
            sqsMessages.push(sqsPayload);
            messageUpdates.push({
              id: message.id,
              retry_count: message.retry_count + 1,
              message_status: "pending",
            });
          }
        } catch (error) {
          logger.error("Error generating retry payload for message", {
            messageId: message.id,
            error: error.message,
          });

          // Mark message as permanently failed if max retries reached
          if (message.retry_count >= this.maxRetryCount - 1) {
            messageUpdates.push({
              id: message.id,
              retry_count: message.retry_count + 1,
              message_status: "failed",
              failure_reason: `Max retry attempts reached: ${error.message}`,
            });
          }
        }
      }

      let successful = 0;
      let failed = 0;

      // Send messages to SQS if any were generated
      if (sqsMessages.length > 0) {
        try {
          const sqsResult = await sqsService.sendMessageBatch(sqsMessages, {
            messageGroupId:
              process.env.SQS_MESSAGE_GROUP_ID || "whatsapp-retry-messages",
          });

          successful = sqsResult.Successful?.length || 0;
          failed = sqsResult.Failed?.length || 0;

          logger.info("Retry messages sent to SQS", {
            successful,
            failed,
            totalMessages: sqsMessages.length,
          });
        } catch (error) {
          logger.error("Error sending retry messages to SQS", {
            messageCount: sqsMessages.length,
            error: error.message,
          });
          failed = sqsMessages.length;
        }
      }

      // Update message retry counts and statuses
      for (const update of messageUpdates) {
        try {
          await this.updateMessageRetryStatus(update);
        } catch (error) {
          logger.error("Error updating message retry status", {
            messageId: update.id,
            error: error.message,
          });
        }
      }

      return { successful, failed };
    } catch (error) {
      throw new Error(`Error processing batch: ${error.message}`);
    }
  }

  /**
   * Generate retry payload for SQS
   * @param {Object} message - Failed message data
   * @returns {Promise<Object|null>} SQS payload or null if cannot generate
   */
  async generateRetryPayload(message) {
    try {
      // Reconstruct campaign and template data
      const campaign = {
        id: message.campaign_id,
        organization_id: message.organization_id,
        template_id: message.template_id,
      };

      // Helper function to safely parse JSON fields
      const parseJsonField = (field, defaultValue = {}) => {
        if (!field) return defaultValue;
        if (typeof field === "string") {
          try {
            return JSON.parse(field);
          } catch (error) {
            logger.warn(`Failed to parse JSON field: ${error.message}`);
            return defaultValue;
          }
        }
        return field; // Already an object
      };

      logger.info("Processing message for retry", {
        messageId: message.id,
        campaignId: message.campaign_id,
        templateName: message.template_name,
        componentsType: typeof message.components,
      });

      const template = {
        id: message.template_id,
        name: message.template_name,
        category: message.template_category,
        language: message.template_language,
        components: parseJsonField(message.components, []),
        body_text: message.body_text,
        header_type: message.header_type,
        header_media_url: message.header_media_url,
        footer_text: message.footer_text,
        parameters: parseJsonField(message.parameters, {}),
      };

      const audienceData = {
        id: message.campaign_audience_id,
        name: message.audience_name,
        msisdn: message.msisdn || message.to_number,
        attributes: parseJsonField(message.attributes, {}),
        generated_asset_urls: parseJsonField(message.generated_asset_urls, {}),
      };

      logger.info("Reconstructed campaign, template, and audience data", {
        campaign,
        template,
        audienceData,
      });
      // Generate message payload using the same generator
      const messagePayload = campaignMessageGenerator.generateMessage(
        campaign,
        template,
        audienceData
      );

      // Validate the payload
      if (!campaignMessageGenerator.validateMessagePayload(messagePayload)) {
        throw new Error("Invalid message payload generated for retry");
      }

      logger.info("Retry payload generated successfully", {
        messageId: message.id,
        payload: messagePayload,
      });

      return messagePayload;
    } catch (error) {
      logger.error("Error generating retry payload", {
        messageId: message.id,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Update message retry status in database
   * @param {Object} update - Update data
   */
  async updateMessageRetryStatus(update) {
    try {
      await Message.updateRetryStatus(
        update.id,
        update.retry_count,
        update.message_status,
        update.failure_reason || null
      );

      logger.debug("Message retry status updated", {
        messageId: update.id,
        retryCount: update.retry_count,
        status: update.message_status,
      });
    } catch (error) {
      throw new Error(`Error updating message retry status: ${error.message}`);
    }
  }

  /**
   * Parse message row for retry processing
   * @param {Object} row - Database row
   * @returns {Object} Parsed message
   */
  parseMessageForRetry(row) {
    return {
      id: row.id,
      campaign_id: row.campaign_id,
      campaign_audience_id: row.campaign_audience_id,
      organization_id: row.organization_id,
      template_id: row.template_id,
      template_name: row.template_name,
      template_category: row.template_category,
      template_language: row.template_language,
      components: row.components,
      body_text: row.body_text,
      header_type: row.header_type,
      header_media_url: row.header_media_url,
      footer_text: row.footer_text,
      parameters: row.parameters,
      attributes: row.attributes,
      generated_asset_urls: row.generated_asset_urls,
      audience_name: row.audience_name,
      msisdn: row.msisdn,
      to_number: row.to_number,
      retry_count: row.retry_count || 0,
      message_status: row.message_status,
      updated_at: row.updated_at,
    };
  }

  /**
   * Split array into chunks
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} Array of chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const gracefulShutdown = (signal) => {
      logger.info(
        `Received ${signal}, shutting down message retry service gracefully`
      );
      this.stop();
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
    process.on("SIGUSR2", gracefulShutdown); // For nodemon
  }

  /**
   * Get service status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      retryInterval: this.retryInterval,
      maxRetryCount: this.maxRetryCount,
      retryAfterHours: this.retryAfterHours,
    };
  }

  /**
   * Manually trigger failed message processing
   * @returns {Promise<void>}
   */
  async triggerRetryProcessing() {
    try {
      logger.info("Manually triggering failed message retry processing");
      await this.processFailedMessages();
      logger.info("Manual retry processing completed");
    } catch (error) {
      logger.error("Error during manual retry processing", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get retry delay based on retry count (DEPRECATED - now handled in Lambda)
   * Kept for backward compatibility
   * @param {number} retryCount - Current retry count
   * @returns {number} Delay in hours
   */
  getRetryDelayHours(retryCount) {
    const delays = [12, 24, 48]; // 12h for 1st retry, 24h for 2nd, 48h for 3rd
    return delays[retryCount] || 48; // Default to 48h if beyond defined delays
  }

  /**
   * Check if message is eligible for retry (DEPRECATED - now handled in SQL query)
   * Eligibility is now determined by next_retry_at field in database
   * Kept for backward compatibility
   * @param {Object} message - Message object
   * @returns {boolean} Whether message is eligible for retry
   */
  isEligibleForRetry(message) {
    // If next_retry_at is set, use it
    if (message.next_retry_at) {
      const now = new Date();
      const nextRetry = new Date(message.next_retry_at);
      return now >= nextRetry;
    }

    // Fallback to old logic for messages without next_retry_at
    const now = new Date();
    const updatedAt = new Date(message.updated_at);
    const retryDelayHours = this.getRetryDelayHours(message.retry_count);
    const delayMs = retryDelayHours * 60 * 60 * 1000;

    return now - updatedAt >= delayMs;
  }
}

module.exports = new MessageRetryService();
