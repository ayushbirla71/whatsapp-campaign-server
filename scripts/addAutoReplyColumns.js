const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addAutoReplyColumns() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if columns already exist
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'incoming_messages' 
      AND column_name IN ('send_auto_reply_message', 'is_auto_reply', 'auto_reply_message_id')
    `);
    
    const existingColumns = columnCheck.rows.map(row => row.column_name);
    
    if (!existingColumns.includes('send_auto_reply_message')) {
      console.log('Adding send_auto_reply_message column...');
      await client.query(`
        ALTER TABLE incoming_messages 
        ADD COLUMN send_auto_reply_message VARCHAR(20) DEFAULT 'pending' 
        CHECK (send_auto_reply_message IN ('pending', 'sent', 'failed'))
      `);
    }
    
    if (!existingColumns.includes('is_auto_reply')) {
      console.log('Adding is_auto_reply column...');
      await client.query(`
        ALTER TABLE incoming_messages 
        ADD COLUMN is_auto_reply BOOLEAN DEFAULT false
      `);
    }
    
    if (!existingColumns.includes('auto_reply_message_id')) {
      console.log('Adding auto_reply_message_id column...');
      await client.query(`
        ALTER TABLE incoming_messages 
        ADD COLUMN auto_reply_message_id UUID REFERENCES templates(id) ON DELETE SET NULL
      `);
    }
    
    // Create index for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_incoming_messages_auto_reply 
      ON incoming_messages(is_auto_reply, send_auto_reply_message) 
      WHERE is_auto_reply = true AND send_auto_reply_message = 'pending'
    `);
    
    await client.query('COMMIT');
    console.log('Auto reply columns added successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addAutoReplyColumns().catch(console.error);