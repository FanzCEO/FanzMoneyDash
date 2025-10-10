import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

const authMiddleware = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      logger.warn('Auth attempt without token', {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // Validate JWT_SECRET exists - refuse to proceed with fallback
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      logger.error('JWT_SECRET missing or too short in auth middleware', {
        hasSecret: !!process.env.JWT_SECRET,
        secretLength: process.env.JWT_SECRET?.length || 0,
        path: req.path,
        ip: req.ip
      });
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Verify token with proper issuer/audience validation
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'fanz-money-dash',
      audience: 'fanz-network',
      algorithms: ['HS256'] // Explicitly specify allowed algorithms
    });
    
    // Validate required token fields
    if (!decoded.userId || !decoded.email || !decoded.role) {
      logger.warn('Token missing required fields', {
        hasUserId: !!decoded.userId,
        hasEmail: !!decoded.email,
        hasRole: !!decoded.role,
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid token format'
      });
    }
    
    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat, // Include issued at time for logging
      exp: decoded.exp  // Include expiration for logging
    };

    // Log successful authentication for security monitoring
    logger.debug('Successful authentication', {
      userId: decoded.userId,
      email: decoded.email?.substring(0, 3) + '***', // Partially mask email
      role: decoded.role,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    next();
  } catch (error) {
    // Use structured logging instead of console.error
    if (error.name === 'TokenExpiredError') {
      logger.warn('Expired token auth attempt', {
        error: error.message,
        expiredAt: error.expiredAt,
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid token auth attempt', {
        error: error.message,
        ip: req.ip,
        path: req.path,
        userAgent: req.get('user-agent')
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    if (error.name === 'NotBeforeError') {
      logger.warn('Token used before valid time', {
        error: error.message,
        date: error.date,
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: 'Token not yet valid'
      });
    }

    // Log unexpected auth errors
    logger.error('Unexpected auth middleware error', {
      error: error.message,
      name: error.name,
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent')
    });
    
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
      // Don't expose internal error details
    });
  }
};

// Optional: Create role-based middleware variants
const requireAdmin = (req, res, next) => {
  authMiddleware(req, res, (err) => {
    if (err) return next(err);
    
    if (req.user.role !== 'admin') {
      logger.warn('Non-admin access attempt to admin endpoint', {
        userId: req.user.userId,
        role: req.user.role,
        path: req.path,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: 'Administrative privileges required'
      });
    }
    
    next();
  });
};

const requireCreator = (req, res, next) => {
  authMiddleware(req, res, (err) => {
    if (err) return next(err);
    
    if (req.user.role !== 'creator' && req.user.role !== 'admin') {
      logger.warn('Non-creator access attempt to creator endpoint', {
        userId: req.user.userId,
        role: req.user.role,
        path: req.path,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: 'Creator privileges required'
      });
    }
    
    next();
  });
};

export default authMiddleware;
export { requireAdmin, requireCreator };
