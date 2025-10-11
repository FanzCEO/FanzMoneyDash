/**
 * FANZ MoneyDash Security Configuration
 * Enhanced security settings for production deployment
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Rate limiting configuration
export const rateLimitConfig = {
  // General API rate limit
  api: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    }
  }),

  // Stricter rate limit for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login attempts per windowMs
    message: {
      error: 'Too many login attempts from this IP, please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  }),

  // Payment endpoints - more restrictive
  payment: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 payment requests per minute
    message: {
      error: 'Payment rate limit exceeded, please wait before trying again.',
      code: 'PAYMENT_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  })
};

// Helmet security headers configuration
export const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for some CSS frameworks
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      scriptSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://checkout.stripe.com",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "https://*.stripe.com",
        "https://fanz-money-dash.b-cdn.net"
      ],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://api.openai.com",
        "wss://socket.io"
      ],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://hooks.stripe.com"
      ]
    }
  },

  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // X-Frame-Options
  frameguard: {
    action: 'deny'
  },

  // X-Content-Type-Options
  noSniff: true,

  // X-XSS-Protection (legacy but still useful)
  xssFilter: true,

  // Referrer Policy
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin"
  },

  // Permissions Policy (formerly Feature Policy)
  permittedCrossDomainPolicies: false,

  // Hide X-Powered-By header
  hidePoweredBy: true
});

// CORS configuration for production
export const corsConfig = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://money.fanz.network',
      'https://dash.fanz.network',
      'https://boyfanz.com',
      'https://girlfanz.com',
      'https://pupfanz.com',
      'https://daddiesfanz.com',
      'https://cougarfanz.com',
      'https://taboofanz.com'
    ];

    // In development, allow localhost
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key'
  ]
};

// Session security configuration
export const sessionConfig = {
  name: 'fanz.sid', // Change default session name
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict' // CSRF protection
  }
};

// Input validation and sanitization helpers
export const sanitizeInput = {
  // Remove potential XSS characters
  xss: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/[<>]/g, '') // Remove < and > characters
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, ''); // Remove event handlers like onclick=
  },

  // Sanitize SQL injection attempts
  sql: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/['"\\;]/g, '') // Remove quotes and semicolons
      .replace(/(union|select|insert|delete|update|drop|create|alter)/gi, '');
  },

  // General sanitization
  general: (input) => {
    if (typeof input !== 'string') return input;
    return input.trim().slice(0, 1000); // Limit length and trim
  }
};

// Security middleware factory
export const securityMiddleware = {
  // Validate API key for certain endpoints
  apiKey: (req, res, next) => {
    const apiKey = req.header('X-API-Key');
    const validApiKeys = process.env.API_KEYS?.split(',') || [];
    
    if (!apiKey || !validApiKeys.includes(apiKey)) {
      return res.status(401).json({
        error: 'Invalid or missing API key',
        code: 'INVALID_API_KEY'
      });
    }
    
    next();
  },

  // Log suspicious activity
  logSuspicious: (req, res, next) => {
    const suspiciousPatterns = [
      /\.\./g, // Directory traversal
      /<script/gi, // XSS attempts
      /union.*select/gi, // SQL injection
      /javascript:/gi, // JavaScript injection
    ];

    const userAgent = req.get('User-Agent') || '';
    const referer = req.get('Referer') || '';
    const requestBody = JSON.stringify(req.body);

    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(req.url) || 
      pattern.test(userAgent) || 
      pattern.test(referer) ||
      pattern.test(requestBody)
    );

    if (isSuspicious) {
      console.warn('🚨 Suspicious activity detected:', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        userAgent,
        referer,
        timestamp: new Date().toISOString()
      });
    }

    next();
  }
};

export default {
  rateLimitConfig,
  helmetConfig,
  corsConfig,
  sessionConfig,
  sanitizeInput,
  securityMiddleware
};