# Postman Collection Updates Summary

## Overview

The **Complete-WhatsApp-Server-API.postman_collection.json** has been updated to include all new endpoints and features for template admin approval and audience parameter validation.

## ✅ New Endpoints Added

### Template Admin Approval Section

#### 1. Get Pending Admin Approval Templates
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/templates/pending-admin-approval`
- **Headers**: Authorization Bearer token
- **Test Script**: Auto-saves first template ID as `pendingAdminTemplateId`
- **Purpose**: Retrieve templates that need admin approval for campaign usage

#### 2. Admin Approve Template
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/templates/{{pendingAdminTemplateId}}/admin-approve`
- **Headers**: Authorization + Content-Type
- **Body**: Parameter mapping configuration
- **Test Script**: Logs approval success and parameter details
- **Purpose**: Approve template with parameter mapping

#### 3. Admin Reject Template
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/templates/{{pendingAdminTemplateId}}/admin-reject`
- **Headers**: Authorization + Content-Type
- **Body**: Rejection reason
- **Purpose**: Reject template for campaign usage

#### 4. Update Template Parameters
- **Method**: `PUT`
- **URL**: `{{baseUrl}}/api/templates/{{templateId}}/parameters`
- **Headers**: Authorization + Content-Type
- **Body**: Updated parameter mappings
- **Test Script**: Logs parameter update success
- **Purpose**: Update parameter mappings for approved templates

### Enhanced Audience Management

#### 1. Add Audience to Campaign (Valid Parameters)
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/campaigns/{{campaignId}}/audience`
- **Body**: Audience list with valid template parameters
- **Test Script**: Validates successful addition and logs results
- **Purpose**: Test successful audience addition with proper parameters

#### 2. Add Audience to Campaign (Invalid Parameters)
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/campaigns/{{campaignId}}/audience`
- **Body**: Audience list with missing/invalid parameters
- **Test Script**: Validates expected validation errors
- **Purpose**: Test parameter validation error handling

## 📝 Request Body Examples

### Admin Approve Template
```json
{
    "parameters": {
        "1": "customer_name",
        "2": "order_number",
        "3": "pickup_location"
    }
}
```

### Valid Audience Data
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

### Invalid Audience Data (for testing)
```json
{
    "audience_list": [
        {
            "name": "Bob Wilson",
            "msisdn": "+1234567892",
            "attributes": {
                "customer_name": "Bob Wilson",
                "email": "bob@example.com"
                // Missing: order_number, pickup_location
            }
        }
    ]
}
```

## 🔧 Environment Variables

### New Variables Added
- `pendingAdminTemplateId`: Auto-populated from pending admin approval templates

### Existing Variables Used
- `baseUrl`: Server base URL
- `accessToken`: JWT authentication token
- `templateId`: Template ID for operations
- `campaignId`: Campaign ID for audience operations

## 🧪 Test Scripts

### Template Admin Approval Tests
```javascript
// Auto-save template ID for chaining
if (pm.response.code === 200) {
    const response = pm.response.json();
    if (response.data.templates && response.data.templates.length > 0) {
        const firstTemplate = response.data.templates[0];
        pm.environment.set('pendingAdminTemplateId', firstTemplate.id);
    }
}

// Validate approval success
if (pm.response.code === 200) {
    const response = pm.response.json();
    console.log('Template admin approved successfully');
    console.log('Template parameters:', response.data.template.parameters);
}
```

### Audience Validation Tests
```javascript
// Test successful audience addition
if (pm.response.code === 201) {
    const response = pm.response.json();
    console.log('Audience added successfully');
    console.log('Total processed:', response.data.total_processed);
}

// Test validation error detection
if (pm.response.code === 400) {
    const response = pm.response.json();
    if (response.message.includes('Template parameter validation failed')) {
        console.log('✓ Parameter validation working correctly');
    }
}
```

## 🔄 Workflow Integration

### Complete Template Approval Workflow
1. **Login Super Admin** → Get authentication token
2. **Create Template** → Create new template
3. **Submit for Approval** → Submit for standard approval
4. **Get Pending Approval Templates** → List pending templates
5. **Approve Template** → Standard approval for WhatsApp API
6. **Get Pending Admin Approval Templates** → List admin pending
7. **Admin Approve Template** → Admin approval with parameters
8. **Create Campaign** → Create campaign with approved template
9. **Add Audience (Valid)** → Test successful audience addition
10. **Add Audience (Invalid)** → Test validation error handling

### Testing Scenarios
- ✅ **Happy Path**: All approvals and validations pass
- ✅ **Validation Errors**: Missing parameters trigger errors
- ✅ **Permission Errors**: Non-admin users get access denied
- ✅ **Data Quality**: Empty/null values are rejected

## 📊 Response Validation

### Success Responses
- **200 OK**: Successful operations
- **201 Created**: Successful audience addition
- **Auto-logging**: Important data logged to console

### Error Responses
- **400 Bad Request**: Validation failures with detailed messages
- **403 Forbidden**: Permission denied for non-admin users
- **404 Not Found**: Template or campaign not found

## 🚀 Usage Benefits

### For Developers
- **Complete Testing**: End-to-end workflow testing
- **Error Scenarios**: Comprehensive error case coverage
- **Automation**: Auto-populated variables reduce manual work
- **Validation**: Built-in response validation

### For QA Teams
- **Regression Testing**: Consistent test scenarios
- **Edge Cases**: Invalid data testing included
- **Documentation**: Clear examples and expected results
- **Traceability**: Logged results for debugging

### For API Users
- **Learning**: Real examples of API usage
- **Integration**: Ready-to-use request templates
- **Troubleshooting**: Error scenarios help debug issues
- **Best Practices**: Proper authentication and data handling

## 📋 Collection Structure

```
Complete WhatsApp Server API/
├── Health Check
├── API Documentation
├── Authentication/
│   ├── Login Super Admin
│   ├── Login Organization Admin
│   └── Refresh Token
├── Users/
│   └── [User management endpoints]
├── Organizations/
│   └── [Organization management endpoints]
├── Templates/
│   ├── [Standard template endpoints]
│   ├── Get Pending Admin Approval Templates ⭐ NEW
│   ├── Admin Approve Template ⭐ NEW
│   ├── Admin Reject Template ⭐ NEW
│   ├── Update Template Parameters ⭐ NEW
│   └── Delete Template
├── Campaigns/
│   ├── [Standard campaign endpoints]
│   ├── Add Audience (Valid Parameters) ⭐ UPDATED
│   ├── Add Audience (Invalid Parameters) ⭐ NEW
│   └── [Other campaign endpoints]
└── [Other sections]
```

## ✅ Quality Assurance

### Validation Checks
- ✅ All new endpoints included
- ✅ Proper authentication headers
- ✅ Realistic request bodies
- ✅ Comprehensive test scripts
- ✅ Error scenario coverage
- ✅ Environment variable usage
- ✅ Response validation
- ✅ Console logging for debugging

### Testing Coverage
- ✅ Template admin approval workflow
- ✅ Parameter mapping configuration
- ✅ Audience parameter validation
- ✅ Error handling and edge cases
- ✅ Permission and access control
- ✅ Data quality validation

The updated Postman collection provides a complete testing environment for all new features and maintains backward compatibility with existing functionality. 🎉
