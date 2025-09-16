#!/usr/bin/env node

/**
 * Migration script to add typeOfContent column to asset_generate_files table
 * This script adds the typeOfContent column with content_type enum
 */

require("dotenv").config();
const { Pool } = require("pg");
const logger = require("../utils/logger");

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addContentTypeColumn() {
  const client = await pool.connect();

  try {
    console.log(
      "🚀 Adding typeOfContent column to asset_generate_files table...\n"
    );

    // Check if asset_generate_files table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'asset_generate_files'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log("❌ asset_generate_files table does not exist");
      return;
    }

    // Check if content_type enum exists
    const enumExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_type 
        WHERE typname = 'content_type'
      );
    `);

    if (!enumExists.rows[0].exists) {
      console.log("📋 Creating content_type enum...");
      await client.query(`
        CREATE TYPE content_type AS ENUM ('public', 'personalized');
      `);
      console.log("✅ content_type enum created");
    } else {
      console.log("✅ content_type enum already exists");
    }

    // Check if typeOfContent column already exists
    const columnExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'asset_generate_files'
        AND column_name = 'typeofcontent'
      );
    `);

    if (columnExists.rows[0].exists) {
      console.log("✅ typeOfContent column already exists");
      return;
    }

    // Start transaction
    await client.query("BEGIN");

    // Add typeOfContent column
    await client.query(`
      ALTER TABLE asset_generate_files 
      ADD COLUMN "typeOfContent" content_type NOT NULL DEFAULT 'public';
    `);

    // Add index
    await client.query(`
      CREATE INDEX idx_asset_generate_files_type_of_content 
      ON asset_generate_files("typeOfContent");
    `);

    // Commit transaction
    await client.query("COMMIT");

    console.log("✅ typeOfContent column added successfully!");
    console.log("\n📋 Column details:");
    console.log("  - Name: typeOfContent");
    console.log("  - Type: content_type enum");
    console.log("  - Values: public, personalized");
    console.log("  - Default: public");
    console.log("  - Index: Added for performance");
  } catch (error) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function checkContentTypeColumn() {
  const client = await pool.connect();

  try {
    console.log("🔍 Checking typeOfContent column status...\n");

    // Check if asset_generate_files table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'asset_generate_files'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log("❌ asset_generate_files table does not exist");
      return;
    }

    // Check if content_type enum exists
    const enumExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_type 
        WHERE typname = 'content_type'
      );
    `);

    console.log(
      `Content type enum: ${
        enumExists.rows[0].exists ? "✅ Exists" : "❌ Missing"
      }`
    );

    if (enumExists.rows[0].exists) {
      // Get enum values
      const enumValues = await client.query(`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'content_type')
        ORDER BY enumsortorder;
      `);

      console.log(
        "📋 Enum values:",
        enumValues.rows.map((row) => row.enumlabel).join(", ")
      );
    }

    // Check if typeOfContent column exists (check both cases)
    const columnExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'asset_generate_files'
        AND (column_name = 'typeofcontent' OR column_name = 'typeOfContent')
      );
    `);

    console.log(
      `typeOfContent column: ${
        columnExists.rows[0].exists ? "✅ Exists" : "❌ Missing"
      }`
    );

    if (columnExists.rows[0].exists) {
      // Get column details
      const columnDetails = await client.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'asset_generate_files'
        AND (column_name = 'typeofcontent' OR column_name = 'typeOfContent');
      `);

      if (columnDetails.rows.length > 0) {
        const details = columnDetails.rows[0];
        console.log("\n📋 Column details:");
        console.log(`  - Type: ${details.udt_name}`);
        console.log(`  - Nullable: ${details.is_nullable}`);
        console.log(`  - Default: ${details.column_default || "NULL"}`);
      }

      // Check index
      const indexExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE tablename = 'asset_generate_files' 
          AND indexname = 'idx_asset_generate_files_type_of_content'
        );
      `);

      console.log(
        `Index on typeOfContent: ${
          indexExists.rows[0].exists ? "✅ Exists" : "❌ Missing"
        }`
      );

      // Show current data distribution
      try {
        const dataDistribution = await client.query(`
          SELECT "typeOfContent", COUNT(*) as count
          FROM asset_generate_files
          GROUP BY "typeOfContent"
          ORDER BY count DESC;
        `);

        if (dataDistribution.rows.length > 0) {
          console.log("\n📊 Current data distribution:");
          dataDistribution.rows.forEach((row) => {
            console.log(`  - ${row.typeOfContent}: ${row.count} records`);
          });
        } else {
          console.log("\n📊 No data in asset_generate_files table");
        }
      } catch (error) {
        console.log(
          "\n📊 Unable to check data distribution (table may be empty)"
        );
      }
    }
  } catch (error) {
    console.error(
      "❌ Error checking typeOfContent column status:",
      error.message
    );
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case "add":
        await addContentTypeColumn();
        break;
      case "check":
        await checkContentTypeColumn();
        break;
      default:
        console.log("Usage: node addContentTypeColumn.js [add|check]");
        console.log(
          "  add:   Add typeOfContent column to asset_generate_files table"
        );
        console.log("  check: Check if typeOfContent column exists");
        break;
    }
  } catch (error) {
    console.error("❌ Script execution failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { addContentTypeColumn, checkContentTypeColumn };
