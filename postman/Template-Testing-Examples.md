# WhatsApp Template Testing Examples

This document provides comprehensive examples for testing the WhatsApp Business API template management system.

## Template API Endpoints

### 1. Get Organization Templates
```
GET /api/templates/organization/{organizationId}?page=1&limit=10&status=draft&category=MARKETING
```

### 2. Create Template
```
POST /api/templates/organization/{organizationId}
```

### 3. Get Template by ID
```
GET /api/templates/{templateId}
```

### 4. Update Template
```
PUT /api/templates/{templateId}
```

### 5. Delete Template
```
DELETE /api/templates/{templateId}
```

### 6. Submit for Approval
```
POST /api/templates/{templateId}/submit-approval
```

### 7. Get Pending Approval Templates
```
GET /api/templates/pending-approval
```

### 8. Approve Template
```
POST /api/templates/{templateId}/approve
```

### 9. Reject Template
```
POST /api/templates/{templateId}/reject
```

## Sample Template Data

### Marketing Template Example
```json
{
  "name": "welcome_offer",
  "category": "MARKETING",
  "language": "en",
  "header_type": "TEXT",
  "header_text": "🎉 Welcome to Our Store!",
  "body_text": "Hi {{1}}, welcome to our store! Get {{2}}% off your first purchase with code WELCOME{{3}}. Valid until {{4}}.",
  "footer_text": "Terms and conditions apply",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "🎉 Welcome to Our Store!"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}}, welcome to our store! Get {{2}}% off your first purchase with code WELCOME{{3}}. Valid until {{4}}.",
      "example": {
        "body_text": [
          ["John", "20", "2024", "Dec 31, 2024"]
        ]
      }
    },
    {
      "type": "FOOTER",
      "text": "Terms and conditions apply"
    }
  ]
}
```

### Authentication Template Example
```json
{
  "name": "otp_verification",
  "category": "AUTHENTICATION",
  "language": "en",
  "body_text": "Your verification code is {{1}}. This code will expire in {{2}} minutes. Do not share this code with anyone.",
  "components": [
    {
      "type": "BODY",
      "text": "Your verification code is {{1}}. This code will expire in {{2}} minutes. Do not share this code with anyone.",
      "example": {
        "body_text": [
          ["123456", "5"]
        ]
      }
    }
  ]
}
```

### Utility Template Example
```json
{
  "name": "order_confirmation",
  "category": "UTILITY",
  "language": "en",
  "header_type": "TEXT",
  "header_text": "Order Confirmed",
  "body_text": "Hi {{1}}, your order #{{2}} has been confirmed. Total amount: ${{3}}. Estimated delivery: {{4}}.",
  "footer_text": "Track your order on our website",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Order Confirmed"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}}, your order #{{2}} has been confirmed. Total amount: ${{3}}. Estimated delivery: {{4}}.",
      "example": {
        "body_text": [
          ["Sarah", "ORD123456", "99.99", "Dec 25, 2024"]
        ]
      }
    },
    {
      "type": "FOOTER",
      "text": "Track your order on our website"
    }
  ]
}
```

### Template with Media Header
```json
{
  "name": "product_showcase",
  "category": "MARKETING",
  "language": "en",
  "header_type": "IMAGE",
  "header_media_url": "https://example.com/product-image.jpg",
  "body_text": "Check out our new {{1}}! Now available for just ${{2}}. Limited time offer!",
  "footer_text": "Shop now at our store",
  "components": [
    {
      "type": "HEADER",
      "format": "IMAGE",
      "example": {
        "header_url": ["https://example.com/product-image.jpg"]
      }
    },
    {
      "type": "BODY",
      "text": "Check out our new {{1}}! Now available for just ${{2}}. Limited time offer!",
      "example": {
        "body_text": [
          ["Smart Watch", "199.99"]
        ]
      }
    },
    {
      "type": "FOOTER",
      "text": "Shop now at our store"
    }
  ]
}
```

## Testing Workflow

### Phase 1: Template Creation and Management

1. **Create Marketing Template**
   - Use the marketing template example above
   - Should return 201 with template data

2. **Create Authentication Template**
   - Use the authentication template example
   - Should return 201 with template data

3. **Create Utility Template**
   - Use the utility template example
   - Should return 201 with template data

4. **Get Organization Templates**
   - Should return all templates for the organization
   - Test filtering by status, category, language

5. **Update Template**
   - Modify body text or add footer
   - Should return 200 with updated data

### Phase 2: Approval Workflow

6. **Submit Template for Approval**
   - Submit one of the created templates
   - Status should change to 'pending_approval'

7. **Get Pending Approval Templates** (as Super Admin)
   - Should show templates waiting for approval

8. **Approve Template** (as Super Admin)
   - Approve the submitted template
   - Status should change to 'approved'

9. **Submit Another Template and Reject It**
   - Submit another template
   - Reject it with a reason
   - Status should change to 'rejected'

### Phase 3: Permission Testing

10. **Test Organization Admin Permissions**
    - Login as organization admin
    - Should be able to create/update templates in their org
    - Should NOT be able to approve/reject templates

11. **Test Organization User Permissions**
    - Login as organization user
    - Should be able to view templates
    - Should NOT be able to create/update/delete templates

12. **Test Cross-Organization Access**
    - Try to access templates from different organization
    - Should return 403 Forbidden

## Error Testing Scenarios

### Validation Errors
```json
{
  "name": "",  // Empty name should fail
  "category": "INVALID",  // Invalid category should fail
  "body_text": ""  // Empty body should fail
}
```

### Duplicate Template
- Try creating template with same name and language in same organization
- Should return 409 Conflict

### Invalid Template ID
- Use non-existent UUID for template operations
- Should return 404 Not Found

### Unauthorized Operations
- Try to approve template as organization admin
- Should return 403 Forbidden

## Template Status Flow

```
draft → pending_approval → approved/rejected
                        ↓
                    (if rejected) → draft (can be resubmitted)
```

## WhatsApp Business API Integration Fields

When templates are approved and synced with WhatsApp:

```json
{
  "whatsapp_template_id": "12345678",
  "whatsapp_status": "APPROVED",
  "whatsapp_quality_score": "GREEN"
}
```

## Usage Statistics

Templates track usage statistics:

```json
{
  "sent_count": 1500,
  "delivered_count": 1450,
  "read_count": 1200
}
```

## Best Practices

1. **Template Naming**: Use descriptive, lowercase names with underscores
2. **Variables**: Use {{1}}, {{2}}, etc. for dynamic content
3. **Character Limits**: 
   - Header: 60 characters
   - Body: 1024 characters
   - Footer: 60 characters
4. **Categories**:
   - AUTHENTICATION: For OTP, verification codes
   - MARKETING: For promotional content
   - UTILITY: For transactional messages
5. **Languages**: Use proper language codes (en, es, pt_BR, etc.)

## Common Issues and Solutions

1. **Template Rejected**: Check WhatsApp Business API guidelines
2. **Variables Not Working**: Ensure proper {{1}}, {{2}} format
3. **Media Not Loading**: Verify media URL is accessible
4. **Permission Denied**: Check user role and organization access
5. **Duplicate Error**: Template name must be unique per organization and language
