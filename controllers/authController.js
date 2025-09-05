const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const JWTUtil = require('../utils/jwt');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Login user
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Check if account is active
  if (!user.is_active) {
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated'
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

  // Validate password
  const isValidPassword = await User.validatePassword(password, user.password_hash);
  if (!isValidPassword) {
    // Increment failed login attempts
    await User.incrementFailedLoginAttempts(user.id);
    
    logger.warn('Failed login attempt', {
      email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Reset failed login attempts on successful login
  await User.resetFailedLoginAttempts(user.id);

  // Generate tokens
  const tokenPair = JWTUtil.generateTokenPair(user);
  const refreshToken = await RefreshToken.create(user.id);

  logger.info('User logged in successfully', {
    userId: user.id,
    email: user.email,
    role: user.role,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: User.sanitizeUser(user),
      ...tokenPair,
      refreshToken: refreshToken.token
    }
  });
});

// Refresh access token
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    throw new AppError('Refresh token is required', 400);
  }

  // Find and validate refresh token
  const tokenData = await RefreshToken.findByToken(token);
  if (!tokenData) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  // Get user data
  const user = await User.findById(tokenData.user_id);
  if (!user || !user.is_active) {
    throw new AppError('User not found or inactive', 401);
  }

  // Generate new access token
  const tokenPair = JWTUtil.generateTokenPair(user);

  // Optionally rotate refresh token (create new one and revoke old one)
  await RefreshToken.revokeToken(token);
  const newRefreshToken = await RefreshToken.create(user.id);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      ...tokenPair,
      refreshToken: newRefreshToken.token
    }
  });
});

// Logout user
const logout = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;

  if (token) {
    // Revoke the refresh token
    await RefreshToken.revokeToken(token);
  }

  logger.info('User logged out', {
    userId: req.user?.id,
    email: req.user?.email,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Logout from all devices
const logoutAll = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Revoke all refresh tokens for the user
  await RefreshToken.revokeAllUserTokens(userId);

  logger.info('User logged out from all devices', {
    userId,
    email: req.user.email,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Logged out from all devices successfully'
  });
});

// Get current user profile
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    data: {
      user: User.sanitizeUser(user)
    }
  });
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Get user with password hash
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Validate current password
  const isValidPassword = await User.validatePassword(currentPassword, user.password_hash);
  if (!isValidPassword) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Update password
  await User.updatePassword(userId, newPassword);

  // Revoke all refresh tokens to force re-login on all devices
  await RefreshToken.revokeAllUserTokens(userId);

  logger.info('Password changed successfully', {
    userId,
    email: user.email,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Password changed successfully. Please login again.'
  });
});

// Validate token endpoint
const validateToken = asyncHandler(async (req, res) => {
  // If we reach here, the token is valid (middleware already validated it)
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user
    }
  });
});

module.exports = {
  login,
  refreshToken,
  logout,
  logoutAll,
  getProfile,
  changePassword,
  validateToken
};
