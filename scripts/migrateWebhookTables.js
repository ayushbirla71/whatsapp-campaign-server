#!/usr/bin/env node

/**
 * Migration script to add webhook and message tracking tables
 * This script adds the new tables for webhook events, messages, and incoming messages
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

const migrationQueries = [
  // Add new enum type for webhook events
  `DROP TYPE IF EXISTS webhook_event_type CASCADE;`,
  `CREATE TYPE webhook_event_type AS ENUM (
    'message_status', 'delivery_receipt', 'read_receipt',
    'message_received', 'user_status', 'error', 'interactive_response'
  );`,

  // Create webhook_events table
  `CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    campaign_audience_id UUID REFERENCES campaign_audience(id) ON DELETE SET NULL,
    event_type webhook_event_type NOT NULL,
    whatsapp_message_id VARCHAR(255),
    from_phone_number VARCHAR(255),
    to_phone_number VARCHAR(255),
    status VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE,
    raw_payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    
    -- Interactive message response data
    interactive_type VARCHAR(50),
    interactive_data JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,

  // Create messages table
  `CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    campaign_audience_id UUID REFERENCES campaign_audience(id) ON DELETE SET NULL,
    whatsapp_message_id VARCHAR(255) UNIQUE,
    
    -- Message routing
    from_number VARCHAR(255) NOT NULL,
    to_number VARCHAR(255) NOT NULL,
    
    -- Message content
    message_type VARCHAR(50) DEFAULT 'text',
    message_content TEXT,
    media_url TEXT,
    media_type VARCHAR(50),
    caption TEXT,
    filename VARCHAR(255),
    
    -- Template information (for outgoing template messages)
    template_name VARCHAR(255),
    template_language VARCHAR(10),
    template_parameters JSONB,
    
    -- Message direction and status
    is_incoming BOOLEAN DEFAULT false,
    message_status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    
    -- Interactive message tracking (for buttons, lists, etc.)
    interaction_data JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,

  // Create incoming_messages table
  `CREATE TABLE IF NOT EXISTS incoming_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    whatsapp_message_id VARCHAR(255) UNIQUE NOT NULL,
    from_phone_number VARCHAR(255) NOT NULL,
    to_phone_number VARCHAR(255) NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(50),
    media_size INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Interactive message data
    interactive_type VARCHAR(50),
    interactive_data JSONB,
    
    -- Context (if replying to a campaign message)
    context_message_id VARCHAR(255),
    context_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    
    raw_payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,

  // Create indexes for messages table
  `CREATE INDEX IF NOT EXISTS idx_messages_organization_id ON messages(organization_id);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_campaign_id ON messages(campaign_id);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_campaign_audience_id ON messages(campaign_audience_id);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_id ON messages(whatsapp_message_id);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_from_number ON messages(from_number);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_to_number ON messages(to_number);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(message_status);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_is_incoming ON messages(is_incoming);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_template_name ON messages(template_name);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(organization_id, from_number, to_number);`,

  // Create indexes for webhook_events table
  `CREATE INDEX IF NOT EXISTS idx_webhook_events_organization_id ON webhook_events(organization_id);`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_events_campaign_id ON webhook_events(campaign_id);`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_events_campaign_audience_id ON webhook_events(campaign_audience_id);`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_events_whatsapp_id ON webhook_events(whatsapp_message_id);`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_events_timestamp ON webhook_events(timestamp);`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_events_from_phone ON webhook_events(from_phone_number);`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);`,

  // Create indexes for incoming_messages table
  `CREATE INDEX IF NOT EXISTS idx_incoming_messages_organization_id ON incoming_messages(organization_id);`,
  `CREATE INDEX IF NOT EXISTS idx_incoming_messages_whatsapp_id ON incoming_messages(whatsapp_message_id);`,
  `CREATE INDEX IF NOT EXISTS idx_incoming_messages_from_phone ON incoming_messages(from_phone_number);`,
  `CREATE INDEX IF NOT EXISTS idx_incoming_messages_to_phone ON incoming_messages(to_phone_number);`,
  `CREATE INDEX IF NOT EXISTS idx_incoming_messages_processed ON incoming_messages(processed);`,
  `CREATE INDEX IF NOT EXISTS idx_incoming_messages_context_campaign ON incoming_messages(context_campaign_id);`,
  `CREATE INDEX IF NOT EXISTS idx_incoming_messages_timestamp ON incoming_messages(timestamp);`,

  // Create trigger for messages updated_at
  `CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,
];

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log("🚀 Starting webhook tables migration...\n");

    // Start transaction
    await client.query("BEGIN");

    for (let i = 0; i < migrationQueries.length; i++) {
      const query = migrationQueries[i];
      console.log(
        `Executing migration step ${i + 1}/${migrationQueries.length}...`
      );

      try {
        await client.query(query);
        console.log(`✅ Step ${i + 1} completed successfully`);
      } catch (error) {
        // Check if it's a "already exists" error, which is acceptable
        if (
          error.message.includes("already exists") ||
          (error.message.includes("relation") &&
            error.message.includes("already exists"))
        ) {
          console.log(`⚠️  Step ${i + 1} skipped (already exists)`);
        } else {
          throw error;
        }
      }
    }

    // Commit transaction
    await client.query("COMMIT");

    console.log("\n✅ Webhook tables migration completed successfully!");
    console.log("\n📋 Tables created:");
    console.log("  - webhook_events: For tracking WhatsApp webhook events");
    console.log(
      "  - messages: For tracking all message content and interactions"
    );
    console.log("  - incoming_messages: For tracking received messages");
    console.log("\n🔍 Indexes created for optimal performance");
    console.log("🔄 Triggers added for automatic timestamp updates");
  } catch (error) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function checkMigrationStatus() {
  const client = await pool.connect();

  try {
    console.log("🔍 Checking migration status...\n");

    const tables = ["webhook_events", "messages", "incoming_messages"];

    for (const table of tables) {
      const result = await client.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `,
        [table]
      );

      const exists = result.rows[0].exists;
      console.log(`Table ${table}: ${exists ? "✅ Exists" : "❌ Missing"}`);
    }

    // Check enum type
    const enumResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_type 
        WHERE typname = 'webhook_event_type'
      );
    `);

    const enumExists = enumResult.rows[0].exists;
    console.log(
      `Enum webhook_event_type: ${enumExists ? "✅ Exists" : "❌ Missing"}`
    );
  } catch (error) {
    console.error("❌ Error checking migration status:", error.message);
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case "migrate":
        await runMigration();
        break;
      case "status":
        await checkMigrationStatus();
        break;
      default:
        console.log("Usage: node migrateWebhookTables.js [migrate|status]");
        console.log("  migrate: Run the migration to add webhook tables");
        console.log("  status:  Check if webhook tables exist");
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

module.exports = { runMigration, checkMigrationStatus };
