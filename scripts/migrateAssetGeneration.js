#!/usr/bin/env node

/**
 * Migration script to add asset generation functionality to existing WhatsApp server database
 * Run this script on your existing database to add the new tables and columns
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "whatsapp_business_server",
  password: process.env.DB_PASSWORD || "password",
  port: process.env.DB_PORT || 5432,
};

const pool = new Pool(dbConfig);

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log("🚀 Starting asset generation migration...");

    // Start transaction
    await client.query("BEGIN");

    console.log("📝 Adding new enum types...");

    // Add new enum types for asset generation
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE asset_generation_status AS ENUM ('pending', 'processing', 'generated', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE message_status_extended AS ENUM ('pending', 'asset_generating', 'asset_generated', 'ready_to_send', 'sent', 'delivered', 'read', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log("📋 Creating asset_generate_files table...");

    // Create asset_generate_files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_generate_files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_content TEXT NOT NULL,
        description TEXT,
        version VARCHAR(50) DEFAULT '1.0',
        is_active BOOLEAN DEFAULT true,
        
        -- Metadata
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        
        -- Constraints
        CONSTRAINT asset_files_template_filename_unique UNIQUE (template_id, file_name)
      );
    `);

    console.log("🔄 Adding asset generation columns to campaigns table...");

    // Add asset generation columns to campaigns table
    const campaignColumns = [
      "asset_generation_started_at TIMESTAMP WITH TIME ZONE",
      "asset_generation_completed_at TIMESTAMP WITH TIME ZONE",
      "asset_generation_status asset_generation_status",
      "asset_generation_retry_count INTEGER DEFAULT 0",
      "asset_generation_last_error TEXT",
      "asset_generation_progress JSONB DEFAULT '{}'",
    ];

    for (const column of campaignColumns) {
      try {
        await client.query(`ALTER TABLE campaigns ADD COLUMN ${column}`);
        console.log(`  ✅ Added column: ${column.split(" ")[0]}`);
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`  ⚠️  Column already exists: ${column.split(" ")[0]}`);
        } else {
          throw error;
        }
      }
    }

    console.log("📈 Updating campaign_status enum...");

    // Update campaign_status enum to include new statuses
    const newCampaignStatuses = [
      "asset_generation",
      "asset_generated",
      "ready_to_launch",
    ];

    for (const status of newCampaignStatuses) {
      try {
        await client.query(`ALTER TYPE campaign_status ADD VALUE '${status}'`);
        console.log(`  ✅ Added campaign status: ${status}`);
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`  ⚠️  Campaign status already exists: ${status}`);
        } else {
          throw error;
        }
      }
    }

    console.log(
      "👥 Adding asset generation columns to campaign_audience table..."
    );

    // Add asset generation columns to campaign_audience table
    const audienceColumns = [
      "asset_generation_status asset_generation_status",
      "generated_asset_urls JSONB DEFAULT '{}'",
      "asset_generation_retry_count INTEGER DEFAULT 0",
      "asset_generation_last_error TEXT",
      "asset_generation_started_at TIMESTAMP WITH TIME ZONE",
      "asset_generation_completed_at TIMESTAMP WITH TIME ZONE",
    ];

    for (const column of audienceColumns) {
      try {
        await client.query(
          `ALTER TABLE campaign_audience ADD COLUMN ${column}`
        );
        console.log(`  ✅ Added column: ${column.split(" ")[0]}`);
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`  ⚠️  Column already exists: ${column.split(" ")[0]}`);
        } else {
          throw error;
        }
      }
    }

    console.log("🔄 Updating message_status to extended enum...");

    // Update message_status to use extended enum
    try {
      // Add a new column with the extended enum
      await client.query(`
        ALTER TABLE campaign_audience 
        ADD COLUMN message_status_new message_status_extended DEFAULT 'pending'
      `);

      // Copy existing data
      await client.query(`
        UPDATE campaign_audience 
        SET message_status_new = CASE 
          WHEN message_status = 'pending' THEN 'pending'::message_status_extended
          WHEN message_status = 'sent' THEN 'sent'::message_status_extended
          WHEN message_status = 'delivered' THEN 'delivered'::message_status_extended
          WHEN message_status = 'read' THEN 'read'::message_status_extended
          WHEN message_status = 'failed' THEN 'failed'::message_status_extended
          ELSE 'pending'::message_status_extended
        END
      `);

      // Drop the old column and rename the new one
      await client.query(
        "ALTER TABLE campaign_audience DROP COLUMN message_status"
      );
      await client.query(
        "ALTER TABLE campaign_audience RENAME COLUMN message_status_new TO message_status"
      );

      console.log("  ✅ Updated message_status to extended enum");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("  ⚠️  Message status already updated");
      } else {
        throw error;
      }
    }

    console.log("🔄 Adding WhatsApp sync columns to templates table...");

    // Add WhatsApp sync columns to templates table
    const templateSyncColumns = [
      "synced_at TIMESTAMP WITH TIME ZONE",
      "synced_by UUID REFERENCES users(id) ON DELETE SET NULL",
      "whatsapp_created_time TIMESTAMP WITH TIME ZONE",
      "whatsapp_updated_time TIMESTAMP WITH TIME ZONE",
    ];

    for (const column of templateSyncColumns) {
      try {
        await client.query(`ALTER TABLE templates ADD COLUMN ${column}`);
        console.log(`  ✅ Added column: ${column.split(" ")[0]}`);
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`  ⚠️  Column already exists: ${column.split(" ")[0]}`);
        } else {
          throw error;
        }
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
        console.log("  ⚠️  Converting existing quality score data to JSONB...");
        try {
          await client.query(
            `ALTER TABLE templates ADD COLUMN whatsapp_quality_score_temp JSONB`
          );
          await client.query(`
            UPDATE templates
            SET whatsapp_quality_score_temp =
              CASE
                WHEN whatsapp_quality_score IS NULL THEN NULL
                WHEN whatsapp_quality_score = '' THEN NULL
                ELSE json_build_object('score', whatsapp_quality_score, 'date', null)
              END
          `);
          await client.query(
            `ALTER TABLE templates DROP COLUMN whatsapp_quality_score`
          );
          await client.query(
            `ALTER TABLE templates RENAME COLUMN whatsapp_quality_score_temp TO whatsapp_quality_score`
          );
          console.log(
            "  ✅ Successfully converted whatsapp_quality_score to JSONB"
          );
        } catch (conversionError) {
          console.log(
            `  ❌ Error converting quality score: ${conversionError.message}`
          );
        }
      } else {
        console.log(`  ⚠️  Quality score column update: ${error.message}`);
      }
    }

    console.log("📊 Creating indexes for better performance...");

    // Create indexes for better performance
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_asset_generate_files_template_id ON asset_generate_files(template_id)",
      "CREATE INDEX IF NOT EXISTS idx_asset_generate_files_is_active ON asset_generate_files(is_active)",
      "CREATE INDEX IF NOT EXISTS idx_campaigns_asset_generation_status ON campaigns(asset_generation_status)",
      "CREATE INDEX IF NOT EXISTS idx_campaign_audience_asset_generation_status ON campaign_audience(asset_generation_status)",
      "CREATE INDEX IF NOT EXISTS idx_templates_whatsapp_template_id ON templates(whatsapp_template_id)",
      "CREATE INDEX IF NOT EXISTS idx_templates_synced_at ON templates(synced_at)",
    ];

    for (const indexQuery of indexes) {
      await client.query(indexQuery);
      const indexName = indexQuery.match(/idx_\w+/)[0];
      console.log(`  ✅ Created index: ${indexName}`);
    }

    console.log("⚡ Creating triggers...");

    // Create trigger for updated_at on asset_generate_files
    await client.query(`
      CREATE OR REPLACE TRIGGER update_asset_generate_files_updated_at 
        BEFORE UPDATE ON asset_generate_files
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);
    console.log("  ✅ Created trigger for asset_generate_files");

    console.log("📝 Adding sample asset generation file...");

    // Insert sample asset generation file
    const sampleFileContent = `# Sample Asset Generation File
import os
from PIL import Image, ImageDraw, ImageFont
import json

def generate_asset(attributes, name, msisdn, temp_dir):
    """Generate personalized image asset"""
    try:
        # Create personalized image
        width, height = 800, 400
        image = Image.new("RGB", (width, height), color="white")
        draw = ImageDraw.Draw(image)
        
        # Add personalized text
        greeting = attributes.get("greeting", "Hello")
        text = f"{greeting} {name}!"
        
        try:
            font = ImageFont.truetype("arial.ttf", 40)
        except:
            font = ImageFont.load_default()
        
        # Center the text
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        x = (width - text_width) // 2
        y = height // 2 - 20
        
        draw.text((x, y), text, fill="black", font=font)
        
        # Save image
        image_path = os.path.join(temp_dir, f"personalized_{name.replace(' ', '_')}.png")
        image.save(image_path)
        
        return {"image": image_path}
    except Exception as e:
        print(f"Error: {e}")
        return None`;

    try {
      await client.query(
        `
        INSERT INTO asset_generate_files (template_id, file_name, file_content, description, created_by)
        SELECT 
          t.id,
          'sample_image_generator.py',
          $1,
          'Sample asset generation file for creating personalized images',
          (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
        FROM templates t 
        WHERE t.category = 'MARKETING' 
        LIMIT 1
        ON CONFLICT (template_id, file_name) DO NOTHING
      `,
        [sampleFileContent]
      );
      console.log("  ✅ Added sample asset generation file");
    } catch (error) {
      console.log(
        "  ⚠️  Sample file not added (no marketing templates found or already exists)"
      );
    }

    // Commit transaction
    await client.query("COMMIT");

    console.log("✅ Asset generation migration completed successfully!");
    console.log("\n📋 Summary of changes:");
    console.log(
      "  • Added asset_generation_status and message_status_extended enums"
    );
    console.log("  • Created asset_generate_files table");
    console.log("  • Added asset generation columns to campaigns table");
    console.log(
      "  • Added asset generation columns to campaign_audience table"
    );
    console.log("  • Added WhatsApp sync columns to templates table");
    console.log(
      "  • Updated whatsapp_quality_score column to JSONB for full quality data"
    );
    console.log("  • Updated campaign_status enum with new statuses");
    console.log("  • Updated message_status to extended enum");
    console.log(
      "  • Created performance indexes including WhatsApp sync indexes"
    );
    console.log("  • Added triggers for automatic timestamp updates");
    console.log("  • Inserted sample asset generation file");
  } catch (error) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log("\n🎉 Migration completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration failed:", error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = { runMigration };
