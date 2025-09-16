const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'whatsapp_server',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function migrateTemplateAdminApproval() {
  const client = await pool.connect();
  
  try {
    console.log('Starting template admin approval migration...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Check if admin_approval_status enum already exists
    const enumCheck = await client.query(`
      SELECT 1 FROM pg_type WHERE typname = 'admin_approval_status'
    `);
    
    if (enumCheck.rows.length === 0) {
      console.log('Creating admin_approval_status enum...');
      await client.query(`
        CREATE TYPE admin_approval_status AS ENUM ('pending', 'rejected', 'approved')
      `);
    } else {
      console.log('admin_approval_status enum already exists, skipping...');
    }
    
    // Check if columns already exist
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'templates' 
      AND column_name IN ('approved_by_admin', 'admin_approved_by', 'admin_approved_at', 'admin_rejected_at', 'admin_rejection_reason', 'parameters')
    `);
    
    const existingColumns = columnCheck.rows.map(row => row.column_name);
    
    // Add approved_by_admin column if it doesn't exist
    if (!existingColumns.includes('approved_by_admin')) {
      console.log('Adding approved_by_admin column...');
      await client.query(`
        ALTER TABLE templates 
        ADD COLUMN approved_by_admin admin_approval_status DEFAULT 'pending'
      `);
    } else {
      console.log('approved_by_admin column already exists, skipping...');
    }
    
    // Add admin_approved_by column if it doesn't exist
    if (!existingColumns.includes('admin_approved_by')) {
      console.log('Adding admin_approved_by column...');
      await client.query(`
        ALTER TABLE templates 
        ADD COLUMN admin_approved_by UUID REFERENCES users(id) ON DELETE SET NULL
      `);
    } else {
      console.log('admin_approved_by column already exists, skipping...');
    }
    
    // Add admin_approved_at column if it doesn't exist
    if (!existingColumns.includes('admin_approved_at')) {
      console.log('Adding admin_approved_at column...');
      await client.query(`
        ALTER TABLE templates 
        ADD COLUMN admin_approved_at TIMESTAMP WITH TIME ZONE
      `);
    } else {
      console.log('admin_approved_at column already exists, skipping...');
    }
    
    // Add admin_rejected_at column if it doesn't exist
    if (!existingColumns.includes('admin_rejected_at')) {
      console.log('Adding admin_rejected_at column...');
      await client.query(`
        ALTER TABLE templates 
        ADD COLUMN admin_rejected_at TIMESTAMP WITH TIME ZONE
      `);
    } else {
      console.log('admin_rejected_at column already exists, skipping...');
    }
    
    // Add admin_rejection_reason column if it doesn't exist
    if (!existingColumns.includes('admin_rejection_reason')) {
      console.log('Adding admin_rejection_reason column...');
      await client.query(`
        ALTER TABLE templates 
        ADD COLUMN admin_rejection_reason TEXT
      `);
    } else {
      console.log('admin_rejection_reason column already exists, skipping...');
    }
    
    // Add parameters column if it doesn't exist
    if (!existingColumns.includes('parameters')) {
      console.log('Adding parameters column...');
      await client.query(`
        ALTER TABLE templates 
        ADD COLUMN parameters JSONB DEFAULT '{}'
      `);
    } else {
      console.log('parameters column already exists, skipping...');
    }
    
    // Set default values for existing templates
    console.log('Setting default values for existing templates...');
    
    // Set approved templates to have admin approval pending
    const updateResult = await client.query(`
      UPDATE templates 
      SET approved_by_admin = 'pending', 
          parameters = '{}'
      WHERE approved_by_admin IS NULL OR parameters IS NULL
    `);
    
    console.log(`Updated ${updateResult.rowCount} existing templates with default values`);
    
    // Create indexes for better performance
    console.log('Creating indexes...');
    
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_templates_approved_by_admin 
        ON templates(approved_by_admin)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_templates_admin_approved_by 
        ON templates(admin_approved_by)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_templates_parameters 
        ON templates USING GIN(parameters)
      `);
      
      console.log('Indexes created successfully');
    } catch (indexError) {
      console.log('Some indexes may already exist, continuing...');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Template admin approval migration completed successfully!');
    
    // Log summary
    const templateCount = await client.query('SELECT COUNT(*) FROM templates');
    console.log(`Total templates in database: ${templateCount.rows[0].count}`);
    
    const pendingCount = await client.query(`
      SELECT COUNT(*) FROM templates WHERE approved_by_admin = 'pending'
    `);
    console.log(`Templates pending admin approval: ${pendingCount.rows[0].count}`);
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateTemplateAdminApproval()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrateTemplateAdminApproval;
