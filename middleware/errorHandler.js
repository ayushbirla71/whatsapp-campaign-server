const logger = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle different types of errors
const handleDatabaseError = (error) => {
  if (error.code === '23505') { // Unique violation
    const field = error.detail.match(/Key \((.+)\)=/)?.[1] || 'field';
    return new AppError(`${field} already exists`, 409);
  }
  
  if (error.code === '23503') { // Foreign key violation
    return new AppError('Referenced resource does not exist', 400);
  }
  
  if (error.code === '23502') { // Not null violation
    const field = error.column || 'field';
    return new AppError(`${field} is required`, 400);
  }

  if (error.code === '22P02') { // Invalid input syntax
    return new AppError('Invalid input format', 400);
  }

  return new AppError('Database operation failed', 500);
};

const handleJWTError = (error) => {
  if (error.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401);
  }
  
  if (error.name === 'TokenExpiredError') {
    return new AppError('Token has expired', 401);
  }

  return new AppError('Authentication failed', 401);
};

const handleValidationError = (error) => {
  const errors = Object.values(error.errors).map(err => err.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Send error response in development
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

// Send error response in production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('ERROR:', err);
    
    res.status(500).json({
      success: false,
      message: 'Something went wrong!'
    });
  }
};

// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (err.code && err.code.startsWith('23')) {
      error = handleDatabaseError(err);
    } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      error = handleJWTError(err);
    } else if (err.name === 'ValidationError') {
      error = handleValidationError(err);
    }

    sendErrorProd(error, res);
  }
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
const notFound = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

module.exports = {
  AppError,
  globalErrorHandler,
  asyncHandler,
  notFound
};
