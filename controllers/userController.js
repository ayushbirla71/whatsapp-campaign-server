const User = require('../models/User');
const Organization = require('../models/Organization');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Get all users with pagination and filtering
const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, role, organizationId, isActive } = req.query;
  const offset = (page - 1) * limit;

  // Build filter conditions based on user role and query parameters
  let conditions = {};
  
  // Role-based filtering
  if (req.user.role === 'organization_admin') {
    // Organization admin can only see users in their organization
    conditions.organization_id = req.user.organization_id;
  } else if (req.user.role === 'system_admin') {
    // System admin cannot see super admins
    // This will be handled in the query
  }

  // Apply additional filters
  if (role) conditions.role = role;
  if (organizationId && ['super_admin', 'system_admin'].includes(req.user.role)) {
    conditions.organization_id = organizationId;
  }
  if (isActive !== undefined) conditions.is_active = isActive === 'true';

  let users;
  let total;

  if (req.user.role === 'system_admin') {
    // System admin: exclude super admins
    const query = `
      SELECT * FROM users 
      WHERE role != 'super_admin'
      ${Object.keys(conditions).length > 0 ? 'AND ' + Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ') : ''}
      ORDER BY created_at DESC
      LIMIT $${Object.keys(conditions).length + 1} OFFSET $${Object.keys(conditions).length + 2}
    `;
    const values = [...Object.values(conditions), limit, offset];
    const result = await User.pool.query(query, values);
    users = result.rows;

    const countQuery = `
      SELECT COUNT(*) FROM users 
      WHERE role != 'super_admin'
      ${Object.keys(conditions).length > 0 ? 'AND ' + Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ') : ''}
    `;
    const countResult = await User.pool.query(countQuery, Object.values(conditions));
    total = parseInt(countResult.rows[0].count);
  } else {
    users = await User.findAll(conditions, limit, offset);
    total = await User.count(conditions);
  }

  // Sanitize user data
  const sanitizedUsers = users.map(user => User.sanitizeUser(user));

  res.json({
    success: true,
    data: {
      users: sanitizedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get user by ID
const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check permissions
  if (req.user.role === 'organization_admin' && user.organization_id !== req.user.organization_id) {
    throw new AppError('Access denied', 403);
  }

  if (req.user.role === 'system_admin' && user.role === 'super_admin') {
    throw new AppError('Access denied', 403);
  }

  res.json({
    success: true,
    data: {
      user: User.sanitizeUser(user)
    }
  });
});

// Create new user
const createUser = asyncHandler(async (req, res) => {
  const { email, password, first_name, last_name, role, organization_id } = req.body;

  // Validate role permissions
  if (req.user.role === 'system_admin' && ['super_admin', 'system_admin'].includes(role)) {
    throw new AppError('Cannot create system-level administrators', 403);
  }

  if (req.user.role === 'organization_admin' && role !== 'organization_user') {
    throw new AppError('Can only create organization users', 403);
  }

  // Validate organization assignment
  if (['organization_admin', 'organization_user'].includes(role)) {
    if (!organization_id) {
      throw new AppError('Organization ID is required for organization roles', 400);
    }

    // Check if organization exists
    const organization = await Organization.findById(organization_id);
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Organization admin can only create users in their own organization
    if (req.user.role === 'organization_admin' && organization_id !== req.user.organization_id) {
      throw new AppError('Can only create users in your own organization', 403);
    }
  }

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new AppError('User with this email already exists', 409);
  }

  // Create user
  const userData = {
    email,
    password,
    first_name,
    last_name,
    role,
    organization_id: ['organization_admin', 'organization_user'].includes(role) ? organization_id : null,
    created_by: req.user.id
  };

  const newUser = await User.create(userData);

  logger.info('User created successfully', {
    createdUserId: newUser.id,
    createdUserEmail: newUser.email,
    createdUserRole: newUser.role,
    createdBy: req.user.id,
    createdByEmail: req.user.email
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: {
      user: User.sanitizeUser(newUser)
    }
  });
});

// Update user
const updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const updateData = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check permissions
  if (req.user.role === 'organization_admin' && user.organization_id !== req.user.organization_id) {
    throw new AppError('Access denied', 403);
  }

  if (req.user.role === 'system_admin' && user.role === 'super_admin') {
    throw new AppError('Cannot modify super admin', 403);
  }

  // Validate role change permissions
  if (updateData.role) {
    if (req.user.role === 'system_admin' && ['super_admin', 'system_admin'].includes(updateData.role)) {
      throw new AppError('Cannot assign system-level roles', 403);
    }

    if (req.user.role === 'organization_admin' && updateData.role !== 'organization_user') {
      throw new AppError('Can only assign organization user role', 403);
    }
  }

  // Remove sensitive fields that shouldn't be updated directly
  delete updateData.password;
  delete updateData.password_hash;
  delete updateData.created_by;
  delete updateData.created_at;

  const updatedUser = await User.update(userId, updateData);

  logger.info('User updated successfully', {
    updatedUserId: userId,
    updatedBy: req.user.id,
    updatedByEmail: req.user.email,
    changes: updateData
  });

  res.json({
    success: true,
    message: 'User updated successfully',
    data: {
      user: User.sanitizeUser(updatedUser)
    }
  });
});

// Delete user
const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check permissions
  if (req.user.role === 'organization_admin' && user.organization_id !== req.user.organization_id) {
    throw new AppError('Access denied', 403);
  }

  if (req.user.role === 'system_admin' && user.role === 'super_admin') {
    throw new AppError('Cannot delete super admin', 403);
  }

  // Prevent self-deletion
  if (userId === req.user.id) {
    throw new AppError('Cannot delete your own account', 400);
  }

  await User.delete(userId);

  logger.info('User deleted successfully', {
    deletedUserId: userId,
    deletedUserEmail: user.email,
    deletedBy: req.user.id,
    deletedByEmail: req.user.email
  });

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
});

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
