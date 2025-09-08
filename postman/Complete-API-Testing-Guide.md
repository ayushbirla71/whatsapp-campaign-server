# Complete WhatsApp Server API Testing Guide

This guide provides a comprehensive workflow for testing all APIs in the WhatsApp Business Server using the complete Postman collection.

## Setup Instructions

### 1. Import Files into Postman

1. **Import Collection**:

   - Open Postman
   - Click "Import" button
   - Select `Complete-WhatsApp-Server-API.postman_collection.json`

2. **Import Environment**:
   - Click "Import" button again
   - Select `Complete-WhatsApp-Server-Environment.postman_environment.json`
   - Select "Complete WhatsApp Server Environment" from the environment dropdown

### 2. Start Your Server

```bash
# Initialize database (first time only)
npm run db:init

# Start the development server
npm run dev
```

## Complete Testing Workflow

### Phase 1: System Health and Authentication

1. **Health Check**

   - Verify server is running
   - Expected: 200 OK with server status

2. **API Documentation**

   - View available endpoints
   - Expected: 200 OK with API documentation

3. **Login as Super Admin**

   - Uses default credentials: `superadmin@example.com` / `SuperAdmin123!`
   - Automatically sets `accessToken`, `refreshToken`, and `userId`
   - Expected: 200 OK with user data and tokens

4. **Get Profile**

   - Verify authentication works
   - Expected: 200 OK with super admin profile

5. **Validate Token**
   - Test token validation endpoint
   - Expected: 200 OK with token validation confirmation

### Phase 2: Organization Management

6. **Create Organization**

   - Creates test organization with WhatsApp Business API credentials
   - Automatically sets `organizationId` in environment
   - Expected: 201 Created with organization data
   - Note: WhatsApp credentials are encrypted in database

7. **Get All Organizations**

   - View all organizations with pagination
   - Expected: 200 OK with organizations list
   - WhatsApp fields show as [ENCRYPTED] for security

8. **Get Organization by ID**

   - Retrieve specific organization details
   - Expected: 200 OK with organization data

9. **Update Organization**

   - Modify organization details
   - Expected: 200 OK with updated data

10. **Update WhatsApp Config**

    - Update WhatsApp Business API credentials
    - Includes new fields: webhook verify token, webhook URL, app ID, app secret
    - Expected: 200 OK with update confirmation

11. **Get WhatsApp Config**
    - Retrieve decrypted WhatsApp configuration (admin only)
    - Expected: 200 OK with decrypted WhatsApp credentials

### Phase 3: User Management

12. **Create System Admin**

    - Create system administrator user
    - Sets `systemAdminUserId` in environment
    - Expected: 201 Created with system admin data

13. **Create Organization Admin**

    - Create organization administrator
    - Sets `orgAdminUserId` in environment
    - Expected: 201 Created with organization admin data

14. **Create Organization User**

    - Create regular organization user
    - Sets `orgUserId` in environment
    - Expected: 201 Created with organization user data

15. **Get All Users**

    - View all users with role-based filtering
    - Expected: 200 OK with users list

16. **Get User by ID**

    - Retrieve specific user details
    - Expected: 200 OK with user data

17. **Update User**

    - Modify user information
    - Expected: 200 OK with updated user data

18. **Get Organization Users**
    - View users belonging to the organization
    - Expected: 200 OK with organization users

### Phase 4: Template Management

19. **Get Organization Templates**

    - View templates for the organization (initially empty)
    - Expected: 200 OK with empty templates list

20. **Create Marketing Template**

    - Create welcome offer template with variables
    - Sets `templateId` in environment
    - Expected: 201 Created with template data

21. **Create Authentication Template**

    - Create OTP verification template
    - Expected: 201 Created with template data

22. **Create Utility Template**

    - Create order confirmation template
    - Expected: 201 Created with template data

23. **Get Template by ID**

    - Retrieve specific template details
    - Expected: 200 OK with template data including components

24. **Update Template**
    - Modify template content
    - Expected: 200 OK with updated template

### Phase 5: Template Approval Workflow

25. **Submit Template for Approval**

    - Submit marketing template for approval
    - Sets `pendingTemplateId` in environment
    - Expected: 200 OK with status change to 'pending_approval'

26. **Get Pending Approval Templates**

    - View templates waiting for approval (super/system admin only)
    - Expected: 200 OK with pending templates list

27. **Approve Template**

    - Approve the submitted template (super/system admin only)
    - Expected: 200 OK with status change to 'approved'

28. **Reject Template**
    - Submit another template and reject it with reason
    - Expected: 200 OK with status change to 'rejected'

### Phase 6: Authentication Features

29. **Login System Admin**

    - Login with created system admin credentials
    - Sets `systemAdminToken` and `systemAdminRefreshToken`
    - Expected: 200 OK with system admin tokens

30. **Refresh Token**

    - Test token refresh functionality
    - Updates tokens in environment
    - Expected: 200 OK with new tokens

31. **Change Password** (Optional)
    - Change user password (requires re-login)
    - Expected: 200 OK with password change confirmation

### Phase 7: Cleanup (Optional)

32. **Delete Template**

    - Delete a template (only draft/rejected templates)
    - Expected: 200 OK with deletion confirmation

33. **Delete User**

    - Delete a user (cannot delete yourself)
    - Expected: 200 OK with deletion confirmation

34. **Delete Organization**

    - Delete organization (only if no users associated)
    - Expected: 200 OK with deletion confirmation

35. **Logout**

    - Logout current user
    - Expected: 200 OK with logout confirmation

36. **Logout All Devices**
    - Logout from all devices
    - Expected: 200 OK with logout confirmation

### Phase 8: Campaign Management

37. **Get Organization Campaigns**

    - View campaigns for the organization (initially empty)
    - Expected: 200 OK with empty campaigns list

38. **Create Campaign**

    - Create welcome campaign using approved template
    - Sets `campaignId` in environment
    - Expected: 201 Created with campaign data
    - Note: Campaign starts in 'draft' status

39. **Get Campaign by ID**

    - Retrieve specific campaign details
    - Expected: 200 OK with campaign data including template info

40. **Update Campaign**

    - Modify campaign description and buffer hours
    - Expected: 200 OK with updated campaign

41. **Add Audience to Campaign**

    - Add multiple audience members with attributes
    - Updates campaign's total_targeted_audience
    - Expected: 200 OK with bulk operation results

42. **Get Campaign Audience**

    - View audience members added to campaign
    - Expected: 200 OK with audience list and message status

43. **Submit Campaign for Approval**

    - Submit campaign for approval (requires audience)
    - Sets `pendingCampaignId` in environment
    - Expected: 200 OK with status change to 'pending_approval'

44. **Get Pending Approval Campaigns**

    - View campaigns waiting for approval (super/system admin only)
    - Expected: 200 OK with pending campaigns list

45. **Approve Campaign**

    - Approve the submitted campaign (super/system admin only)
    - Expected: 200 OK with status change to 'approved'

46. **Start Campaign**

    - Start the approved campaign (super/system admin only)
    - Expected: 200 OK with status change to 'running'

47. **Pause Campaign**

    - Pause the running campaign (super/system admin only)
    - Expected: 200 OK with status change to 'paused'

48. **Cancel Campaign**

    - Cancel a campaign (admin can cancel their own)
    - Expected: 200 OK with status change to 'cancelled'

49. **Get Campaign Statistics**
    - View campaign statistics by organization
    - Expected: 200 OK with statistics grouped by status

### Phase 9: Audience Management

50. **Get Master Audience**

    - View master audience database for organization
    - Expected: 200 OK with audience records

51. **Create Master Audience Record**

    - Create individual audience record with attributes
    - Expected: 201 Created with audience data
    - Note: Phone numbers are normalized to E.164 format

52. **Bulk Create Master Audience**

    - Create multiple audience records at once
    - Expected: 200 OK with bulk operation results
    - Shows successful and failed records

53. **Remove Audience from Campaign**
    - Remove specific audience member from campaign
    - Updates campaign's total_targeted_audience
    - Expected: 200 OK with removal confirmation

### Phase 10: Campaign Workflow Testing

54. **Reject Campaign**

    - Create another campaign and reject it with reason
    - Expected: 200 OK with status change to 'rejected'

55. **Delete Campaign**
    - Delete a draft or cancelled campaign
    - Expected: 200 OK with deletion confirmation

## Role-Based Testing Scenarios

### Testing as System Admin

1. Login as system admin (step 29)
2. Try creating organization users (should work)
3. Try creating another system admin (should fail)
4. Try approving templates (should work)

### Testing as Organization Admin

1. Create and login as organization admin
2. Try creating organization users in their org (should work)
3. Try creating users in different org (should fail)
4. Try submitting templates for approval (should work)
5. Try approving templates (should fail)

### Testing as Organization User

1. Create and login as organization user
2. Try creating any users (should fail)
3. Try viewing templates in their org (should work)
4. Try creating templates (should fail)

## Environment Variables Used

- `baseUrl`: Server URL (http://localhost:3000)
- `accessToken`: JWT access token (auto-set on login)
- `refreshToken`: Refresh token (auto-set on login)
- `userId`: Current user ID
- `organizationId`: Created organization ID
- `systemAdminUserId`: System admin user ID
- `orgAdminUserId`: Organization admin user ID
- `orgUserId`: Organization user ID
- `templateId`: Created template ID
- `pendingTemplateId`: Template pending approval ID
- `campaignId`: Created campaign ID
- `pendingCampaignId`: Campaign pending approval ID

## Expected Response Codes

- **200 OK**: Successful operation
- **201 Created**: Resource created successfully
- **400 Bad Request**: Validation error
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Duplicate resource
- **423 Locked**: Account locked

## Key Features Tested

✅ **Authentication & Authorization**

- JWT token-based authentication
- Role-based access control
- Account locking after failed attempts
- Token refresh mechanism

✅ **User Management**

- Multi-level user roles
- Organization-scoped access
- User CRUD operations
- Permission validation

✅ **Organization Management**

- Organization CRUD operations
- Encrypted WhatsApp credentials
- Webhook configuration
- User association

✅ **Template Management**

- Template creation with components
- Approval workflow
- Role-based template access
- WhatsApp Business API format

✅ **Campaign Management**

- Campaign creation with scheduling
- Approval workflow for campaigns
- Campaign lifecycle management (start, pause, cancel)
- Real-time statistics tracking
- Audience targeting and management

✅ **Audience Management**

- Master audience database per organization
- Phone number normalization (E.164)
- Flexible attribute storage (JSON)
- Campaign-specific audience associations
- Bulk operations for efficiency

✅ **Data Security**

- Encrypted sensitive data
- Sanitized responses
- Cross-organization access protection
- Audit logging

## Troubleshooting

### Common Issues

1. **Database not initialized**: Run `npm run db:init`
2. **Server not running**: Run `npm run dev`
3. **Environment not selected**: Choose correct environment in Postman
4. **Tokens expired**: Re-run login requests
5. **Permission denied**: Check user role and organization access

### Reset Database

```bash
npm run db:reset
```

This comprehensive collection tests all aspects of the WhatsApp Business Server API, ensuring proper functionality, security, and role-based access control.

## 🎯 Total API Coverage:

- **55+ API endpoints** in one collection
- **6 main sections**: Authentication, Users, Organizations, Templates, Campaigns, Audience
- **Complete workflow**: From user creation to campaign execution
- **All user roles**: Super Admin, System Admin, Organization Admin, Organization User
- **Full security testing**: Permissions, encryption, validation
- **Advanced features**: Phone number normalization, bulk operations, real-time statistics

## 🚀 New Campaign & Audience Features:

### **Campaign Management**

- **Campaign Types**: Immediate, scheduled, and recurring campaigns
- **Approval Workflow**: Draft → Pending Approval → Approved → Running → Completed
- **Lifecycle Control**: Start, pause, cancel operations
- **Statistics Tracking**: Real-time metrics for sent, delivered, read, replied, failed
- **Template Integration**: Only approved templates can be used

### **Audience Management**

- **Master Database**: Organization-wide audience with phone number normalization
- **Campaign Association**: Link audience to specific campaigns with custom attributes
- **Bulk Operations**: Efficient handling of large audience lists
- **Phone Validation**: Automatic E.164 format normalization using libphonenumber-js
- **Flexible Attributes**: JSON storage for custom audience data (account numbers, demographics, etc.)

### **Enhanced Security**

- **Role-Based Access**: Campaign creation restricted to admins, approval to super/system admins
- **Organization Isolation**: Users can only access campaigns within their organization
- **Data Validation**: Comprehensive validation for phone numbers, campaign data, and audience attributes
- **Audit Trail**: Complete logging of campaign lifecycle events

This enhanced collection now provides end-to-end testing for a complete WhatsApp Business campaign management system!
