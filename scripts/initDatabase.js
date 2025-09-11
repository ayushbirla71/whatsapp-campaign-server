const fs = require("fs");
const path = require("path");
const pool = require("../config/database");
const User = require("../models/User");
require("dotenv").config();

class DatabaseInitializer {
  constructor() {
    this.schemaPath = path.join(__dirname, "../config/schema.sql");
  }

  async initializeDatabase() {
    try {
      console.log("🚀 Starting database initialization...");

      // Check if database is already initialized
      const isInitialized = await this.checkIfInitialized();
      if (isInitialized) {
        console.log("✅ Database is already initialized");
        return;
      }

      // Create schema
      await this.createSchema();

      // Create default super admin
      await this.createDefaultSuperAdmin();

      console.log("✅ Database initialization completed successfully!");
    } catch (error) {
      console.error("❌ Database initialization failed:", error.message);
      throw error;
    }
  }

  async checkIfInitialized() {
    try {
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `;
      const result = await pool.query(query);
      return result.rows[0].exists;
    } catch (error) {
      return false;
    }
  }

  async createSchema() {
    try {
      console.log("📋 Creating database schema...");

      const schemaSQL = fs.readFileSync(this.schemaPath, "utf8");
      await pool.query(schemaSQL);

      console.log("✅ Database schema created successfully");
    } catch (error) {
      console.error("❌ Failed to create schema:", error.message);
      throw error;
    }
  }

  async createDefaultSuperAdmin() {
    try {
      console.log("👤 Creating default super admin...");

      const email =
        process.env.DEFAULT_SUPER_ADMIN_EMAIL || "superadmin@example.com";
      const password =
        process.env.DEFAULT_SUPER_ADMIN_PASSWORD || "SuperAdmin123!";

      // Check if super admin already exists
      const existingAdmin = await User.findByEmail(email);
      if (existingAdmin) {
        console.log("✅ Default super admin already exists");
        return;
      }

      const superAdminData = {
        email,
        password,
        first_name: "Super",
        last_name: "Admin",
        role: "super_admin",
        is_active: true,
      };

      const superAdmin = await User.create(superAdminData);

      console.log("✅ Default super admin created successfully");
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: ${password}`);
      console.log("⚠️  Please change the default password after first login!");

      return superAdmin;
    } catch (error) {
      console.error("❌ Failed to create default super admin:", error.message);
      throw error;
    }
  }

  async dropDatabase() {
    try {
      console.log("🗑️  Dropping database schema...");

      const dropSQL = `
        DROP TABLE IF EXISTS audit_logs CASCADE;
        DROP TABLE IF EXISTS refresh_tokens CASCADE;
        DROP TABLE IF EXISTS campaign_audience CASCADE;
        DROP TABLE IF EXISTS campaigns CASCADE;
        DROP TABLE IF EXISTS audience_master CASCADE;
        DROP TABLE IF EXISTS asset_generate_files CASCADE;
        DROP TABLE IF EXISTS templates CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS organizations CASCADE;
        DROP TYPE IF EXISTS user_role CASCADE;
        DROP TYPE IF EXISTS organization_status CASCADE;
        DROP TYPE IF EXISTS template_status CASCADE;
        DROP TYPE IF EXISTS template_category CASCADE;
        DROP TYPE IF EXISTS template_language CASCADE;
        DROP TYPE IF EXISTS campaign_status CASCADE;
        DROP TYPE IF EXISTS campaign_type CASCADE;
        DROP TYPE IF EXISTS asset_generation_status CASCADE;
        DROP TYPE IF EXISTS message_status_extended CASCADE;
        DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
      `;

      await pool.query(dropSQL);
      console.log("✅ Database schema dropped successfully");
    } catch (error) {
      console.error("❌ Failed to drop schema:", error.message);
      throw error;
    }
  }

  async resetDatabase() {
    try {
      console.log("🔄 Resetting database...");
      await this.dropDatabase();
      await this.initializeDatabase();
      console.log("✅ Database reset completed successfully!");
    } catch (error) {
      console.error("❌ Database reset failed:", error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      console.log("🔌 Testing database connection...");
      const result = await pool.query("SELECT NOW()");
      console.log("✅ Database connection successful");
      console.log(`🕐 Server time: ${result.rows[0].now}`);
      return true;
    } catch (error) {
      console.error("❌ Database connection failed:", error.message);
      return false;
    }
  }

  async cleanup() {
    try {
      console.log("🧹 Cleaning up expired tokens...");

      const query = `
        DELETE FROM refresh_tokens 
        WHERE expires_at < NOW() 
        OR revoked_at < NOW() - INTERVAL '30 days'
      `;

      const result = await pool.query(query);
      console.log(`✅ Cleaned up ${result.rowCount} expired tokens`);
    } catch (error) {
      console.error("❌ Cleanup failed:", error.message);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const initializer = new DatabaseInitializer();

  try {
    switch (command) {
      case "init":
        await initializer.initializeDatabase();
        break;
      case "reset":
        await initializer.resetDatabase();
        break;
      case "drop":
        await initializer.dropDatabase();
        break;
      case "test":
        await initializer.testConnection();
        break;
      case "cleanup":
        await initializer.cleanup();
        break;
      default:
        console.log(
          "Usage: node initDatabase.js [init|reset|drop|test|cleanup]"
        );
        console.log(
          "  init    - Initialize database with schema and default data"
        );
        console.log("  reset   - Drop and recreate database");
        console.log("  drop    - Drop all database objects");
        console.log("  test    - Test database connection");
        console.log("  cleanup - Clean up expired tokens");
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Operation failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = DatabaseInitializer;
