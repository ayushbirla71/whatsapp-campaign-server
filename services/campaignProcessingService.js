const Campaign = require("../models/Campaign");
const Audience = require("../models/Audience");
const Template = require("../models/Template");
const sqsService = require("./sqsService");
const campaignMessageGenerator = require("./campaignMessageGenerator");
const logger = require("../utils/logger");

class CampaignProcessingService {
  constructor() {
    this.isProcessing = false;
    this.batchSize = parseInt(process.env.CAMPAIGN_BATCH_SIZE) || 10;
    this.processingInterval =
      parseInt(process.env.CAMPAIGN_PROCESSING_INTERVAL) || 30000; // 30 seconds
  }

  /**
   * Start the campaign processing service
   */
  start() {
    if (this.isProcessing) {
      logger.warn("Campaign processing service is already running");
      return;
    }

    this.isProcessing = true;
    logger.info("Starting campaign processing service", {
      batchSize: this.batchSize,
      processingInterval: this.processingInterval,
    });

    this.processLoop();
  }

  /**
   * Stop the campaign processing service
   */
  stop() {
    this.isProcessing = false;
    logger.info("Campaign processing service stopped");
  }

  /**
   * Main processing loop
   */
  async processLoop() {
    while (this.isProcessing) {
      try {
        await this.processCampaigns();
      } catch (error) {
        logger.error("Error in campaign processing loop", {
          error: error.message,
        });
      }

      // Wait before next iteration
      await this.sleep(this.processingInterval);
    }
  }

  /**
   * Process campaigns that are ready for message generation
   */
  async processCampaigns() {
    try {
      // Check if SQS is configured
      // const isSQSConfigured = await sqsService.isConfigured();
      // if (!isSQSConfigured) {
      //   logger.warn('SQS service not configured, skipping campaign processing');
      //   return;
      // }

      // Find campaigns with 'asset_generated' status
      const campaigns = await this.getCampaignsReadyForProcessing();

      if (campaigns.length === 0) {
        logger.debug("No campaigns ready for processing");
        return;
      }

      logger.info("Found campaigns ready for processing", {
        campaignCount: campaigns.length,
      });

      // Process each campaign
      for (const campaign of campaigns) {
        await this.processCampaign(campaign);
      }
    } catch (error) {
      logger.error("Error processing campaigns", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get campaigns that are ready for processing (asset_generated status)
   * @returns {Array} Array of campaigns
   */
  async getCampaignsReadyForProcessing() {
    try {
      const query = `
        SELECT c.*, t.name as template_name, t.category as template_category,
               t.language as template_language, t.components, t.body_text,
               t.header_type, t.header_media_url, t.footer_text, t.parameters
        FROM campaigns c
        LEFT JOIN templates t ON c.template_id = t.id
        WHERE c.status = 'asset_generated'
        AND c.total_targeted_audience > 0
        ORDER BY c.created_at ASC
        LIMIT $1
      `;

      const result = await Campaign.pool.query(query, [this.batchSize]);
      return result.rows;
    } catch (error) {
      logger.error("Error fetching campaigns ready for processing", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process a single campaign
   * @param {Object} campaign - Campaign data with template information
   */
  async processCampaign(campaign) {
    try {
      logger.info("Processing campaign", {
        campaignId: campaign.id,
        campaignName: campaign.name,
        totalAudience: campaign.total_targeted_audience,
      });

      // Update campaign status to ready_to_launch
      await Campaign.update(campaign.id, {
        status: "ready_to_launch",
      });

      // Get campaign audience specifically for processing
      const audienceList = await this.getCampaignAudienceForProcessing(
        campaign.id
      );

      if (audienceList.length === 0) {
        logger.warn("No pending audience found for campaign processing", {
          campaignId: campaign.id,
        });
        return;
      }

      logger.info("Found audience members for processing", {
        campaignId: campaign.id,
        pendingAudienceCount: audienceList.length,
      });

      // Prepare template data
      const template = {
        id: campaign.template_id,
        name: campaign.template_name,
        category: campaign.template_category,
        language: campaign.template_language,
        components: this.parseComponents(campaign.components),
        body_text: campaign.body_text,
        header_type: campaign.header_type,
        header_media_url: campaign.header_media_url,
        footer_text: campaign.footer_text,
        parameters: campaign.parameters,
      };

      // Generate and send messages to SQS
      await this.generateAndSendMessages(campaign, template, audienceList);

      logger.info("Campaign processing completed", {
        campaignId: campaign.id,
        messagesGenerated: audienceList.length,
      });
    } catch (error) {
      logger.error("Error processing campaign", {
        campaignId: campaign.id,
        error: error.message,
      });

      // Update campaign status back to asset_generated for retry
      await Campaign.update(campaign.id, {
        status: "asset_generated",
      });

      throw error;
    }
  }

  /**
   * Get campaign audience specifically for processing (no replies, optimized for message generation)
   * @param {string} campaignId - Campaign ID
   * @returns {Array} Array of audience data for processing
   */
  async getCampaignAudienceForProcessing(campaignId) {
    try {
      const query = `
        SELECT ca.id, ca.campaign_id, ca.organization_id, ca.name, ca.msisdn, 
               ca.attributes, ca.message_status, ca.created_at, ca.generated_asset_urls
        FROM campaign_audience ca
        WHERE ca.campaign_id = $1
        AND ca.message_status = 'pending'
        ORDER BY ca.created_at ASC
      `;

      const result = await Audience.pool.query(query, [campaignId]);

      // Parse attributes JSON for each audience member
      return result.rows.map((row) => ({
        ...row,
        attributes: this.parseAttributes(row.attributes),
        generated_asset_urls: this.parseAttributes(row.generated_asset_urls),
      }));
    } catch (error) {
      logger.error("Error fetching campaign audience for processing", {
        campaignId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get campaign audience for external APIs (includes replies and full data)
   * @param {string} campaignId - Campaign ID
   * @returns {Array} Array of audience data with replies
   */
  async getCampaignAudience(campaignId) {
    try {
      const query = `
        SELECT ca.id, ca.campaign_id, ca.organization_id, ca.name, ca.msisdn, ca.attributes,
               ca.message_status, ca.created_at, ca.generated_asset_urls,
               im.content as reply_message,
               im.timestamp as reply_timestamp,
               im.message_type as reply_message_type
        FROM campaign_audience ca
        LEFT JOIN incoming_messages im ON ca.msisdn = im.from_phone_number 
                                      AND im.context_campaign_id = ca.campaign_id
        WHERE ca.campaign_id = $1
        ORDER BY ca.created_at ASC
      `;

      const result = await Audience.pool.query(query, [campaignId]);

      // Parse attributes JSON for each audience member
      return result.rows.map((row) => ({
        ...row,
        attributes: this.parseAttributes(row.attributes),
        generated_asset_urls: this.parseAttributes(row.generated_asset_urls),
        reply_message: row.reply_message || null,
        reply_timestamp: row.reply_timestamp || null,
        reply_message_type: row.reply_message_type || null,
      }));
    } catch (error) {
      logger.error("Error fetching campaign audience", {
        campaignId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate messages and send them to SQS
   * @param {Object} campaign - Campaign data
   * @param {Object} template - Template data
   * @param {Array} audienceList - List of audience members
   */
  async generateAndSendMessages(campaign, template, audienceList) {
    try {
      const messages = [];
      const sqsBatchSize = 10; // SQS batch limit

      for (const audienceData of audienceList) {
        try {
          // Generate message payload
          const messagePayload = campaignMessageGenerator.generateMessage(
            campaign,
            template,
            audienceData
          );

          // Validate message payload
          if (
            !campaignMessageGenerator.validateMessagePayload(messagePayload)
          ) {
            logger.warn("Invalid message payload generated", {
              campaignId: campaign.id,
              audienceId: audienceData.id,
            });
            continue;
          }

          messages.push(messagePayload);

          // Update audience status to ready_to_send
          await Audience.updateMessageStatus(audienceData.id, "ready_to_send");
          console.log("Message payload:", messagePayload);

          console.log("Messages payload:", messagePayload.templateParameters);

          // Send batch when we reach the limit
          if (messages.length >= sqsBatchSize) {
            await this.sendMessageBatch(messages);
            messages.length = 0; // Clear the array
          }
        } catch (error) {
          logger.error("Error generating message for audience", {
            campaignId: campaign.id,
            audienceId: audienceData.id,
            error: error.message,
          });

          // Update audience status to failed
          await Audience.updateMessageStatus(audienceData.id, "failed", {
            failure_reason: error.message,
          });
        }
      }

      // Send remaining messages
      if (messages.length > 0) {
        await this.sendMessageBatch(messages);
      }
    } catch (error) {
      logger.error("Error generating and sending messages", {
        campaignId: campaign.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send a batch of messages to SQS
   * @param {Array} messages - Array of message payloads
   */
  async sendMessageBatch(messages) {
    console.log("Sending message batch to SQS", {
      messageCount: messages.length,
    });
    console.log("Message payload:", messages);
    try {
      const result = await sqsService.sendMessageBatch(messages, {
        messageGroupId: process.env.SQS_MESSAGE_GROUP_ID || "whatsapp-messages",
      });

      logger.info("Message batch sent to SQS", {
        successful: result.Successful?.length || 0,
        failed: result.Failed?.length || 0,
      });

      return result;
    } catch (error) {
      logger.error("Error sending message batch to SQS", {
        messageCount: messages.length,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Parse JSON components safely
   * @param {string|Object} components - Components data
   * @returns {Array|null} Parsed components
   */
  parseComponents(components) {
    if (!components) return null;

    if (typeof components === "string") {
      try {
        return JSON.parse(components);
      } catch (error) {
        logger.warn("Failed to parse template components", {
          error: error.message,
        });
        return null;
      }
    }

    return components;
  }

  /**
   * Parse JSON attributes safely
   * @param {string|Object} attributes - Attributes data
   * @returns {Object} Parsed attributes
   */
  parseAttributes(attributes) {
    if (!attributes) return {};

    if (typeof attributes === "string") {
      try {
        return JSON.parse(attributes);
      } catch (error) {
        logger.warn("Failed to parse audience attributes", {
          error: error.message,
        });
        return {};
      }
    }

    return attributes;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new CampaignProcessingService();
