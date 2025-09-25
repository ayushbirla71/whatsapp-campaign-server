const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrateAutoReplyTemplate() {
  const client = await pool.connect();
  
  try {
    console.log('Starting auto reply template migration...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Check if column already exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'templates' 
      AND column_name = 'is_auto_reply_template'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('Adding is_auto_reply_template column...');
      await client.query(`
        ALTER TABLE templates 
        ADD COLUMN is_auto_reply_template BOOLEAN DEFAULT false
      `);
      
      // Set default value for existing templates
      const updateResult = await client.query(`
        UPDATE templates 
        SET is_auto_reply_template = false
        WHERE is_auto_reply_template IS NULL
      `);
      
      console.log(`Updated ${updateResult.rowCount} existing templates with default value`);
    } else {
      console.log('is_auto_reply_template column already exists, skipping...');
    }
    
    // Create index for better performance
    const indexCheck = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'templates' 
      AND indexname = 'idx_templates_auto_reply'
    `);
    
    if (indexCheck.rows.length === 0) {
      console.log('Creating index for auto reply templates...');
      await client.query(`
        CREATE INDEX idx_templates_auto_reply 
        ON templates(is_auto_reply_template) 
        WHERE is_auto_reply_template = true
      `);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Auto reply template migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAutoReplyTemplate()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrateAutoReplyTemplate;