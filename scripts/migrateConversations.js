const pool = require("../config/database");

/**
 * Migration script to add conversations and conversation_messages tables
 * This enables manual chat/chatbot functionality while preserving existing flows
 */

async function migrate() {
  const client = await pool.connect();

  try {
    console.log("Starting conversation tables migration...");

    await client.query("BEGIN");

    // Create enum types for conversations
    console.log("Creating enum types...");

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE conversation_status AS ENUM ('active', 'waiting', 'closed', 'archived');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE conversation_type AS ENUM ('campaign_reply', 'support', 'general');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE conversation_message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create conversations table
    console.log("Creating conversations table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        
        -- Customer information
        customer_phone VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255),
        customer_attributes JSONB DEFAULT '{}',
        
        -- Conversation metadata
        conversation_type conversation_type DEFAULT 'general',
        conversation_status conversation_status DEFAULT 'active',
        
        -- Related campaign (if conversation started from campaign reply)
        related_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        
        -- Assignment
        assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP WITH TIME ZONE,
        
        -- Conversation statistics
        total_messages INTEGER DEFAULT 0,
        unread_count INTEGER DEFAULT 0,
        last_message_at TIMESTAMP WITH TIME ZONE,
        last_message_preview TEXT,
        
        -- Tags and notes
        tags TEXT[] DEFAULT '{}',
        notes TEXT,
        
        -- Metadata
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP WITH TIME ZONE,
        closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        
        -- Unique constraint: one conversation per customer per organization
        CONSTRAINT conversations_customer_org_unique UNIQUE (organization_id, customer_phone)
      );
    `);

    // Create conversation_messages table
    console.log("Creating conversation_messages table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        
        -- Message direction and sender
        direction message_direction NOT NULL,
        sent_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        
        -- Message content
        message_type VARCHAR(50) DEFAULT 'text',
        message_content TEXT,
        media_url TEXT,
        media_type VARCHAR(50),
        caption TEXT,
        filename VARCHAR(255),
        
        -- WhatsApp message tracking
        whatsapp_message_id VARCHAR(255) UNIQUE,
        message_status conversation_message_status DEFAULT 'pending',
        
        -- Template information (for outbound template messages)
        template_name VARCHAR(255),
        template_language VARCHAR(10),
        template_parameters JSONB,
        
        -- Context (if replying to another message)
        context_message_id VARCHAR(255),
        
        -- Interactive message data
        interactive_type VARCHAR(50),
        interactive_data JSONB,
        
        -- Status timestamps
        sent_at TIMESTAMP WITH TIME ZONE,
        delivered_at TIMESTAMP WITH TIME ZONE,
        read_at TIMESTAMP WITH TIME ZONE,
        failed_at TIMESTAMP WITH TIME ZONE,
        failure_reason TEXT,
        
        -- Metadata
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for performance
    console.log("Creating indexes...");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_organization_id ON conversations(organization_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_customer_phone ON conversations(customer_phone);
      CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(conversation_status);
      CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON conversations(assigned_to_user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_related_campaign ON conversations(related_campaign_id);

      CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_organization_id ON conversation_messages(organization_id);
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_direction ON conversation_messages(direction);
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_whatsapp_id ON conversation_messages(whatsapp_message_id);
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_status ON conversation_messages(message_status);
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at);
    `);

    // Create triggers for auto-updating conversation statistics
    console.log("Creating triggers...");

    await client.query(`
      CREATE OR REPLACE FUNCTION update_conversation_on_message()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Update conversation statistics
        UPDATE conversations
        SET
          total_messages = total_messages + 1,
          last_message_at = NEW.created_at,
          last_message_preview = SUBSTRING(NEW.message_content, 1, 100),
          unread_count = CASE
            WHEN NEW.direction = 'inbound' THEN unread_count + 1
            ELSE unread_count
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.conversation_id;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON conversation_messages;
      CREATE TRIGGER trigger_update_conversation_on_message
        AFTER INSERT ON conversation_messages
        FOR EACH ROW
        EXECUTE FUNCTION update_conversation_on_message();
    `);

    // Create trigger for updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
      CREATE TRIGGER update_conversations_updated_at
        BEFORE UPDATE ON conversations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_conversation_messages_updated_at ON conversation_messages;
      CREATE TRIGGER update_conversation_messages_updated_at
        BEFORE UPDATE ON conversation_messages
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create helper function for getting or creating conversation
    console.log("Creating helper functions...");

    await client.query(`
      CREATE OR REPLACE FUNCTION get_or_create_conversation(
        p_organization_id UUID,
        p_customer_phone VARCHAR,
        p_customer_name VARCHAR DEFAULT NULL,
        p_conversation_type conversation_type DEFAULT 'general',
        p_related_campaign_id UUID DEFAULT NULL
      )
      RETURNS UUID AS $$
      DECLARE
        v_conversation_id UUID;
      BEGIN
        -- Try to find existing conversation
        SELECT id INTO v_conversation_id
        FROM conversations
        WHERE organization_id = p_organization_id
          AND customer_phone = p_customer_phone;

        -- If not found, create new conversation
        IF v_conversation_id IS NULL THEN
          INSERT INTO conversations (
            organization_id,
            customer_phone,
            customer_name,
            conversation_type,
            related_campaign_id
          ) VALUES (
            p_organization_id,
            p_customer_phone,
            p_customer_name,
            p_conversation_type,
            p_related_campaign_id
          )
          RETURNING id INTO v_conversation_id;
        END IF;

        RETURN v_conversation_id;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log("Migration completed successfully!");

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

migrate()
  .then(() => {
    console.log("✅ Conversation tables migration completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  });
