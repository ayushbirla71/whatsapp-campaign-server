const campaignProcessingService = require('./campaignProcessingService');
const logger = require('../utils/logger');

class BackgroundJobProcessor {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processingInterval = parseInt(process.env.BACKGROUND_JOB_INTERVAL) || 60000; // 1 minute default
  }

  /**
   * Start the background job processor
   */
  start() {
    if (this.isRunning) {
      logger.warn('Background job processor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting background job processor', {
      processingInterval: this.processingInterval
    });

    // Start the campaign processing service
    campaignProcessingService.start();

    // Set up periodic health checks and monitoring
    this.intervalId = setInterval(() => {
      this.performHealthCheck();
    }, this.processingInterval);

    // Handle graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Stop the background job processor
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Background job processor is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Stopping background job processor');

    // Stop the campaign processing service
    campaignProcessingService.stop();

    // Clear the interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Background job processor stopped');
  }

  /**
   * Perform health check on background services
   */
  async performHealthCheck() {
    try {
      logger.debug('Performing background services health check');

      // Check if campaign processing service is still running
      if (!campaignProcessingService.isProcessing) {
        logger.warn('Campaign processing service is not running, restarting...');
        campaignProcessingService.start();
      }

      // Check SQS connectivity
      const sqsService = require('./sqsService');
      const isSQSConfigured = await sqsService.isConfigured();
      
      if (!isSQSConfigured) {
        logger.warn('SQS service is not properly configured');
      }

      logger.debug('Health check completed successfully');
    } catch (error) {
      logger.error('Error during health check', {
        error: error.message
      });
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}, shutting down background job processor gracefully`);
      this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown); // For nodemon
  }

  /**
   * Get processor status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      processingInterval: this.processingInterval,
      campaignProcessingStatus: {
        isProcessing: campaignProcessingService.isProcessing,
        batchSize: campaignProcessingService.batchSize,
        processingInterval: campaignProcessingService.processingInterval
      }
    };
  }

  /**
   * Manually trigger campaign processing
   * @returns {Promise<void>}
   */
  async triggerCampaignProcessing() {
    try {
      logger.info('Manually triggering campaign processing');
      await campaignProcessingService.processCampaigns();
      logger.info('Manual campaign processing completed');
    } catch (error) {
      logger.error('Error during manual campaign processing', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new BackgroundJobProcessor();
