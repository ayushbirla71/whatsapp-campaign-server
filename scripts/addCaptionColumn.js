#!/usr/bin/env node

/**
 * Migration script to add caption column to messages table
 * This script adds the caption column for media messages
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

async function addCaptionColumn() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Adding caption column to messages table...\n');

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

    // Check if caption column already exists
    const columnExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
        AND column_name = 'caption'
      );
    `);

    if (columnExists.rows[0].exists) {
      console.log('✅ Caption column already exists in messages table');
      return;
    }

    // Start transaction
    await client.query('BEGIN');

    // Add caption column
    await client.query(`
      ALTER TABLE messages 
      ADD COLUMN caption TEXT;
    `);

    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Caption column added to messages table successfully!');
    console.log('\n📋 Column details:');
    console.log('  - Name: caption');
    console.log('  - Type: TEXT');
    console.log('  - Purpose: Store captions for media messages (images, videos)');

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function checkCaptionColumn() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking caption column status...\n');

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

    // Check if caption column exists
    const columnExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
        AND column_name = 'caption'
      );
    `);

    console.log(`Caption column in messages table: ${columnExists.rows[0].exists ? '✅ Exists' : '❌ Missing'}`);

    if (columnExists.rows[0].exists) {
      // Get column details
      const columnDetails = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
        AND column_name = 'caption';
      `);

      if (columnDetails.rows.length > 0) {
        const details = columnDetails.rows[0];
        console.log('\n📋 Column details:');
        console.log(`  - Type: ${details.data_type}`);
        console.log(`  - Nullable: ${details.is_nullable}`);
        console.log(`  - Default: ${details.column_default || 'NULL'}`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking caption column status:', error.message);
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
        await addCaptionColumn();
        break;
      case 'check':
        await checkCaptionColumn();
        break;
      default:
        console.log('Usage: node addCaptionColumn.js [add|check]');
        console.log('  add:   Add caption column to messages table');
        console.log('  check: Check if caption column exists');
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

module.exports = { addCaptionColumn, checkCaptionColumn };
