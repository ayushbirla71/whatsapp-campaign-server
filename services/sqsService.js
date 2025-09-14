const AWS = require('aws-sdk');
const logger = require('../utils/logger');

class SQSService {
  constructor() {
    // Configure AWS SDK
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.sqs = new AWS.SQS();
    this.queueUrl = process.env.AWS_SQS_QUEUE_URL;
  }

  /**
   * Send a message to SQS queue
   * @param {Object} messageBody - The message payload to send
   * @param {Object} options - Additional SQS options
   * @returns {Promise<Object>} SQS send message result
   */
  async sendMessage(messageBody, options = {}) {
    try {
      const params = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(messageBody),
        DelaySeconds: options.delaySeconds || 0,
        MessageAttributes: options.messageAttributes || {},
        MessageGroupId: options.messageGroupId, // For FIFO queues
        MessageDeduplicationId: options.messageDeduplicationId // For FIFO queues
      };

      // Remove undefined properties
      Object.keys(params).forEach(key => {
        if (params[key] === undefined) {
          delete params[key];
        }
      });

      const result = await this.sqs.sendMessage(params).promise();
      
      logger.info('Message sent to SQS successfully', {
        messageId: result.MessageId,
        queueUrl: this.queueUrl,
        messageBodySize: JSON.stringify(messageBody).length
      });

      return result;
    } catch (error) {
      logger.error('Error sending message to SQS', {
        error: error.message,
        queueUrl: this.queueUrl,
        messageBody: JSON.stringify(messageBody).substring(0, 500) // Log first 500 chars
      });
      throw new Error(`Failed to send message to SQS: ${error.message}`);
    }
  }

  /**
   * Send multiple messages to SQS queue in batch
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Additional SQS options
   * @returns {Promise<Object>} SQS batch send result
   */
  async sendMessageBatch(messages, options = {}) {
    try {
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages must be a non-empty array');
      }

      if (messages.length > 10) {
        throw new Error('SQS batch send supports maximum 10 messages');
      }

      const entries = messages.map((message, index) => ({
        Id: `msg-${index}-${Date.now()}`,
        MessageBody: JSON.stringify(message),
        DelaySeconds: options.delaySeconds || 0,
        MessageAttributes: options.messageAttributes || {},
        MessageGroupId: options.messageGroupId,
        MessageDeduplicationId: options.messageDeduplicationId ? 
          `${options.messageDeduplicationId}-${index}` : undefined
      }));

      // Remove undefined properties from each entry
      entries.forEach(entry => {
        Object.keys(entry).forEach(key => {
          if (entry[key] === undefined) {
            delete entry[key];
          }
        });
      });

      const params = {
        QueueUrl: this.queueUrl,
        Entries: entries
      };

      const result = await this.sqs.sendMessageBatch(params).promise();
      
      logger.info('Batch messages sent to SQS successfully', {
        successful: result.Successful?.length || 0,
        failed: result.Failed?.length || 0,
        queueUrl: this.queueUrl,
        totalMessages: messages.length
      });

      if (result.Failed && result.Failed.length > 0) {
        logger.warn('Some messages failed to send in batch', {
          failedMessages: result.Failed
        });
      }

      return result;
    } catch (error) {
      logger.error('Error sending batch messages to SQS', {
        error: error.message,
        queueUrl: this.queueUrl,
        messageCount: messages.length
      });
      throw new Error(`Failed to send batch messages to SQS: ${error.message}`);
    }
  }

  /**
   * Create SQS queue if it doesn't exist
   * @param {string} queueName - Name of the queue to create
   * @param {Object} attributes - Queue attributes
   * @returns {Promise<string>} Queue URL
   */
  async createQueue(queueName, attributes = {}) {
    try {
      const params = {
        QueueName: queueName,
        Attributes: {
          VisibilityTimeoutSeconds: '300',
          MessageRetentionPeriod: '1209600', // 14 days
          ReceiveMessageWaitTimeSeconds: '20', // Long polling
          ...attributes
        }
      };

      const result = await this.sqs.createQueue(params).promise();
      
      logger.info('SQS queue created successfully', {
        queueName,
        queueUrl: result.QueueUrl
      });

      return result.QueueUrl;
    } catch (error) {
      logger.error('Error creating SQS queue', {
        error: error.message,
        queueName
      });
      throw new Error(`Failed to create SQS queue: ${error.message}`);
    }
  }

  /**
   * Get queue attributes
   * @param {string} queueUrl - Queue URL (optional, uses default if not provided)
   * @returns {Promise<Object>} Queue attributes
   */
  async getQueueAttributes(queueUrl = null) {
    try {
      const params = {
        QueueUrl: queueUrl || this.queueUrl,
        AttributeNames: ['All']
      };

      const result = await this.sqs.getQueueAttributes(params).promise();
      
      return result.Attributes;
    } catch (error) {
      logger.error('Error getting queue attributes', {
        error: error.message,
        queueUrl: queueUrl || this.queueUrl
      });
      throw new Error(`Failed to get queue attributes: ${error.message}`);
    }
  }

  /**
   * Check if SQS service is properly configured
   * @returns {Promise<boolean>} True if configured correctly
   */
  async isConfigured() {
    try {
      if (!this.queueUrl) {
        logger.warn('SQS queue URL not configured');
        return false;
      }

      // Test by getting queue attributes
      await this.getQueueAttributes();
      return true;
    } catch (error) {
      logger.error('SQS service not properly configured', {
        error: error.message
      });
      return false;
    }
  }
}

module.exports = new SQSService();
