const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrateAutoReplyButtonMappings() {
  const client = await pool.connect();
  
  try {
    console.log('Starting auto reply button mappings migration...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Check if column already exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'templates' 
      AND column_name = 'auto_reply_button_mappings'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('Adding auto_reply_button_mappings column...');
      await client.query(`
        ALTER TABLE templates 
        ADD COLUMN auto_reply_button_mappings JSONB DEFAULT '{}'
      `);
      
      // Set default value for existing templates
      const updateResult = await client.query(`
        UPDATE templates 
        SET auto_reply_button_mappings = '{}'
        WHERE auto_reply_button_mappings IS NULL
      `);
      
      console.log(`Updated ${updateResult.rowCount} existing templates with default value`);
    } else {
      console.log('auto_reply_button_mappings column already exists, skipping...');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Auto reply button mappings migration completed successfully!');
    
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
  migrateAutoReplyButtonMappings()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrateAutoReplyButtonMappings;