const AWS = require("aws-sdk");
const logger = require("../utils/logger");
const path = require("path");
const crypto = require("crypto");

class S3Service {
  constructor() {
    // Configure AWS SDK
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || "us-east-1",
    });

    this.s3 = new AWS.S3();
    this.bucket = process.env.AWS_S3_BUCKET;
  }

  /**
   * Upload file buffer to S3
   * @param {Buffer} buffer
   * @param {string} originalName
   * @param {string} mimeType
   * @param {string} folder (optional)
   * @returns {Promise<Object>}
   */
  async uploadBuffer(buffer, originalName, mimeType, folder = "uploads") {
    try {
      if (!this.bucket) {
        throw new Error("S3 bucket not configured");
      }

      const ext = path.extname(originalName);
      const key = `${folder}/${Date.now()}-${crypto
        .randomBytes(6)
        .toString("hex")}${ext}`;

      const params = {
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ACL: "private", // 🔒 secure by default
      };

      const result = await this.s3.upload(params).promise();

      logger.info("File uploaded to S3", {
        bucket: this.bucket,
        key,
        size: buffer.length,
      });

      return {
        key,
        url: result.Location,
        bucket: this.bucket,
      };
    } catch (error) {
      logger.error("Error uploading file to S3", {
        error: error.message,
        bucket: this.bucket,
        fileName: originalName,
      });
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Upload local file (multer)
   * @param {Object} file
   * @param {string} folder
   */
  async uploadFile(file, folder = "uploads") {
    return this.uploadBuffer(
      file.buffer,
      file.originalname,
      file.mimetype,
      folder
    );
  }

  /**
   * Generate signed GET URL
   * @param {string} key
   * @param {number} expiresIn (seconds)
   * @returns {string}
   */
  async getSignedUrl(key, expiresIn = 3600) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        Expires: expiresIn,
      };

      const url = await this.s3.getSignedUrlPromise("getObject", params);

      return url;
    } catch (error) {
      logger.error("Error generating signed URL", {
        error: error.message,
        key,
      });
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Delete file from S3
   * @param {string} key
   */
  async deleteFile(key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
      };

      await this.s3.deleteObject(params).promise();

      logger.info("File deleted from S3", {
        bucket: this.bucket,
        key,
      });

      return true;
    } catch (error) {
      logger.error("Error deleting S3 file", {
        error: error.message,
        key,
      });
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Check S3 configuration
   */
  async isConfigured() {
    try {
      if (!this.bucket) {
        logger.warn("S3 bucket not configured");
        return false;
      }

      await this.s3
        .headBucket({
          Bucket: this.bucket,
        })
        .promise();

      return true;
    } catch (error) {
      logger.error("S3 service not properly configured", {
        error: error.message,
      });
      return false;
    }
  }
}

module.exports = new S3Service();
