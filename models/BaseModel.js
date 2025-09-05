const pool = require('../config/database');

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.pool = pool;
  }

  async findById(id) {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding ${this.tableName} by ID: ${error.message}`);
    }
  }

  async findAll(conditions = {}, limit = null, offset = null) {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const values = [];
      let paramCount = 0;

      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions).map(key => {
          paramCount++;
          values.push(conditions[key]);
          return `${key} = $${paramCount}`;
        }).join(' AND ');
        query += ` WHERE ${whereClause}`;
      }

      query += ` ORDER BY created_at DESC`;

      if (limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(limit);
      }

      if (offset) {
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        values.push(offset);
      }

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding ${this.tableName}: ${error.message}`);
    }
  }

  async create(data) {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
      const columns = keys.join(', ');

      const query = `
        INSERT INTO ${this.tableName} (${columns})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating ${this.tableName}: ${error.message}`);
    }
  }

  async update(id, data) {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      
      if (keys.length === 0) {
        throw new Error('No data provided for update');
      }

      const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
      values.push(id);

      const query = `
        UPDATE ${this.tableName}
        SET ${setClause}
        WHERE id = $${values.length}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error updating ${this.tableName}: ${error.message}`);
    }
  }

  async delete(id) {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`;
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error deleting ${this.tableName}: ${error.message}`);
    }
  }

  async count(conditions = {}) {
    try {
      let query = `SELECT COUNT(*) FROM ${this.tableName}`;
      const values = [];
      let paramCount = 0;

      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions).map(key => {
          paramCount++;
          values.push(conditions[key]);
          return `${key} = $${paramCount}`;
        }).join(' AND ');
        query += ` WHERE ${whereClause}`;
      }

      const result = await this.pool.query(query, values);
      return parseInt(result.rows[0].count);
    } catch (error) {
      throw new Error(`Error counting ${this.tableName}: ${error.message}`);
    }
  }
}

module.exports = BaseModel;
