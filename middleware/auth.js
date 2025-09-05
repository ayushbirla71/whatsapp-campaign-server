const JWTUtil = require('../utils/jwt');
const User = require('../models/User');

// Authentication middleware - verifies JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTUtil.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify the token
    const decoded = JWTUtil.verifyAccessToken(token);
    
    // Get user from database to ensure they still exist and are active
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    // Check if account is locked
    const isLocked = await User.isAccountLocked(user.id);
    if (isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to failed login attempts'
      });
    }

    // Add user info to request object
    req.user = User.sanitizeUser(user);
    req.token = token;
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message
    });
  }
};

// Authorization middleware factory - checks user roles
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Organization-specific authorization
const authorizeOrganization = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const { organizationId } = req.params;
  
  // Super admins and system admins can access any organization
  if (['super_admin', 'system_admin'].includes(req.user.role)) {
    return next();
  }

  // Organization users can only access their own organization
  if (['organization_admin', 'organization_user'].includes(req.user.role)) {
    if (!req.user.organization_id) {
      return res.status(403).json({
        success: false,
        message: 'User not associated with any organization'
      });
    }

    if (req.user.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this organization'
      });
    }
  }

  next();
};

// Check if user can manage other users
const authorizeUserManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const targetUserId = req.params.userId || req.body.userId;
  const targetUserRole = req.body.role;

  // Super admin can manage anyone
  if (req.user.role === 'super_admin') {
    return next();
  }

  // System admin can manage organization admins and users, but not other system admins or super admins
  if (req.user.role === 'system_admin') {
    if (targetUserRole && ['super_admin', 'system_admin'].includes(targetUserRole)) {
      return res.status(403).json({
        success: false,
        message: 'Cannot manage system-level administrators'
      });
    }
    return next();
  }

  // Organization admin can only manage users in their organization
  if (req.user.role === 'organization_admin') {
    if (targetUserRole && !['organization_user'].includes(targetUserRole)) {
      return res.status(403).json({
        success: false,
        message: 'Can only manage organization users'
      });
    }
    return next();
  }

  // Organization users cannot manage other users
  return res.status(403).json({
    success: false,
    message: 'Insufficient permissions for user management'
  });
};

// Optional authentication - doesn't fail if no token provided
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTUtil.extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = JWTUtil.verifyAccessToken(token);
      const user = await User.findById(decoded.userId);
      
      if (user && user.is_active) {
        req.user = User.sanitizeUser(user);
        req.token = token;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  authorizeOrganization,
  authorizeUserManagement,
  optionalAuth
};
