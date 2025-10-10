import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import logger from '../config/logger.js';
import { sanitizeInput } from '../config/security.js';

// Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  onLimitReached: (req) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      path: req.path
    });
  }
});

// More lenient rate limiting for registration
const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  message: {
    success: false,
    error: 'Registration limit exceeded. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Track failed login attempts per email
const failedAttempts = new Map();

// Clean up old entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of failedAttempts.entries()) {
    if (now - data.lastAttempt > 30 * 60 * 1000) {
      failedAttempts.delete(email);
    }
  }
}, 30 * 60 * 1000);

const router = express.Router();

// Mock user database (replace with actual database integration)
const users = new Map();

// Register new user
router.post('/register', [
  registerRateLimit,
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Valid email required (max 255 characters)'),
  body('password')
    .isLength({ min: 12, max: 128 })
    .withMessage('Password must be 12-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'i')
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
    .trim(),
  body('role')
    .optional()
    .isIn(['creator', 'user'])
    .withMessage('Invalid role - only creator or user allowed')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Sanitize inputs
    const email = sanitizeInput.general(req.body.email);
    const password = req.body.password; // Don't sanitize password - keep original
    const username = sanitizeInput.general(req.body.username);
    const role = req.body.role || 'user';

    // Check if user exists
    if (users.has(email)) {
      logger.warn('Registration attempt for existing user', {
        email: email.substring(0, 3) + '***', // Partially mask email
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = {
      id: Date.now().toString(),
      email,
      username,
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString(),
      isActive: true
    };

    users.set(email, user);

    // Validate JWT_SECRET exists
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      logger.error('JWT_SECRET is missing or too short during login');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'fanz-money-dash',
        audience: 'fanz-network'
      }
    );

    // Update last login timestamp
    user.lastLogin = new Date().toISOString();

    // Log successful login
    logger.info('Successful login', {
      userId: user.id,
      email: email.substring(0, 3) + '***',
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    logger.error('Registration error', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(500).json({
      success: false,
      error: 'Registration failed'
      // Don't expose internal error details
    });
  }
});

// Login user
router.post('/login', [
  authRateLimit,
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Valid email required (max 255 characters)'),
  body('password')
    .isLength({ min: 1, max: 128 })
    .withMessage('Password required (max 128 characters)')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Sanitize inputs
    const email = sanitizeInput.general(req.body.email);
    const password = req.body.password; // Don't sanitize password

    // Check for account lockout
    const attempts = failedAttempts.get(email);
    if (attempts && attempts.count >= 5) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
      if (timeSinceLastAttempt < 30 * 60 * 1000) { // 30 minutes
        logger.warn('Login attempt on locked account', {
          email: email.substring(0, 3) + '***',
          ip: req.ip,
          attemptsCount: attempts.count
        });
        return res.status(429).json({
          success: false,
          error: 'Account temporarily locked. Please try again later.',
          retryAfter: Math.ceil((30 * 60 * 1000 - timeSinceLastAttempt) / 60000) + ' minutes'
        });
      } else {
        // Reset attempts if lockout period has passed
        failedAttempts.delete(email);
      }
    }

    // Find user
    const user = users.get(email);
    if (!user || !user.isActive) {
      // Track failed attempt
      const currentAttempts = failedAttempts.get(email) || { count: 0, lastAttempt: 0 };
      currentAttempts.count += 1;
      currentAttempts.lastAttempt = Date.now();
      failedAttempts.set(email, currentAttempts);
      
      logger.warn('Login attempt for nonexistent/inactive user', {
        email: email.substring(0, 3) + '***',
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      
      // Use consistent timing to prevent user enumeration
      await new Promise(resolve => setTimeout(resolve, 200));
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // Track failed attempt
      const currentAttempts = failedAttempts.get(email) || { count: 0, lastAttempt: 0 };
      currentAttempts.count += 1;
      currentAttempts.lastAttempt = Date.now();
      failedAttempts.set(email, currentAttempts);
      
      logger.warn('Failed login attempt', {
        email: email.substring(0, 3) + '***',
        ip: req.ip,
        userAgent: req.get('user-agent'),
        failedAttempts: currentAttempts.count
      });
      
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Clear failed attempts on successful login
    failedAttempts.delete(email);

    // Validate JWT_SECRET exists
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      logger.error('JWT_SECRET is missing or too short', {
        hasSecret: !!process.env.JWT_SECRET,
        secretLength: process.env.JWT_SECRET?.length || 0
      });
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'fanz-money-dash',
        audience: 'fanz-network'
      }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    logger.error('Login error', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(500).json({
      success: false,
      error: 'Login failed'
      // Don't expose internal error details
    });
  }
});

// Refresh token
router.post('/refresh', [
  authRateLimit,
  body('token')
    .isString()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Valid token required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { token } = req.body;

    // Validate JWT_SECRET exists
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      logger.error('JWT_SECRET is missing or too short during refresh');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Verify existing token with proper issuer/audience validation
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'fanz-money-dash',
      audience: 'fanz-network'
    });
    
    const user = users.get(decoded.email);

    if (!user || !user.isActive) {
      logger.warn('Token refresh attempt for nonexistent/inactive user', {
        userId: decoded.userId,
        email: decoded.email?.substring(0, 3) + '***',
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if token is too old to refresh (e.g., older than 7 days)
    const tokenAge = Date.now() / 1000 - decoded.iat;
    const maxRefreshAge = 7 * 24 * 60 * 60; // 7 days
    if (tokenAge > maxRefreshAge) {
      logger.warn('Attempt to refresh expired token', {
        userId: user.id,
        tokenAge: Math.round(tokenAge / 3600) + ' hours',
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'Token too old to refresh. Please log in again.'
      });
    }

    // Generate new token
    const newToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'fanz-money-dash',
        audience: 'fanz-network'
      }
    );

    logger.info('Token refreshed', {
      userId: user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        token: newToken
      }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Expired token refresh attempt', {
        ip: req.ip,
        error: error.message
      });
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please log in again.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid token refresh attempt', {
        ip: req.ip,
        error: error.message
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    logger.error('Token refresh error', {
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
      // Don't expose internal error details
    });
  }
});

// Logout (client-side token deletion, server-side cleanup if needed)
router.post('/logout', (req, res) => {
  try {
    // Log logout activity if user info is available
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '', {
          issuer: 'fanz-money-dash',
          audience: 'fanz-network'
        });
        logger.info('User logged out', {
          userId: decoded.userId,
          ip: req.ip
        });
      } catch (error) {
        // Token invalid or expired - still log the logout attempt
        logger.info('Logout attempt with invalid token', {
          ip: req.ip
        });
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error', {
      error: error.message,
      ip: req.ip
    });
    // Still return success for logout
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

export default router;