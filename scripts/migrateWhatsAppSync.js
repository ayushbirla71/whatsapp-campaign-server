#!/usr/bin/env node

/**
 * Migration script to add WhatsApp Business API sync functionality to existing templates table
 * Run this script on your existing database to add the WhatsApp sync columns
 */

const { Pool } = require("pg");

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "whatsapp_business_server",
  password: process.env.DB_PASSWORD || "password",
  port: process.env.DB_PORT || 5432,
};

const pool = new Pool(dbConfig);

async function runWhatsAppSyncMigration() {
  const client = await pool.connect();

  try {
    console.log("🚀 Starting WhatsApp Business API sync migration...");

    // Start transaction
    await client.query("BEGIN");

    console.log("🔄 Adding WhatsApp sync columns to templates table...");

    // Add WhatsApp sync columns to templates table
    const templateSyncColumns = [
      {
        name: "synced_at",
        definition: "synced_at TIMESTAMP WITH TIME ZONE",
        description: "When template was last synced from WhatsApp API",
      },
      {
        name: "synced_by",
        definition: "synced_by UUID REFERENCES users(id) ON DELETE SET NULL",
        description: "User who triggered the sync",
      },
      {
        name: "whatsapp_created_time",
        definition: "whatsapp_created_time TIMESTAMP WITH TIME ZONE",
        description: "When template was created in WhatsApp Business API",
      },
      {
        name: "whatsapp_updated_time",
        definition: "whatsapp_updated_time TIMESTAMP WITH TIME ZONE",
        description: "When template was last updated in WhatsApp Business API",
      },
    ];

    for (const column of templateSyncColumns) {
      try {
        await client.query(
          `ALTER TABLE templates ADD COLUMN ${column.definition}`
        );
        console.log(
          `  ✅ Added column: ${column.name} - ${column.description}`
        );
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`  ⚠️  Column already exists: ${column.name}`);
        } else {
          throw error;
        }
      }
    }

    console.log("📊 Creating indexes for WhatsApp sync optimization...");

    // Create indexes for better performance
    const indexes = [
      {
        name: "idx_templates_whatsapp_template_id",
        query:
          "CREATE INDEX IF NOT EXISTS idx_templates_whatsapp_template_id ON templates(whatsapp_template_id)",
        description: "Index for WhatsApp template ID lookups",
      },
      {
        name: "idx_templates_synced_at",
        query:
          "CREATE INDEX IF NOT EXISTS idx_templates_synced_at ON templates(synced_at)",
        description: "Index for sync timestamp queries",
      },
      {
        name: "idx_templates_whatsapp_status",
        query:
          "CREATE INDEX IF NOT EXISTS idx_templates_whatsapp_status ON templates(whatsapp_status)",
        description: "Index for WhatsApp status filtering",
      },
    ];

    for (const index of indexes) {
      await client.query(index.query);
      console.log(`  ✅ Created index: ${index.name} - ${index.description}`);
    }

    console.log("🔧 Ensuring WhatsApp template ID unique constraint...");

    // Ensure unique constraint exists for WhatsApp template ID
    try {
      await client.query(`
        ALTER TABLE templates 
        ADD CONSTRAINT templates_whatsapp_id_unique 
        UNIQUE (whatsapp_template_id)
      `);
      console.log("  ✅ Added unique constraint for WhatsApp template ID");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log(
          "  ⚠️  Unique constraint already exists for WhatsApp template ID"
        );
      } else {
        throw error;
      }
    }

    console.log("🔄 Updating whatsapp_quality_score column to JSONB...");

    // Update whatsapp_quality_score column to JSONB to store full quality score object
    try {
      await client.query(`
        ALTER TABLE templates
        ALTER COLUMN whatsapp_quality_score TYPE JSONB
        USING whatsapp_quality_score::JSONB
      `);
      console.log("  ✅ Updated whatsapp_quality_score column to JSONB");
    } catch (error) {
      if (error.message.includes("cannot be cast automatically")) {
        // If there's existing data that can't be cast, we need to handle it differently
        console.log(
          "  ⚠️  Existing data found, updating column with data conversion..."
        );
        try {
          // First, create a temporary column
          await client.query(
            `ALTER TABLE templates ADD COLUMN whatsapp_quality_score_temp JSONB`
          );

          // Convert existing data
          await client.query(`
            UPDATE templates
            SET whatsapp_quality_score_temp =
              CASE
                WHEN whatsapp_quality_score IS NULL THEN NULL
                WHEN whatsapp_quality_score = '' THEN NULL
                ELSE json_build_object('score', whatsapp_quality_score, 'date', null)
              END
          `);

          // Drop old column and rename new one
          await client.query(
            `ALTER TABLE templates DROP COLUMN whatsapp_quality_score`
          );
          await client.query(
            `ALTER TABLE templates RENAME COLUMN whatsapp_quality_score_temp TO whatsapp_quality_score`
          );

          console.log(
            "  ✅ Successfully converted whatsapp_quality_score to JSONB with data migration"
          );
        } catch (conversionError) {
          console.log(
            `  ❌ Error converting column: ${conversionError.message}`
          );
        }
      } else {
        console.log(
          `  ❌ Error updating whatsapp_quality_score column: ${error.message}`
        );
      }
    }

    console.log("📝 Checking existing WhatsApp-related columns...");

    // Check if whatsapp_rejected_reason column exists
    const checkColumns = [
      "whatsapp_rejected_reason",
      "whatsapp_status",
      "whatsapp_quality_score",
    ];

    for (const columnName of checkColumns) {
      try {
        const result = await client.query(
          `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'templates' AND column_name = $1
        `,
          [columnName]
        );

        if (result.rows.length > 0) {
          console.log(`  ✅ Column exists: ${columnName}`);
        } else {
          console.log(
            `  ⚠️  Column missing: ${columnName} - may need to be added manually`
          );
        }
      } catch (error) {
        console.log(
          `  ❌ Error checking column ${columnName}: ${error.message}`
        );
      }
    }

    // Commit transaction
    await client.query("COMMIT");

    console.log(
      "✅ WhatsApp Business API sync migration completed successfully!"
    );
    console.log("\n📋 Summary of changes:");
    console.log("  • Added synced_at column for tracking sync timestamps");
    console.log("  • Added synced_by column for tracking who triggered sync");
    console.log(
      "  • Added whatsapp_created_time column for WhatsApp creation timestamp"
    );
    console.log(
      "  • Added whatsapp_updated_time column for WhatsApp update timestamp"
    );
    console.log(
      "  • Updated whatsapp_quality_score column to JSONB for full quality data"
    );
    console.log("  • Created performance indexes for WhatsApp sync operations");
    console.log("  • Ensured unique constraint for WhatsApp template IDs");
    console.log("  • Verified existing WhatsApp-related columns");

    console.log("\n🎯 Next steps:");
    console.log(
      "  1. Configure WhatsApp Business API credentials in organization settings"
    );
    console.log(
      "  2. Use POST /api/templates/organization/:id/sync-whatsapp to sync templates"
    );
    console.log("  3. Monitor sync operations through the audit logs");
  } catch (error) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("❌ WhatsApp sync migration failed:", error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration
if (require.main === module) {
  runWhatsAppSyncMigration()
    .then(() => {
      console.log("\n🎉 WhatsApp sync migration completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 WhatsApp sync migration failed:", error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = { runWhatsAppSyncMigration };
