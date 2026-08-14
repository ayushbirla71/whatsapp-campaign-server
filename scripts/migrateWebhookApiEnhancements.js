#!/usr/bin/env node

/**
 * Migration script for the new webhook events + WhatsApp Cloud API coverage:
 *   - message_template_status_update, account_update, phone_number_quality_update,
 *     phone_number_name_update webhook handling
 *   - phone number health / business profile / template push-to-Meta API calls
 *
 * Adds:
 *   - New values on the webhook_event_type enum
 *   - New columns on organizations for account/quality/name status tracking
 *
 * Safe to run multiple times (all statements are IF NOT EXISTS / idempotent).
 *
 * Usage:
 *   node scripts/migrateWebhookApiEnhancements.js migrate
 *   node scripts/migrateWebhookApiEnhancements.js status
 */

require("dotenv").config();
const { Pool } = require("pg");
const logger = require("../utils/logger");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ALTER TYPE ... ADD VALUE cannot run inside a multi-statement transaction
// block together with other DDL in some PG versions, so these run as their
// own statements, each wrapped in a duplicate-safe DO block.
const enumValueQueries = [
  `DO $$ BEGIN
     ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'template_status_update';
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
     ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'account_update';
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
     ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'phone_quality_update';
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
     ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'phone_name_update';
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
     ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'capability_update';
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
     ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'message_error';
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
];

const columnQueries = [
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS whatsapp_quality_rating VARCHAR(20);`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS whatsapp_messaging_tier VARCHAR(50);`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS whatsapp_name_status VARCHAR(50);`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS whatsapp_account_status VARCHAR(50);`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS whatsapp_account_status_updated_at TIMESTAMP WITH TIME ZONE;`,

  // conversation_messages.media_url currently stores a raw WhatsApp media ID
  // for inbound media until the download step runs; track that transition
  // explicitly so the UI can show a "loading media..." state instead of a
  // broken image while the S3 upload is in flight.
  `ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS media_download_status VARCHAR(20) DEFAULT 'pending';`,
  `ALTER TABLE incoming_messages ADD COLUMN IF NOT EXISTS media_download_status VARCHAR(20) DEFAULT 'pending';`,
];

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("Running webhook/API enhancement migration...");

    for (const query of enumValueQueries) {
      await client.query(query);
    }
    console.log("✅ webhook_event_type enum values added");

    await client.query("BEGIN");
    for (const query of columnQueries) {
      await client.query(query);
    }
    await client.query("COMMIT");
    console.log("✅ organizations / message tables columns added");

    logger.info("Webhook/API enhancement migration completed successfully");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ Migration failed:", error.message);
    logger.error("Webhook/API enhancement migration failed", { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

async function checkMigrationStatus() {
  const client = await pool.connect();
  try {
    const columnsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'organizations'
        AND column_name IN (
          'whatsapp_quality_rating', 'whatsapp_messaging_tier',
          'whatsapp_name_status', 'whatsapp_account_status',
          'whatsapp_account_status_updated_at'
        );
    `);
    console.log(`organizations columns present: ${columnsResult.rows.length}/5`);
    columnsResult.rows.forEach((r) => console.log(`  ✅ ${r.column_name}`));

    const enumResult = await client.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'webhook_event_type');
    `);
    console.log("webhook_event_type values:", enumResult.rows.map((r) => r.enumlabel).join(", "));
  } catch (error) {
    console.error("❌ Error checking migration status:", error.message);
  } finally {
    client.release();
  }
}

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
        console.log("Usage: node migrateWebhookApiEnhancements.js [migrate|status]");
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
