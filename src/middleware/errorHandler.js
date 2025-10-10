import logger from '../config/logger.js';

const errorHandler = (err, req, res, next) => {
  // Use structured logging instead of console.error
  const errorId = 'err_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  
  // Log full error details internally (never expose to client)
  logger.error('Unhandled error', {
    errorId,
    name: err.name,
    message: err.message,
    stack: err.stack,
    code: err.code,
    status: err.status || err.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.userId,
    timestamp: new Date().toISOString()
  });

  // Default secure error response
  let error = {
    message: 'Internal Server Error',
    status: 500,
    code: 'INTERNAL_ERROR'
  };

  // Handle specific error types with sanitized messages
  if (err.name === 'ValidationError') {
    // Sanitize validation error messages
    const messages = Object.values(err.errors || {})
      .map(val => val?.message || 'Invalid field')
      .filter(msg => typeof msg === 'string' && msg.length < 100) // Limit message length
      .join(', ');
    
    error = {
      message: messages || 'Validation failed',
      status: 400,
      code: 'VALIDATION_ERROR'
    };
  }

  // Mongoose duplicate key error
  else if (err.code === 11000) {
    // Don't expose actual field names or values
    error = {
      message: 'Duplicate entry detected',
      status: 400,
      code: 'DUPLICATE_ERROR'
    };
  }

  // JWT errors
  else if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid authentication token',
      status: 401,
      code: 'INVALID_TOKEN'
    };
  }

  else if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Authentication token expired',
      status: 401,
      code: 'TOKEN_EXPIRED'
    };
  }

  // MongoDB cast errors
  else if (err.name === 'CastError') {
    error = {
      message: 'Invalid identifier format',
      status: 400,
      code: 'INVALID_ID'
    };
  }

  // Rate limiting errors
  else if (err.name === 'TooManyRequestsError' || err.status === 429) {
    error = {
      message: 'Too many requests. Please try again later.',
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED'
    };
  }

  // CORS errors
  else if (err.message && err.message.includes('CORS')) {
    error = {
      message: 'Cross-origin request not allowed',
      status: 403,
      code: 'CORS_ERROR'
    };
  }

  // File upload errors
  else if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      message: 'File too large',
      status: 413,
      code: 'FILE_TOO_LARGE'
    };
  }

  // Network/timeout errors
  else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    error = {
      message: 'Service temporarily unavailable',
      status: 503,
      code: 'SERVICE_UNAVAILABLE'
    };
  }

  // Explicitly set status/code errors (from application logic)
  else if (err.status || err.statusCode) {
    const status = err.status || err.statusCode;
    
    // Only expose safe error messages for client errors (4xx)
    if (status >= 400 && status < 500 && err.message && typeof err.message === 'string') {
      // Sanitize message - limit length and remove sensitive patterns
      let safeMessage = err.message
        .substring(0, 200) // Limit length
        .replace(/\b(?:password|token|secret|key|hash)\b/gi, '[REDACTED]') // Remove sensitive terms
        .replace(/[<>"']/g, ''); // Remove HTML/script characters
      
      if (safeMessage.length > 0) {
        error = {
          message: safeMessage,
          status,
          code: err.code || 'CLIENT_ERROR'
        };
      }
    }
  }

  // Log security-relevant errors at higher level
  if (error.status === 401 || error.status === 403 || error.status === 429) {
    logger.warn('Security-relevant error', {
      errorId,
      status: error.status,
      code: error.code,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.userId
    });
  }

  // Prepare final response
  const response = {
    success: false,
    error: error.message,
    code: error.code,
    errorId, // Include error ID for support purposes
    timestamp: new Date().toISOString()
  };

  // Only include stack traces in development AND for specific error types
  if (process.env.NODE_ENV === 'development' && 
      (error.status >= 400 && error.status < 500) && 
      process.env.SHOW_ERROR_STACK === 'true') {
    response.stack = err.stack;
  }

  // Send response
  res.status(error.status).json(response);
};

// Create a safe error for throwing in application code
const createSafeError = (message, status = 500, code = 'APPLICATION_ERROR') => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

// Handle 404 errors
const notFoundHandler = (req, res) => {
  logger.warn('404 Not Found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.userId
  });
  
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

export default errorHandler;
export { createSafeError, notFoundHandler };
