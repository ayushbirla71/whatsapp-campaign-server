const BaseModel = require('./BaseModel');
const crypto = require('crypto');

class RefreshToken extends BaseModel {
  constructor() {
    super('refresh_tokens');
  }

  async create(userId, expiresIn = '7d') {
    try {
      // Generate a secure random token
      const token = crypto.randomBytes(64).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Calculate expiration date
      const expiresAt = new Date();
      if (expiresIn.endsWith('d')) {
        const days = parseInt(expiresIn.slice(0, -1));
        expiresAt.setDate(expiresAt.getDate() + days);
      } else if (expiresIn.endsWith('h')) {
        const hours = parseInt(expiresIn.slice(0, -1));
        expiresAt.setHours(expiresAt.getHours() + hours);
      } else {
        // Default to 7 days
        expiresAt.setDate(expiresAt.getDate() + 7);
      }

      const refreshTokenData = {
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt
      };

      const savedToken = await super.create(refreshTokenData);
      
      // Return the plain token (not the hash) for the client
      return {
        ...savedToken,
        token: token
      };
    } catch (error) {
      throw new Error(`Error creating refresh token: ${error.message}`);
    }
  }

  async findByToken(token) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const query = `
        SELECT rt.*, u.email, u.role, u.organization_id 
        FROM refresh_tokens rt
        JOIN users u ON rt.user_id = u.id
        WHERE rt.token_hash = $1 
        AND rt.expires_at > NOW() 
        AND rt.revoked_at IS NULL
      `;
      const result = await this.pool.query(query, [tokenHash]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding refresh token: ${error.message}`);
    }
  }

  async revokeToken(token) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const query = `
        UPDATE refresh_tokens 
        SET revoked_at = NOW() 
        WHERE token_hash = $1 
        RETURNING *
      `;
      const result = await this.pool.query(query, [tokenHash]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error revoking refresh token: ${error.message}`);
    }
  }

  async revokeAllUserTokens(userId) {
    try {
      const query = `
        UPDATE refresh_tokens 
        SET revoked_at = NOW() 
        WHERE user_id = $1 
        AND revoked_at IS NULL
        RETURNING *
      `;
      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error revoking all user tokens: ${error.message}`);
    }
  }

  async cleanupExpiredTokens() {
    try {
      const query = `
        DELETE FROM refresh_tokens 
        WHERE expires_at < NOW() 
        OR revoked_at < NOW() - INTERVAL '30 days'
        RETURNING COUNT(*)
      `;
      const result = await this.pool.query(query);
      return result.rows[0].count;
    } catch (error) {
      throw new Error(`Error cleaning up expired tokens: ${error.message}`);
    }
  }

  async findActiveTokensByUser(userId) {
    try {
      const query = `
        SELECT * FROM refresh_tokens 
        WHERE user_id = $1 
        AND expires_at > NOW() 
        AND revoked_at IS NULL
        ORDER BY created_at DESC
      `;
      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding active tokens by user: ${error.message}`);
    }
  }

  async isTokenValid(token) {
    try {
      const tokenData = await this.findByToken(token);
      return !!tokenData;
    } catch (error) {
      throw new Error(`Error validating token: ${error.message}`);
    }
  }
}

module.exports = new RefreshToken();
