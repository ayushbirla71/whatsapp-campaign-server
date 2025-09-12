const AWS = require("aws-sdk");
const logger = require("../utils/logger");
const Campaign = require("../models/Campaign");
const Audience = require("../models/Audience");
const Template = require("../models/Template");
const Organization = require("../models/Organization");

class CampaignSchedulerService {
  constructor() {
    this.sqs = new AWS.SQS({
      region: process.env.AWS_REGION || "us-east-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    this.queueUrl = process.env.SQS_QUEUE_URL;
    this.isRunning = false;
    this.checkInterval = parseInt(process.env.SCHEDULER_CHECK_INTERVAL_MS) || 60000; // 1 minute default

    if (!this.queueUrl) {
      throw new Error("SQS_QUEUE_URL environment variable is required");
    }
  }

  async startScheduler() {
    if (this.isRunning) {
      logger.warn("Campaign scheduler is already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting campaign scheduler service", {
      checkInterval: this.checkInterval,
      queueUrl: this.queueUrl,
    });

    // Start the scheduling loop
    this.scheduleLoop();
  }

  async stopScheduler() {
    logger.info("Stopping campaign scheduler service");
    this.isRunning = false;
  }

  async scheduleLoop() {
    while (this.isRunning) {
      try {
        await this.checkAndProcessCampaigns();
        await this.sleep(this.checkInterval);
      } catch (error) {
        logger.error("Error in campaign scheduler loop:", error);
        // Wait longer on error to prevent rapid retries
        await this.sleep(this.checkInterval * 2);
      }
    }
  }

  async checkAndProcessCampaigns() {
    try {
      logger.debug("Checking for campaigns ready to launch");

      // Find campaigns that are asset_generated and scheduled for now or past
      const readyCampaigns = await Campaign.findReadyToLaunch();

      if (readyCampaigns.length === 0) {
        logger.debug("No campaigns ready to launch");
        return;
      }

      logger.info(`Found ${readyCampaigns.length} campaigns ready to launch`);

      for (const campaign of readyCampaigns) {
        try {
          await this.processCampaign(campaign);
        } catch (error) {
          logger.error("Error processing individual campaign", {
            campaignId: campaign.id,
            error: error.message,
          });
        }
      }
    } catch (error) {
      logger.error("Error checking campaigns:", error);
      throw error;
    }
  }

  async processCampaign(campaign) {
    try {
      logger.info("Processing campaign for launch", {
        campaignId: campaign.id,
        organizationId: campaign.organization_id,
        scheduledAt: campaign.scheduled_at,
      });

      // Update campaign status to ready_to_launch
      await Campaign.updateStatus(campaign.id, "ready_to_launch");

      // Get campaign audience
      const audience = await Audience.getCampaignAudience(campaign.id);
      
      if (!audience || audience.length === 0) {
        logger.warn("Campaign has no audience, skipping", {
          campaignId: campaign.id,
        });
        return;
      }

      // Get template details
      const template = await Template.findById(campaign.template_id);
      if (!template) {
        throw new Error(`Template not found for campaign ${campaign.id}`);
      }

      // Get organization details for WhatsApp credentials
      const organization = await Organization.findById(campaign.organization_id);
      if (!organization) {
        throw new Error(`Organization not found for campaign ${campaign.id}`);
      }

      // Process each audience member
      for (const audienceMember of audience) {
        try {
          await this.sendToSQS(campaign, template, organization, audienceMember);
        } catch (error) {
          logger.error("Error sending audience member to SQS", {
            campaignId: campaign.id,
            audienceId: audienceMember.id,
            error: error.message,
          });
        }
      }

      // Update campaign status to running
      await Campaign.updateStatus(campaign.id, "running");

      logger.info("Successfully processed campaign for launch", {
        campaignId: campaign.id,
        audienceCount: audience.length,
      });
    } catch (error) {
      logger.error("Error processing campaign", {
        campaignId: campaign.id,
        error: error.message,
      });
      throw error;
    }
  }

  async sendToSQS(campaign, template, organization, audienceMember) {
    try {
      // Build WhatsApp Business API message body
      const whatsappMessageBody = this.buildWhatsAppMessageBody(
        campaign,
        template,
        organization,
        audienceMember
      );

      // Create SQS message payload
      const sqsMessageBody = {
        campaignId: campaign.id,
        organizationId: campaign.organization_id,
        templateId: template.id,
        audienceId: audienceMember.id,
        messageType: "whatsapp_business_message",
        whatsappMessageBody: whatsappMessageBody,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      // Send to SQS
      const params = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(sqsMessageBody),
        MessageAttributes: {
          campaignId: {
            DataType: "String",
            StringValue: campaign.id,
          },
          organizationId: {
            DataType: "String",
            StringValue: campaign.organization_id,
          },
          messageType: {
            DataType: "String",
            StringValue: "whatsapp_business_message",
          },
        },
      };

      const result = await this.sqs.sendMessage(params).promise();

      logger.debug("Message sent to SQS", {
        messageId: result.MessageId,
        campaignId: campaign.id,
        audienceId: audienceMember.id,
      });

      return result;
    } catch (error) {
      logger.error("Error sending message to SQS", {
        campaignId: campaign.id,
        audienceId: audienceMember.id,
        error: error.message,
      });
      throw error;
    }
  }

  buildWhatsAppMessageBody(campaign, template, organization, audienceMember) {
    try {
      // Build WhatsApp Business API message structure
      const messageBody = {
        messaging_product: "whatsapp",
        to: audienceMember.msisdn,
        type: "template",
        template: {
          name: template.name,
          language: {
            code: template.language || "en",
          },
        },
      };

      // Add template parameters if they exist
      if (template.components && Array.isArray(template.components)) {
        const parameters = this.buildTemplateParameters(
          template.components,
          audienceMember
        );
        
        if (parameters.length > 0) {
          messageBody.template.components = parameters;
        }
      }

      // Add organization-specific WhatsApp credentials
      messageBody._credentials = {
        phoneNumberId: organization.whatsapp_phone_number_id,
        accessToken: organization.whatsapp_access_token,
        businessAccountId: organization.whatsapp_business_account_id,
      };

      // Add campaign tracking information
      messageBody._tracking = {
        campaignId: campaign.id,
        organizationId: campaign.organization_id,
        templateId: template.id,
        audienceId: audienceMember.id,
        generatedAssetUrls: audienceMember.generated_asset_urls,
      };

      return messageBody;
    } catch (error) {
      logger.error("Error building WhatsApp message body", {
        campaignId: campaign.id,
        templateId: template.id,
        error: error.message,
      });
      throw error;
    }
  }

  buildTemplateParameters(components, audienceMember) {
    const parameters = [];

    try {
      components.forEach((component, index) => {
        if (component.type === "HEADER" && component.format !== "TEXT") {
          // Handle media headers (IMAGE, VIDEO, DOCUMENT)
          if (audienceMember.generated_asset_urls) {
            const assetUrls = JSON.parse(audienceMember.generated_asset_urls);
            const mediaUrl = assetUrls[component.format.toLowerCase()];
            
            if (mediaUrl) {
              parameters.push({
                type: "header",
                parameters: [
                  {
                    type: component.format.toLowerCase(),
                    [component.format.toLowerCase()]: {
                      link: mediaUrl,
                    },
                  },
                ],
              });
            }
          }
        } else if (component.type === "BODY" && component.text) {
          // Handle body text parameters
          const bodyParams = this.extractParametersFromText(
            component.text,
            audienceMember
          );
          
          if (bodyParams.length > 0) {
            parameters.push({
              type: "body",
              parameters: bodyParams,
            });
          }
        }
      });

      return parameters;
    } catch (error) {
      logger.error("Error building template parameters", {
        error: error.message,
        audienceId: audienceMember.id,
      });
      return [];
    }
  }

  extractParametersFromText(text, audienceMember) {
    const parameters = [];
    
    try {
      // Find all {{n}} placeholders in the text
      const placeholderRegex = /\{\{(\d+)\}\}/g;
      const matches = [...text.matchAll(placeholderRegex)];
      
      matches.forEach((match) => {
        const paramNumber = parseInt(match[1]);
        let value = "";

        // Map parameter numbers to audience attributes
        switch (paramNumber) {
          case 1:
            value = audienceMember.name || "";
            break;
          default:
            // Try to get from custom attributes
            if (audienceMember.attributes) {
              const attrs = JSON.parse(audienceMember.attributes);
              value = attrs[`param_${paramNumber}`] || attrs[`parameter_${paramNumber}`] || "";
            }
            break;
        }

        parameters.push({
          type: "text",
          text: value,
        });
      });

      return parameters;
    } catch (error) {
      logger.error("Error extracting parameters from text", {
        error: error.message,
        text: text,
      });
      return [];
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Health check method
  async getSchedulerStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      queueUrl: this.queueUrl,
      lastCheck: new Date().toISOString(),
    };
  }
}

module.exports = new CampaignSchedulerService();
