-- Create database schema for WhatsApp Server

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types for user roles and organization status
CREATE TYPE user_role AS ENUM ('super_admin', 'system_admin', 'organization_admin', 'organization_user');
CREATE TYPE organization_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE template_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'active', 'paused');
CREATE TYPE template_category AS ENUM ('AUTHENTICATION', 'MARKETING', 'UTILITY');
CREATE TYPE template_language AS ENUM ('en', 'en_US', 'es', 'es_ES', 'pt_BR', 'hi', 'ar', 'fr', 'de', 'it', 'ja', 'ko', 'ru', 'zh_CN', 'zh_TW');
CREATE TYPE campaign_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'scheduled', 'running', 'paused', 'completed', 'cancelled');
CREATE TYPE campaign_type AS ENUM ('immediate', 'scheduled', 'recurring');

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status organization_status DEFAULT 'active',
    
    -- WhatsApp Business API fields (encrypted)
    whatsapp_business_account_id TEXT,
    whatsapp_access_token TEXT,
    whatsapp_phone_number_id TEXT,
    whatsapp_webhook_verify_token TEXT,
    whatsapp_webhook_url TEXT,
    whatsapp_app_id TEXT,
    whatsapp_app_secret TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    CONSTRAINT organizations_name_unique UNIQUE (name)
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Organization relationship (NULL for system-level users)
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Authentication fields
    last_login TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    -- Constraints
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_org_role_check CHECK (
        (role IN ('super_admin', 'system_admin') AND organization_id IS NULL) OR
        (role IN ('organization_admin', 'organization_user') AND organization_id IS NOT NULL)
    )
);

-- WhatsApp Business API Templates table
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- WhatsApp Template Details
    whatsapp_template_id VARCHAR(255), -- ID from WhatsApp Business API
    name VARCHAR(255) NOT NULL,
    category template_category NOT NULL,
    language template_language NOT NULL DEFAULT 'en',

    -- Template Content
    header_type VARCHAR(50), -- TEXT, IMAGE, VIDEO, DOCUMENT
    header_text TEXT,
    header_media_url TEXT,
    body_text TEXT NOT NULL,
    footer_text TEXT,

    -- Template Components (stored as JSON)
    components JSONB,

    -- Approval Workflow
    status template_status DEFAULT 'draft',
    submitted_for_approval_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,

    -- WhatsApp API Status
    whatsapp_status VARCHAR(50), -- PENDING, APPROVED, REJECTED, DISABLED
    whatsapp_quality_score VARCHAR(20), -- GREEN, YELLOW, RED

    -- Usage Statistics
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT templates_name_org_unique UNIQUE (name, organization_id, language),
    CONSTRAINT templates_whatsapp_id_unique UNIQUE (whatsapp_template_id)
);

-- Audience Master Table (Global audience database)
CREATE TABLE audience_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Contact Information
    name VARCHAR(255) NOT NULL,
    msisdn TEXT NOT NULL, -- Normalized E.164 format
    country_code VARCHAR(5),

    -- Additional Attributes (flexible JSON storage)
    last_known_attributes JSONB DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT audience_master_msisdn_org_unique UNIQUE (organization_id, msisdn)
);

-- Campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,

    -- Campaign Details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_type campaign_type DEFAULT 'immediate',

    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE,
    buffer_hours INTEGER DEFAULT 48, -- Default 2 day buffer

    -- Approval Workflow
    status campaign_status DEFAULT 'draft',
    submitted_for_approval_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,

    -- Audience and Statistics
    total_targeted_audience INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_read INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,

    -- Campaign Execution
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT campaigns_name_org_unique UNIQUE (name, organization_id),
    CONSTRAINT campaigns_scheduled_at_check CHECK (
        (campaign_type = 'immediate' AND scheduled_at IS NULL) OR
        (campaign_type IN ('scheduled', 'recurring') AND scheduled_at IS NOT NULL)
    )
);

-- Campaign Audience Association Table
CREATE TABLE campaign_audience (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Contact Information (denormalized for campaign execution)
    name VARCHAR(255) NOT NULL,
    msisdn TEXT NOT NULL, -- Normalized E.164 format

    -- Campaign-specific attributes (from upload)
    attributes JSONB DEFAULT '{}',

    -- Message Status
    message_status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, read, failed
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,

    -- WhatsApp Message ID
    whatsapp_message_id VARCHAR(255),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT campaign_audience_msisdn_unique UNIQUE (campaign_id, msisdn)
);

-- Refresh tokens table for JWT management
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT refresh_tokens_token_unique UNIQUE (token_hash)
);

-- Audit log table for tracking important actions
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_templates_organization_id ON templates(organization_id);
CREATE INDEX idx_templates_status ON templates(status);
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_language ON templates(language);
CREATE INDEX idx_templates_whatsapp_status ON templates(whatsapp_status);
CREATE INDEX idx_templates_created_by ON templates(created_by);
CREATE INDEX idx_audience_master_organization_id ON audience_master(organization_id);
CREATE INDEX idx_audience_master_msisdn ON audience_master(msisdn);
CREATE INDEX idx_audience_master_name ON audience_master(name);
CREATE INDEX idx_campaigns_organization_id ON campaigns(organization_id);
CREATE INDEX idx_campaigns_template_id ON campaigns(template_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_scheduled_at ON campaigns(scheduled_at);
CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX idx_campaign_audience_campaign_id ON campaign_audience(campaign_id);
CREATE INDEX idx_campaign_audience_organization_id ON campaign_audience(organization_id);
CREATE INDEX idx_campaign_audience_msisdn ON campaign_audience(msisdn);
CREATE INDEX idx_campaign_audience_message_status ON campaign_audience(message_status);

-- Create trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audience_master_updated_at BEFORE UPDATE ON audience_master
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_audience_updated_at BEFORE UPDATE ON campaign_audience
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
