const BaseModel = require('./BaseModel');
const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');

class Audience extends BaseModel {
  constructor() {
    super('audience_master');
  }

  // Normalize phone number to E.164 format
  static normalizeMSISDN(phoneNumber, defaultCountry = 'US') {
    try {
      if (!phoneNumber) return null;
      
      // Remove any non-digit characters except +
      const cleaned = phoneNumber.replace(/[^\d+]/g, '');
      
      if (isValidPhoneNumber(cleaned, defaultCountry)) {
        const parsed = parsePhoneNumber(cleaned, defaultCountry);
        return parsed.format('E.164');
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  // Extract country code from normalized MSISDN
  static extractCountryCode(msisdn) {
    try {
      if (!msisdn || !msisdn.startsWith('+')) return null;
      
      const parsed = parsePhoneNumber(msisdn);
      return parsed.countryCallingCode;
    } catch (error) {
      return null;
    }
  }

  async createOrUpdateMasterRecord(audienceData) {
    try {
      const normalizedMSISDN = Audience.normalizeMSISDN(audienceData.msisdn, audienceData.country_code);
      
      if (!normalizedMSISDN) {
        throw new Error('Invalid phone number format');
      }

      const countryCode = Audience.extractCountryCode(normalizedMSISDN);
      
      // Check if record exists
      const existingRecord = await this.findByMSISDNAndOrganization(normalizedMSISDN, audienceData.organization_id);
      
      const recordData = {
        organization_id: audienceData.organization_id,
        name: audienceData.name,
        msisdn: normalizedMSISDN,
        country_code: countryCode,
        last_known_attributes: audienceData.attributes || {},
        created_by: audienceData.created_by
      };

      if (existingRecord) {
        // Update existing record with new attributes
        const mergedAttributes = {
          ...existingRecord.last_known_attributes,
          ...recordData.last_known_attributes
        };
        
        return await this.update(existingRecord.id, {
          name: recordData.name,
          last_known_attributes: mergedAttributes
        });
      } else {
        // Create new record
        return await super.create(recordData);
      }
    } catch (error) {
      throw new Error(`Error creating/updating master audience record: ${error.message}`);
    }
  }

  async findByMSISDNAndOrganization(msisdn, organizationId) {
    try {
      const normalizedMSISDN = Audience.normalizeMSISDN(msisdn);
      if (!normalizedMSISDN) return null;

      const query = `
        SELECT * FROM audience_master 
        WHERE msisdn = $1 AND organization_id = $2
      `;
      const result = await this.pool.query(query, [normalizedMSISDN, organizationId]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding audience by MSISDN and organization: ${error.message}`);
    }
  }

  async findByOrganization(organizationId, filters = {}) {
    try {
      let query = `
        SELECT am.*, u.first_name as created_by_name, u.last_name as created_by_lastname
        FROM audience_master am
        LEFT JOIN users u ON am.created_by = u.id
        WHERE am.organization_id = $1
      `;
      
      const values = [organizationId];
      let paramCount = 1;

      // Apply filters
      if (filters.search) {
        paramCount++;
        query += ` AND (am.name ILIKE $${paramCount} OR am.msisdn ILIKE $${paramCount})`;
        values.push(`%${filters.search}%`);
      }

      if (filters.country_code) {
        paramCount++;
        query += ` AND am.country_code = $${paramCount}`;
        values.push(filters.country_code);
      }

      query += ` ORDER BY am.created_at DESC`;

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
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding audience by organization: ${error.message}`);
    }
  }

  async bulkCreateOrUpdate(audienceList, organizationId, createdBy) {
    try {
      const results = [];
      const errors = [];

      for (const audienceData of audienceList) {
        try {
          const result = await this.createOrUpdateMasterRecord({
            ...audienceData,
            organization_id: organizationId,
            created_by: createdBy
          });
          results.push(result);
        } catch (error) {
          errors.push({
            data: audienceData,
            error: error.message
          });
        }
      }

      return {
        success: results,
        errors: errors,
        total_processed: audienceList.length,
        successful: results.length,
        failed: errors.length
      };
    } catch (error) {
      throw new Error(`Error bulk creating/updating audience: ${error.message}`);
    }
  }

  // Campaign Audience Methods
  async addToCampaign(campaignId, organizationId, audienceList) {
    try {
      const client = await this.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        const results = [];
        const errors = [];

        for (const audienceData of audienceList) {
          try {
            const normalizedMSISDN = Audience.normalizeMSISDN(audienceData.msisdn);
            
            if (!normalizedMSISDN) {
              errors.push({
                data: audienceData,
                error: 'Invalid phone number format'
              });
              continue;
            }

            // Check for duplicate in campaign
            const duplicateCheck = await client.query(
              'SELECT id FROM campaign_audience WHERE campaign_id = $1 AND msisdn = $2',
              [campaignId, normalizedMSISDN]
            );

            if (duplicateCheck.rows.length > 0) {
              errors.push({
                data: audienceData,
                error: 'Phone number already exists in campaign'
              });
              continue;
            }

            // Insert into campaign_audience
            const insertQuery = `
              INSERT INTO campaign_audience (campaign_id, organization_id, name, msisdn, attributes)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING *
            `;
            
            const result = await client.query(insertQuery, [
              campaignId,
              organizationId,
              audienceData.name,
              normalizedMSISDN,
              JSON.stringify(audienceData.attributes || {})
            ]);

            results.push(result.rows[0]);

            // Also update master table
            await this.createOrUpdateMasterRecord({
              ...audienceData,
              msisdn: normalizedMSISDN,
              organization_id: organizationId
            });

          } catch (error) {
            errors.push({
              data: audienceData,
              error: error.message
            });
          }
        }

        // Update campaign total_targeted_audience
        await client.query(
          'UPDATE campaigns SET total_targeted_audience = (SELECT COUNT(*) FROM campaign_audience WHERE campaign_id = $1) WHERE id = $1',
          [campaignId]
        );

        await client.query('COMMIT');

        return {
          success: results,
          errors: errors,
          total_processed: audienceList.length,
          successful: results.length,
          failed: errors.length
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      throw new Error(`Error adding audience to campaign: ${error.message}`);
    }
  }

  async getCampaignAudience(campaignId, filters = {}) {
    try {
      let query = `
        SELECT * FROM campaign_audience 
        WHERE campaign_id = $1
      `;
      
      const values = [campaignId];
      let paramCount = 1;

      // Apply filters
      if (filters.message_status) {
        paramCount++;
        query += ` AND message_status = $${paramCount}`;
        values.push(filters.message_status);
      }

      if (filters.search) {
        paramCount++;
        query += ` AND (name ILIKE $${paramCount} OR msisdn ILIKE $${paramCount})`;
        values.push(`%${filters.search}%`);
      }

      query += ` ORDER BY created_at DESC`;

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
      return result.rows.map(row => ({
        ...row,
        attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : row.attributes
      }));
    } catch (error) {
      throw new Error(`Error getting campaign audience: ${error.message}`);
    }
  }

  async updateMessageStatus(campaignAudienceId, status, additionalData = {}) {
    try {
      const updateData = {
        message_status: status,
        ...additionalData
      };

      // Set timestamp based on status
      const now = new Date();
      switch (status) {
        case 'sent':
          updateData.sent_at = now;
          break;
        case 'delivered':
          updateData.delivered_at = now;
          break;
        case 'read':
          updateData.read_at = now;
          break;
        case 'failed':
          updateData.failed_at = now;
          break;
      }

      const query = `
        UPDATE campaign_audience 
        SET ${Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const values = [campaignAudienceId, ...Object.values(updateData)];
      const result = await this.pool.query(query, values);
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating message status: ${error.message}`);
    }
  }

  async removeCampaignAudience(campaignId, msisdn) {
    try {
      const normalizedMSISDN = Audience.normalizeMSISDN(msisdn);
      if (!normalizedMSISDN) {
        throw new Error('Invalid phone number format');
      }

      const query = `
        DELETE FROM campaign_audience 
        WHERE campaign_id = $1 AND msisdn = $2
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [campaignId, normalizedMSISDN]);
      
      // Update campaign total_targeted_audience
      await this.pool.query(
        'UPDATE campaigns SET total_targeted_audience = (SELECT COUNT(*) FROM campaign_audience WHERE campaign_id = $1) WHERE id = $1',
        [campaignId]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error removing audience from campaign: ${error.message}`);
    }
  }

  // Validation methods
  validateAudienceData(audienceData) {
    const errors = [];

    if (!audienceData.name || audienceData.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!audienceData.msisdn || audienceData.msisdn.trim().length === 0) {
      errors.push('Phone number is required');
    }

    if (audienceData.msisdn && !Audience.normalizeMSISDN(audienceData.msisdn)) {
      errors.push('Invalid phone number format');
    }

    return errors;
  }
}

module.exports = new Audience();
