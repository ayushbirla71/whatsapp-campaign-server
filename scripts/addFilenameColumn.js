#!/usr/bin/env node

/**
 * Migration script to add filename column to messages table
 * This script adds the filename column for document messages
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

async function addFilenameColumn() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Adding filename column to messages table...\n');

    // Check if messages table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Messages table does not exist. Please run the webhook migration first.');
      return;
    }

    // Check if filename column already exists
    const columnExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
        AND column_name = 'filename'
      );
    `);

    if (columnExists.rows[0].exists) {
      console.log('✅ Filename column already exists in messages table');
      return;
    }

    // Start transaction
    await client.query('BEGIN');

    // Add filename column
    await client.query(`
      ALTER TABLE messages 
      ADD COLUMN filename VARCHAR(255);
    `);

    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Filename column added to messages table successfully!');
    console.log('\n📋 Column details:');
    console.log('  - Name: filename');
    console.log('  - Type: VARCHAR(255)');
    console.log('  - Purpose: Store filenames for document messages');

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function checkFilenameColumn() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking filename column status...\n');

    // Check if messages table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Messages table does not exist');
      return;
    }

    // Check if filename column exists
    const columnExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
        AND column_name = 'filename'
      );
    `);

    console.log(`Filename column in messages table: ${columnExists.rows[0].exists ? '✅ Exists' : '❌ Missing'}`);

    if (columnExists.rows[0].exists) {
      // Get column details
      const columnDetails = await client.query(`
        SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
        AND column_name = 'filename';
      `);

      if (columnDetails.rows.length > 0) {
        const details = columnDetails.rows[0];
        console.log('\n📋 Column details:');
        console.log(`  - Type: ${details.data_type}${details.character_maximum_length ? `(${details.character_maximum_length})` : ''}`);
        console.log(`  - Nullable: ${details.is_nullable}`);
        console.log(`  - Default: ${details.column_default || 'NULL'}`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking filename column status:', error.message);
  } finally {
    client.release();
  }
}

async function checkAllRequiredColumns() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking all required columns in messages table...\n');

    const requiredColumns = [
      'id', 'organization_id', 'campaign_id', 'campaign_audience_id',
      'whatsapp_message_id', 'from_number', 'to_number', 'message_type',
      'message_content', 'template_name', 'template_language',
      'template_parameters', 'message_status', 'is_incoming',
      'media_url', 'caption', 'filename',
      'created_at', 'updated_at'
    ];

    // Check if messages table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Messages table does not exist');
      return;
    }

    // Get all columns in messages table
    const columnsResult = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'messages'
      ORDER BY ordinal_position;
    `);

    const existingColumns = columnsResult.rows.map(row => row.column_name);
    
    console.log('📋 Column Status:');
    console.log('================');
    
    for (const column of requiredColumns) {
      const exists = existingColumns.includes(column);
      const status = exists ? '✅' : '❌';
      console.log(`${status} ${column}`);
      
      if (exists) {
        const columnInfo = columnsResult.rows.find(row => row.column_name === column);
        const typeInfo = columnInfo.character_maximum_length 
          ? `${columnInfo.data_type}(${columnInfo.character_maximum_length})`
          : columnInfo.data_type;
        console.log(`    Type: ${typeInfo}, Nullable: ${columnInfo.is_nullable}`);
      }
    }

    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    if (missingColumns.length > 0) {
      console.log('\n❌ Missing columns:', missingColumns.join(', '));
    } else {
      console.log('\n✅ All required columns are present!');
    }

  } catch (error) {
    console.error('❌ Error checking columns:', error.message);
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'add':
        await addFilenameColumn();
        break;
      case 'check':
        await checkFilenameColumn();
        break;
      case 'check-all':
        await checkAllRequiredColumns();
        break;
      default:
        console.log('Usage: node addFilenameColumn.js [add|check|check-all]');
        console.log('  add:       Add filename column to messages table');
        console.log('  check:     Check if filename column exists');
        console.log('  check-all: Check all required columns in messages table');
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

module.exports = { addFilenameColumn, checkFilenameColumn, checkAllRequiredColumns };
