# Audience Parameter Validation

This document describes the audience parameter validation feature that ensures audience data contains all required attributes defined in the campaign's template parameters.

## Overview

When adding audience to a campaign, the system now validates that each audience member's attributes contain all the required parameters defined by the admin during template approval. This ensures that WhatsApp template messages can be properly generated with all necessary parameter values.

## How It Works

### 1. Template Parameter Definition
During template admin approval, administrators define parameter mappings:
```json
{
  "1": "customer_name",
  "2": "order_number", 
  "3": "pickup_location"
}
```

### 2. Audience Validation
When adding audience to a campaign, the system:
1. Retrieves the campaign's template
2. Checks if the template has admin-defined parameters
3. Validates that each audience member has all required attributes
4. Rejects the request if any required attributes are missing

### 3. Validation Rules
- **Required**: All attributes defined in template parameters must be present
- **Non-empty**: Attribute values cannot be null, undefined, or empty string
- **Case-sensitive**: Attribute names must match exactly
- **Extra attributes allowed**: Audience can have additional attributes beyond required ones

## API Endpoint

### Add Audience to Campaign
```http
POST /api/campaigns/:campaignId/audience
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "audience_list": [
    {
      "name": "John Doe",
      "msisdn": "+1234567890",
      "attributes": {
        "customer_name": "John Doe",
        "order_number": "ORD-12345",
        "pickup_location": "Downtown Store"
      }
    }
  ]
}
```

## Validation Scenarios

### ✅ Valid Request
**Template Parameters:**
```json
{
  "1": "customer_name",
  "2": "order_number"
}
```

**Audience Data:**
```json
{
  "name": "John Doe",
  "msisdn": "+1234567890",
  "attributes": {
    "customer_name": "John Doe",
    "order_number": "ORD-12345",
    "email": "john@example.com"  // Extra attributes are allowed
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Audience added to campaign successfully",
  "data": {
    "total_processed": 1,
    "successful": 1,
    "failed": 0
  }
}
```

### ❌ Invalid Request - Missing Attributes
**Template Parameters:**
```json
{
  "1": "customer_name",
  "2": "order_number",
  "3": "pickup_location"
}
```

**Audience Data:**
```json
{
  "name": "Jane Smith",
  "msisdn": "+1234567891",
  "attributes": {
    "customer_name": "Jane Smith"
    // Missing: order_number, pickup_location
  }
}
```

**Response:**
```json
{
  "success": false,
  "message": "Template parameter validation failed. Required attributes based on template parameters: [customer_name, order_number, pickup_location]. Errors: Audience 1 (+1234567891): Missing required attributes [order_number, pickup_location]"
}
```

### ❌ Invalid Request - Empty Values
**Audience Data:**
```json
{
  "name": "Bob Wilson",
  "msisdn": "+1234567892",
  "attributes": {
    "customer_name": "Bob Wilson",
    "order_number": "",           // Empty string - invalid
    "pickup_location": null       // Null value - invalid
  }
}
```

**Response:**
```json
{
  "success": false,
  "message": "Template parameter validation failed. Required attributes based on template parameters: [customer_name, order_number, pickup_location]. Errors: Audience 1 (+1234567892): Missing required attributes [order_number, pickup_location]"
}
```

### ✅ Multiple Audience Members
**Request:**
```json
{
  "audience_list": [
    {
      "name": "Alice Brown",
      "msisdn": "+1111111111",
      "attributes": {
        "customer_name": "Alice Brown",
        "order_number": "ORD-001",
        "pickup_location": "Store A"
      }
    },
    {
      "name": "Charlie Davis",
      "msisdn": "+2222222222",
      "attributes": {
        "customer_name": "Charlie Davis",
        "order_number": "ORD-002",
        "pickup_location": "Store B"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Audience added to campaign successfully",
  "data": {
    "total_processed": 2,
    "successful": 2,
    "failed": 0
  }
}
```

## When Validation is Skipped

Validation is automatically skipped in these cases:

1. **Template not admin approved:**
   ```json
   {
     "approved_by_admin": "pending"  // or "rejected"
   }
   ```

2. **No parameters defined:**
   ```json
   {
     "approved_by_admin": "approved",
     "parameters": {}  // or null
   }
   ```

3. **Legacy templates:**
   - Templates created before the admin approval feature
   - Templates with empty parameter mappings

## Error Handling

### Multiple Validation Errors
When multiple audience members have missing attributes:

**Response:**
```json
{
  "success": false,
  "message": "Template parameter validation failed. Required attributes based on template parameters: [customer_name, order_number, pickup_location]. Errors: Audience 1 (+1111111111): Missing required attributes [pickup_location]; Audience 2 (+2222222222): Missing required attributes [order_number, pickup_location]"
}
```

### Error Message Format
```
Template parameter validation failed. 
Required attributes based on template parameters: [attribute1, attribute2, ...]. 
Errors: Audience X (phone): Missing required attributes [missing1, missing2]; ...
```

## Implementation Details

### Validation Logic Location
- **File**: `controllers/audienceController.js`
- **Function**: `addAudienceToCampaign`
- **Validation occurs**: After campaign access checks, before adding audience to database

### Performance Considerations
- Template is fetched once per request (not per audience member)
- Validation runs in memory before database operations
- Failed validation prevents any database writes
- Logging includes validation results for monitoring

### Security
- Only organization admins and above can add audience
- Template parameter validation respects organization boundaries
- No sensitive data is logged in validation errors

## Testing

### Unit Tests
```bash
node scripts/testAudienceParameterValidation.js
```

### Integration Tests
```bash
node scripts/testAudienceValidationIntegration.js
```

## Benefits

1. **Data Quality**: Ensures all required template parameters have values
2. **Error Prevention**: Catches missing data before message generation
3. **User Experience**: Clear error messages help users fix data issues
4. **Campaign Success**: Reduces failed message deliveries due to missing parameters
5. **Audit Trail**: Validation results are logged for monitoring and debugging

## Migration Impact

- **Existing campaigns**: Not affected by validation changes
- **Existing audience**: Can still be used in campaigns
- **New audience**: Must pass validation for admin-approved templates
- **Backward compatibility**: Templates without admin parameters work as before

## Best Practices

1. **Template Design**: Define clear, meaningful parameter names
2. **Data Preparation**: Ensure audience data includes all required attributes
3. **Error Handling**: Check API responses and handle validation errors gracefully
4. **Testing**: Validate audience data before bulk uploads
5. **Monitoring**: Monitor validation logs for common data quality issues
