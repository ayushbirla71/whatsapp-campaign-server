# Template Admin Approval Process

This document describes the enhanced template approval workflow that requires admin approval with parameter mapping before templates can be used for campaign creation.

## Overview

The template approval process now has two stages:

1. **Template Approval**: Standard approval by super/system admin for WhatsApp Business API compliance
2. **Admin Approval for Campaign Usage**: Additional approval with parameter mapping configuration required before templates can be used in campaigns

## Database Schema Changes

### New Columns Added to `templates` Table

```sql
-- Admin Approval for Campaign Usage
approved_by_admin admin_approval_status DEFAULT 'pending',
admin_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
admin_approved_at TIMESTAMP WITH TIME ZONE,
admin_rejected_at TIMESTAMP WITH TIME ZONE,
admin_rejection_reason TEXT,
parameters JSONB DEFAULT '{}', -- Parameter mappings defined by admin during approval
```

### New Enum Type

```sql
CREATE TYPE admin_approval_status AS ENUM ('pending', 'rejected', 'approved');
```

## Workflow

### 1. Template Creation and Standard Approval

1. Organization admin creates template
2. Template is submitted for approval (`status = 'pending_approval'`)
3. Super/system admin approves template (`status = 'approved'`)
4. Template is now approved but `approved_by_admin = 'pending'`

### 2. Admin Approval for Campaign Usage

1. Super/system admin reviews approved templates pending admin approval
2. Admin defines parameter mappings for WhatsApp template placeholders ({{1}}, {{2}}, etc.)
3. Admin approves template for campaign usage (`approved_by_admin = 'approved'`)
4. Template can now be used for campaign creation

### 3. Campaign Creation

1. Campaign creation now validates that template has `approved_by_admin = 'approved'`
2. Only admin-approved templates can be used for campaigns

### 4. Message Generation

1. When generating messages for SQS, the system uses admin-defined parameter mappings
2. WhatsApp template parameters {{1}}, {{2}}, etc. are mapped to campaign audience attributes
3. Values are extracted from audience data using the admin-defined mappings

## API Endpoints

### Get Pending Admin Approval Templates

```http
GET /api/templates/pending-admin-approval
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "template-id",
        "name": "Marketing Template",
        "status": "approved",
        "approved_by_admin": "pending",
        "components": [...],
        "organization_name": "Example Org"
      }
    ]
  }
}
```

### Admin Approve Template

```http
POST /api/templates/:templateId/admin-approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "parameters": {
    "1": "customer_name",
    "2": "order_number", 
    "3": "pickup_location"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Template admin approved successfully",
  "data": {
    "template": {
      "id": "template-id",
      "approved_by_admin": "approved",
      "parameters": {
        "1": "customer_name",
        "2": "order_number",
        "3": "pickup_location"
      }
    }
  }
}
```

### Admin Reject Template

```http
POST /api/templates/:templateId/admin-reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "rejection_reason": "Parameter mapping not suitable for campaign usage"
}
```

### Update Template Parameters

```http
PUT /api/templates/:templateId/parameters
Authorization: Bearer <token>
Content-Type: application/json

{
  "parameters": {
    "1": "customer_name",
    "2": "order_number",
    "3": "pickup_location"
  }
}
```

## Parameter Mapping

### How It Works

1. **WhatsApp Template**: Contains placeholders like `{{1}}`, `{{2}}`, `{{3}}`
2. **Admin Mapping**: Defines which audience attribute each placeholder maps to
3. **Campaign Audience**: Contains attributes that provide the actual values

### Example

**Template Body Text:**
```
Hello {{1}}, your order {{2}} is ready for pickup at {{3}}!
```

**Admin Parameter Mapping:**
```json
{
  "1": "customer_name",
  "2": "order_number", 
  "3": "pickup_location"
}
```

**Campaign Audience Data:**
```json
{
  "name": "John Doe",
  "msisdn": "+1234567890",
  "attributes": {
    "customer_name": "John Doe",
    "order_number": "ORD-12345",
    "pickup_location": "Downtown Store"
  }
}
```

**Generated Message:**
```
Hello John Doe, your order ORD-12345 is ready for pickup at Downtown Store!
```

## Message Generation Process

### Template Message Generation

When generating template messages for SQS, the system:

1. Extracts template parameters from the template components
2. Uses admin-defined parameter mappings to resolve placeholder values
3. Falls back to legacy parameter mapping if admin mappings are not defined
4. Generates WhatsApp API-compatible message payload

### SQS Message Payload

```json
{
  "organizationId": "org-id",
  "campaignId": "campaign-id", 
  "campaignAudienceId": "audience-id",
  "to": "+1234567890",
  "templateName": "marketing_template",
  "templateLanguage": "en",
  "templateParameters": [
    {
      "type": "body",
      "valueType": "text",
      "value": "John Doe"
    },
    {
      "type": "body", 
      "valueType": "text",
      "value": "ORD-12345"
    },
    {
      "type": "body",
      "valueType": "text", 
      "value": "Downtown Store"
    }
  ]
}
```

## Migration

### Running the Migration

```bash
node scripts/migrateTemplateAdminApproval.js
```

This script:
- Creates the new enum type if it doesn't exist
- Adds new columns to the templates table
- Sets default values for existing templates
- Creates necessary indexes

### Post-Migration Steps

1. All existing approved templates will have `approved_by_admin = 'pending'`
2. Super/system admins need to review and approve templates for campaign usage
3. Define parameter mappings for each template during approval

## Testing

### Running Tests

```bash
node scripts/testTemplateAdminApproval.js
```

This test script verifies:
- Template admin approval workflow
- Parameter mapping configuration
- Campaign creation validation
- Message generation with admin parameters
- Legacy parameter fallback
- Parameter extraction and placeholder replacement

## Security Considerations

1. Only super_admin and system_admin roles can perform admin approval
2. Parameter mappings are validated to ensure they are valid objects
3. Campaign creation is blocked for templates without admin approval
4. All approval actions are logged for audit purposes

## Backward Compatibility

- Existing templates continue to work but require admin approval for new campaigns
- Legacy parameter mapping (`param_1`, `param_2`, etc.) is maintained as fallback
- Existing campaigns are not affected by the changes
