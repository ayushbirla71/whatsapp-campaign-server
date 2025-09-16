# WhatsApp Server API - Postman Collection Guide

This guide explains how to use the updated Postman collection that includes the new template admin approval workflow and audience parameter validation features.

## Collection Overview

The **Complete WhatsApp Server API** collection now includes:
- ✅ Authentication endpoints
- ✅ User and organization management
- ✅ Template management with admin approval workflow
- ✅ Campaign management with audience parameter validation
- ✅ Audience management with enhanced validation
- ✅ Webhook and message handling

## New Features Added

### 1. Template Admin Approval Endpoints

#### Get Pending Admin Approval Templates
- **Method**: `GET`
- **Endpoint**: `/api/templates/pending-admin-approval`
- **Purpose**: Retrieve templates that need admin approval for campaign usage
- **Auto-saves**: First template ID as `pendingAdminTemplateId` variable

#### Admin Approve Template
- **Method**: `POST`
- **Endpoint**: `/api/templates/{pendingAdminTemplateId}/admin-approve`
- **Purpose**: Approve template with parameter mapping for campaign usage
- **Body Example**:
```json
{
    "parameters": {
        "1": "customer_name",
        "2": "order_number",
        "3": "pickup_location"
    }
}
```

#### Admin Reject Template
- **Method**: `POST`
- **Endpoint**: `/api/templates/{pendingAdminTemplateId}/admin-reject`
- **Purpose**: Reject template for campaign usage
- **Body Example**:
```json
{
    "rejection_reason": "Parameter mapping not suitable for campaign usage. Please review the template structure and parameter requirements."
}
```

#### Update Template Parameters
- **Method**: `PUT`
- **Endpoint**: `/api/templates/{templateId}/parameters`
- **Purpose**: Update parameter mappings for approved templates
- **Body Example**:
```json
{
    "parameters": {
        "1": "customer_name",
        "2": "order_number",
        "3": "pickup_location",
        "4": "delivery_date"
    }
}
```

### 2. Enhanced Audience Management

#### Add Audience to Campaign (Valid Parameters)
- **Method**: `POST`
- **Endpoint**: `/api/campaigns/{campaignId}/audience`
- **Purpose**: Add audience with valid template parameters
- **Body Example**:
```json
{
    "audience_list": [
        {
            "name": "John Doe",
            "msisdn": "+1234567890",
            "attributes": {
                "customer_name": "John Doe",
                "order_number": "ORD-12345",
                "pickup_location": "Downtown Store",
                "email": "john@example.com"
            }
        }
    ]
}
```

#### Add Audience to Campaign (Invalid Parameters)
- **Method**: `POST`
- **Endpoint**: `/api/campaigns/{campaignId}/audience`
- **Purpose**: Test parameter validation with missing required attributes
- **Expected**: HTTP 400 with validation error message

## Environment Variables

The collection uses these environment variables:

| Variable | Description | Auto-populated |
|----------|-------------|----------------|
| `baseUrl` | Server base URL (default: http://localhost:3000) | No |
| `accessToken` | JWT access token for authentication | Yes (from login) |
| `refreshToken` | JWT refresh token | Yes (from login) |
| `userId` | Current user ID | Yes (from login) |
| `organizationId` | Current organization ID | Yes (from login) |
| `templateId` | Template ID for operations | Yes (from template creation) |
| `pendingTemplateId` | Template ID pending approval | Yes (from pending templates) |
| `pendingAdminTemplateId` | Template ID pending admin approval | Yes (from admin pending) |
| `campaignId` | Campaign ID for operations | Yes (from campaign creation) |

## Usage Workflow

### 1. Authentication
1. Run **"Login Super Admin"** to authenticate
2. Access token and user details are automatically saved

### 2. Template Admin Approval Workflow
1. **Create Template** → Creates a new template
2. **Submit for Approval** → Submits template for standard approval
3. **Get Pending Approval Templates** → Lists templates pending approval
4. **Approve Template** → Approves template for WhatsApp API
5. **Get Pending Admin Approval Templates** → Lists templates pending admin approval
6. **Admin Approve Template** → Approves template with parameter mapping
7. Template is now ready for campaign usage

### 3. Campaign with Audience Validation
1. **Create Campaign** → Creates campaign with admin-approved template
2. **Add Audience (Valid Parameters)** → Adds audience with correct attributes
3. **Add Audience (Invalid Parameters)** → Tests validation (should fail)
4. **Launch Campaign** → Starts campaign execution

### 4. Testing Parameter Validation
1. Use **"Admin Approve Template"** with parameter mapping
2. Try **"Add Audience (Valid Parameters)"** → Should succeed
3. Try **"Add Audience (Invalid Parameters)"** → Should fail with detailed error

## Test Scripts

The collection includes automated test scripts that:

### Template Admin Approval Tests
- ✅ Save template IDs for chaining requests
- ✅ Validate response structure
- ✅ Log parameter mapping results
- ✅ Check approval status changes

### Audience Validation Tests
- ✅ Verify successful audience addition
- ✅ Detect parameter validation errors
- ✅ Log validation results
- ✅ Confirm error message format

## Error Scenarios

### Template Admin Approval Errors
- **403 Forbidden**: Only super_admin/system_admin can approve
- **404 Not Found**: Template doesn't exist
- **400 Bad Request**: Invalid parameter mapping format

### Audience Parameter Validation Errors
- **400 Bad Request**: Missing required template parameters
- **400 Bad Request**: Empty or null parameter values
- **400 Bad Request**: Template not admin approved

## Response Examples

### Successful Admin Approval
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

### Parameter Validation Error
```json
{
    "success": false,
    "message": "Template parameter validation failed. Required attributes based on template parameters: [customer_name, order_number, pickup_location]. Errors: Audience 1 (+1234567892): Missing required attributes [order_number, pickup_location]"
}
```

## Best Practices

### 1. Request Ordering
- Always authenticate first
- Follow the template approval workflow in sequence
- Test with valid data before invalid data

### 2. Environment Management
- Use different environments for development/staging/production
- Keep access tokens secure
- Update base URL for different environments

### 3. Error Handling
- Check response status codes
- Read error messages for debugging
- Use test scripts to automate validation

### 4. Parameter Mapping
- Define clear, meaningful parameter names
- Ensure parameter mappings match template structure
- Test with real audience data

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Check if access token is valid
   - Re-run login if token expired

2. **Template Not Found**
   - Verify template ID variables are set
   - Check if template exists in organization

3. **Parameter Validation Failures**
   - Ensure template has admin approval
   - Check parameter mapping configuration
   - Verify audience attributes match requirements

4. **Permission Denied**
   - Confirm user has required role (super_admin/system_admin)
   - Check organization access permissions

## Collection Maintenance

### Adding New Endpoints
1. Follow existing naming conventions
2. Include test scripts for validation
3. Use environment variables for IDs
4. Add comprehensive error handling

### Updating Examples
1. Keep request bodies realistic
2. Update parameter mappings as needed
3. Maintain backward compatibility
4. Document breaking changes

This collection provides a complete testing environment for the WhatsApp Server API with full support for the new admin approval and parameter validation features.
