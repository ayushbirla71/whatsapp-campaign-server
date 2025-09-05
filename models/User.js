const BaseModel = require('./BaseModel');
const bcrypt = require('bcryptjs');

class User extends BaseModel {
  constructor() {
    super('users');
  }

  async findByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await this.pool.query(query, [email]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  async create(userData) {
    try {
      // Hash password before storing
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      const data = {
        ...userData,
        password_hash: hashedPassword
      };
      delete data.password; // Remove plain password

      return await super.create(data);
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  async validatePassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      throw new Error(`Error validating password: ${error.message}`);
    }
  }

  async updatePassword(userId, newPassword) {
    try {
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      const data = {
        password_hash: hashedPassword,
        password_changed_at: new Date()
      };

      return await this.update(userId, data);
    } catch (error) {
      throw new Error(`Error updating password: ${error.message}`);
    }
  }

  async incrementFailedLoginAttempts(userId) {
    try {
      const query = `
        UPDATE users 
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE 
              WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '15 minutes'
              ELSE locked_until
            END
        WHERE id = $1
        RETURNING *
      `;
      const result = await this.pool.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error incrementing failed login attempts: ${error.message}`);
    }
  }

  async resetFailedLoginAttempts(userId) {
    try {
      const data = {
        failed_login_attempts: 0,
        locked_until: null,
        last_login: new Date()
      };
      return await this.update(userId, data);
    } catch (error) {
      throw new Error(`Error resetting failed login attempts: ${error.message}`);
    }
  }

  async findByOrganization(organizationId, role = null) {
    try {
      let query = 'SELECT * FROM users WHERE organization_id = $1';
      const values = [organizationId];

      if (role) {
        query += ' AND role = $2';
        values.push(role);
      }

      query += ' ORDER BY created_at DESC';

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding users by organization: ${error.message}`);
    }
  }

  async findSystemUsers() {
    try {
      const query = `
        SELECT * FROM users 
        WHERE role IN ('super_admin', 'system_admin') 
        AND organization_id IS NULL
        ORDER BY created_at DESC
      `;
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding system users: ${error.message}`);
    }
  }

  async isAccountLocked(userId) {
    try {
      const user = await this.findById(userId);
      if (!user) return false;

      if (user.locked_until && new Date() < new Date(user.locked_until)) {
        return true;
      }

      // If lock time has passed, reset the failed attempts
      if (user.locked_until && new Date() >= new Date(user.locked_until)) {
        await this.resetFailedLoginAttempts(userId);
      }

      return false;
    } catch (error) {
      throw new Error(`Error checking account lock status: ${error.message}`);
    }
  }

  // Remove sensitive data before sending to client
  sanitizeUser(user) {
    if (!user) return null;
    
    const sanitized = { ...user };
    delete sanitized.password_hash;
    delete sanitized.failed_login_attempts;
    delete sanitized.locked_until;
    
    return sanitized;
  }
}

module.exports = new User();
