#!/usr/bin/env node

/**
 * Migration script to update typeOfContent column to use enum type
 * This script converts the VARCHAR column to use the content_type enum
 */

require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrateContentType() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Migrating typeOfContent column to use enum type...\n');

    // Check if asset_generate_files table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'asset_generate_files'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ asset_generate_files table does not exist');
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
      console.log('📋 Creating content_type enum...');
      await client.query(`
        CREATE TYPE content_type AS ENUM ('public', 'personalized');
      `);
      console.log('✅ content_type enum created');
    } else {
      console.log('✅ content_type enum already exists');
    }

    // Check current column type
    const columnInfo = await client.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'asset_generate_files'
      AND column_name = 'typeofcontent';
    `);

    if (columnInfo.rows.length === 0) {
      console.log('❌ typeOfContent column does not exist');
      return;
    }

    const currentType = columnInfo.rows[0].udt_name;
    console.log(`📋 Current column type: ${currentType}`);

    if (currentType === 'content_type') {
      console.log('✅ typeOfContent column already uses content_type enum');
      return;
    }

    // Start transaction
    await client.query('BEGIN');

    console.log('🔄 Converting typeOfContent column to enum type...');

    // First, update any invalid values to valid enum values
    await client.query(`
      UPDATE asset_generate_files 
      SET "typeOfContent" = CASE 
        WHEN LOWER("typeOfContent") LIKE '%personal%' THEN 'personalized'
        WHEN LOWER("typeOfContent") LIKE '%public%' THEN 'public'
        ELSE 'public'
      END
      WHERE "typeOfContent" NOT IN ('public', 'personalized');
    `);

    // Convert the column to use the enum type
    await client.query(`
      ALTER TABLE asset_generate_files 
      ALTER COLUMN "typeOfContent" TYPE content_type 
      USING "typeOfContent"::content_type;
    `);

    // Add index if it doesn't exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_asset_generate_files_type_of_content 
      ON asset_generate_files("typeOfContent");
    `);

    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ typeOfContent column migration completed successfully!');
    console.log('\n📋 Migration details:');
    console.log('  - Column type: content_type enum');
    console.log('  - Valid values: public, personalized');
    console.log('  - Index added for performance');

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function checkContentType() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking typeOfContent column status...\n');

    // Check if asset_generate_files table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'asset_generate_files'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ asset_generate_files table does not exist');
      return;
    }

    // Check if content_type enum exists
    const enumExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_type 
        WHERE typname = 'content_type'
      );
    `);

    console.log(`Content type enum: ${enumExists.rows[0].exists ? '✅ Exists' : '❌ Missing'}`);

    if (enumExists.rows[0].exists) {
      // Get enum values
      const enumValues = await client.query(`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'content_type')
        ORDER BY enumsortorder;
      `);

      console.log('📋 Enum values:', enumValues.rows.map(row => row.enumlabel).join(', '));
    }

    // Check typeOfContent column
    const columnInfo = await client.query(`
      SELECT column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'asset_generate_files'
      AND column_name = 'typeofcontent';
    `);

    if (columnInfo.rows.length > 0) {
      const details = columnInfo.rows[0];
      console.log(`\n📋 typeOfContent column details:`);
      console.log(`  - Type: ${details.udt_name}`);
      console.log(`  - Nullable: ${details.is_nullable}`);
      console.log(`  - Status: ${details.udt_name === 'content_type' ? '✅ Using enum' : '⚠️  Using VARCHAR'}`);
    } else {
      console.log('❌ typeOfContent column does not exist');
    }

    // Check index
    const indexExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'asset_generate_files' 
        AND indexname = 'idx_asset_generate_files_type_of_content'
      );
    `);

    console.log(`Index on typeOfContent: ${indexExists.rows[0].exists ? '✅ Exists' : '❌ Missing'}`);

    // Show current data distribution
    const dataDistribution = await client.query(`
      SELECT "typeOfContent", COUNT(*) as count
      FROM asset_generate_files
      GROUP BY "typeOfContent"
      ORDER BY count DESC;
    `);

    if (dataDistribution.rows.length > 0) {
      console.log('\n📊 Current data distribution:');
      dataDistribution.rows.forEach(row => {
        console.log(`  - ${row.typeOfContent}: ${row.count} records`);
      });
    } else {
      console.log('\n📊 No data in asset_generate_files table');
    }

  } catch (error) {
    console.error('❌ Error checking content type status:', error.message);
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'migrate':
        await migrateContentType();
        break;
      case 'check':
        await checkContentType();
        break;
      default:
        console.log('Usage: node migrateContentType.js [migrate|check]');
        console.log('  migrate: Convert typeOfContent column to use content_type enum');
        console.log('  check:   Check current status of typeOfContent column');
        break;
    }
  } catch (error) {
    console.error('❌ Script execution failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateContentType, checkContentType };
