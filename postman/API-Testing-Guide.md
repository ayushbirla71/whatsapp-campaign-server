# WhatsApp Server API Testing Guide

This guide will help you test all the APIs using the provided Postman collection.

## Setup Instructions

### 1. Import Postman Collection and Environment

1. **Import Collection**:
   - Open Postman
   - Click "Import" button
   - Select `WhatsApp-Server-API.postman_collection.json`

2. **Import Environment**:
   - Click "Import" button again
   - Select `WhatsApp-Server-Environment.postman_environment.json`
   - Select the "WhatsApp Server Environment" from the environment dropdown

### 2. Start Your Server

```bash
# Make sure your database is initialized
npm run db:init

# Start the development server
npm run dev
```

## Testing Workflow

### Phase 1: Basic Setup and Authentication

1. **Health Check**
   - Run "Health Check" to verify server is running
   - Expected: 200 OK with server status

2. **API Documentation**
   - Run "API Documentation" to see available endpoints
   - Expected: 200 OK with API documentation

3. **Login as Super Admin**
   - Run "Login Super Admin" 
   - This will automatically set `accessToken`, `refreshToken`, and `userId` in environment
   - Expected: 200 OK with user data and tokens

4. **Get Profile**
   - Run "Get Profile" to verify authentication works
   - Expected: 200 OK with super admin profile

5. **Validate Token**
   - Run "Validate Token" to test token validation
   - Expected: 200 OK with token validation confirmation

### Phase 2: Organization Management

6. **Create Organization**
   - Run "Create Organization"
   - This will automatically set `organizationId` in environment
   - Expected: 201 Created with organization data
   - Note: WhatsApp credentials will be encrypted in database

7. **Get All Organizations**
   - Run "Get All Organizations"
   - Expected: 200 OK with list of organizations (WhatsApp fields show as [ENCRYPTED])

8. **Get Organization by ID**
   - Run "Get Organization by ID"
   - Expected: 200 OK with specific organization details

9. **Update Organization**
   - Run "Update Organization"
   - Expected: 200 OK with updated organization data

10. **Update WhatsApp Config**
    - Run "Update WhatsApp Config"
    - Expected: 200 OK confirming WhatsApp configuration update

11. **Get WhatsApp Config**
    - Run "Get WhatsApp Config"
    - Expected: 200 OK with decrypted WhatsApp configuration (only for authorized users)

### Phase 3: User Management

12. **Create System Admin**
    - Run "Create System Admin"
    - This will set `systemAdminUserId` in environment
    - Expected: 201 Created with system admin user data

13. **Create Organization Admin**
    - Run "Create Organization Admin"
    - This will set `orgAdminUserId` in environment
    - Expected: 201 Created with organization admin user data

14. **Create Organization User**
    - Run "Create Organization User"
    - This will set `orgUserId` in environment
    - Expected: 201 Created with organization user data

15. **Get All Users**
    - Run "Get All Users"
    - Expected: 200 OK with list of users (role-based filtering applied)

16. **Get User by ID**
    - Run "Get User by ID"
    - Expected: 200 OK with specific user details

17. **Update User**
    - Run "Update User"
    - Expected: 200 OK with updated user data

18. **Get Organization Users**
    - Run "Get Organization Users"
    - Expected: 200 OK with users belonging to the organization

### Phase 4: Authentication Features

19. **Login System Admin**
    - Run "Login System Admin" (use the created system admin credentials)
    - This will set `systemAdminToken` and `systemAdminRefreshToken`
    - Expected: 200 OK with system admin tokens

20. **Refresh Token**
    - Run "Refresh Token"
    - This will update tokens in environment
    - Expected: 200 OK with new tokens

21. **Change Password**
    - Run "Change Password" (optional - will require re-login)
    - Expected: 200 OK with password change confirmation

### Phase 5: Cleanup (Optional)

22. **Delete User**
    - Run "Delete User"
    - Expected: 200 OK with deletion confirmation

23. **Delete Organization**
    - Run "Delete Organization" (only works if no users are associated)
    - Expected: 200 OK with deletion confirmation

24. **Logout**
    - Run "Logout"
    - Expected: 200 OK with logout confirmation

25. **Logout All Devices**
    - Run "Logout All Devices"
    - Expected: 200 OK with logout confirmation

## Testing Different User Roles

### Testing as System Admin

1. Login as System Admin using the credentials created in step 12
2. Try creating organization users (should work)
3. Try creating another system admin (should fail)
4. Try accessing organizations (should work)

### Testing as Organization Admin

1. Create an organization admin using step 13
2. Login with organization admin credentials
3. Try creating organization users in their organization (should work)
4. Try creating users in different organization (should fail)
5. Try accessing other organizations (should fail)

### Testing as Organization User

1. Create an organization user using step 14
2. Login with organization user credentials
3. Try creating any users (should fail)
4. Try accessing their organization data (should work)
5. Try accessing other organizations (should fail)

## Expected Error Scenarios

### Authentication Errors
- **401 Unauthorized**: Invalid or missing token
- **423 Locked**: Account locked due to failed login attempts

### Authorization Errors
- **403 Forbidden**: Insufficient permissions for the action

### Validation Errors
- **400 Bad Request**: Invalid input data
- **409 Conflict**: Duplicate email or organization name

### Not Found Errors
- **404 Not Found**: User or organization doesn't exist

## Environment Variables

The collection uses these environment variables:

- `baseUrl`: Server URL (default: http://localhost:3000)
- `accessToken`: JWT access token (auto-set on login)
- `refreshToken`: Refresh token (auto-set on login)
- `userId`: Current user ID (auto-set on login)
- `organizationId`: Created organization ID (auto-set on organization creation)
- `systemAdminUserId`: Created system admin ID
- `orgAdminUserId`: Created organization admin ID
- `orgUserId`: Created organization user ID

## Tips for Testing

1. **Run requests in order**: The collection is designed to run sequentially
2. **Check environment variables**: Many requests depend on variables set by previous requests
3. **Monitor responses**: Check that tokens are being set correctly
4. **Test permissions**: Try accessing resources with different user roles
5. **Verify encryption**: WhatsApp credentials should show as [ENCRYPTED] in public responses
6. **Test error cases**: Try invalid inputs to test validation

## Troubleshooting

### Common Issues

1. **Database not initialized**: Run `npm run db:init`
2. **Server not running**: Run `npm run dev`
3. **Environment not selected**: Select "WhatsApp Server Environment" in Postman
4. **Tokens expired**: Re-run login requests to get fresh tokens
5. **Permission denied**: Check user role and organization access

### Database Reset

If you need to reset the database:

```bash
npm run db:reset
```

This will drop and recreate all tables with the default super admin.
