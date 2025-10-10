/**
 * FANZ Money Dash - Advanced Security Configuration
 * Enterprise-grade security measures and hardening
 */

import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Advanced security configuration
export const advancedSecurityConfig = {
  
  // Content Security Policy (CSP) with strict policies
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'strict-dynamic'", 
        (req, res) => `'nonce-${res.locals.nonce}'`, // Dynamic nonce
        "https://js.stripe.com",
        "https://checkout.stripe.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for some CSS frameworks
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "blob:"
      ],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://api.openai.com",
        "wss:"
      ],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://hooks.stripe.com"
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      manifestSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production'
    },
    reportOnly: false,
    setAllHeaders: true,
    disableAndroid: false
  },

  // Strict Transport Security (HSTS) configuration
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // X-Frame-Options for clickjacking protection
  frameguard: {
    action: 'deny' // Prevent embedding in frames
  },

  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false
  },

  // X-Download-Options for IE8+
  ieNoOpen: true,

  // X-Content-Type-Options
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies: false,

  // Referrer Policy
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin"
  },

  // X-XSS-Protection (deprecated but still useful for older browsers)
  xssFilter: true,

  // Hide X-Powered-By header
  hidePoweredBy: true,

  // Expect-CT (Certificate Transparency)
  expectCt: {
    maxAge: 86400, // 24 hours
    enforce: true,
    reportUri: process.env.CT_REPORT_URI
  },

  // Cross-Origin-Embedder-Policy
  crossOriginEmbedderPolicy: {
    policy: "require-corp"
  },

  // Cross-Origin-Opener-Policy  
  crossOriginOpenerPolicy: {
    policy: "same-origin"
  },

  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy: {
    policy: "same-origin"
  }
};

// Advanced rate limiting with progressive delays
export const advancedRateLimiting = {
  
  // API rate limiting with memory store
  api: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(15 * 60) // seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks and webhooks with valid signatures
      const healthPaths = ['/health', '/api/health', '/ready', '/live'];
      return healthPaths.includes(req.path);
    },
    keyGenerator: (req) => {
      // Use forwarded IP if behind proxy, otherwise use connection IP
      return req.ip || req.connection.remoteAddress;
    },
    onLimitReached: (req, res, options) => {
      console.warn(`Rate limit exceeded for IP: ${req.ip}`, {
        ip: req.ip,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }
  }),

  // Strict authentication rate limiting
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Very strict for login attempts
    message: {
      error: 'Too many login attempts from this IP, account temporarily locked.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(15 * 60)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    onLimitReached: (req, res, options) => {
      console.error(`Authentication rate limit exceeded for IP: ${req.ip}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        severity: 'HIGH'
      });
    }
  }),

  // Payment processing rate limiting
  payment: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3, // Only 3 payment attempts per minute
    message: {
      error: 'Payment rate limit exceeded. Please wait before trying again.',
      code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    onLimitReached: (req, res, options) => {
      console.warn(`Payment rate limit exceeded for IP: ${req.ip}`, {
        ip: req.ip,
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
        severity: 'MEDIUM'
      });
    }
  }),

  // Progressive slow down for suspicious activity
  slowDown: slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 100, // Allow 100 requests per windowMs without delay
    delayMs: 500, // Add 500ms delay per request after delayAfter
    maxDelayMs: 20000, // Maximum delay of 20 seconds
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
    onLimitReached: (req, res, options) => {
      console.warn(`Slow down activated for IP: ${req.ip}`, {
        ip: req.ip,
        path: req.path,
        delay: options.delay,
        timestamp: new Date().toISOString()
      });
    }
  })
};

// Security headers middleware factory
export const securityHeaders = () => {
  return (req, res, next) => {
    // Generate unique nonce for CSP
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    
    // Security headers
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Origin-Agent-Cluster', '?1');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    
    // Add security timestamp
    res.setHeader('X-Security-Timestamp', Date.now());
    
    next();
  };
};

// Input sanitization and validation utilities
export const inputSecurity = {
  
  // Advanced XSS protection
  sanitizeXSS: (input) => {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove object tags
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '') // Remove embed tags
      .replace(/<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi, '') // Remove link tags
      .replace(/<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi, ''); // Remove meta tags
  },

  // SQL injection protection
  sanitizeSQL: (input) => {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/['";\\]/g, '') // Remove dangerous characters
      .replace(/(\b(union|select|insert|delete|update|drop|create|alter|exec|execute)\b)/gi, '') // Remove SQL keywords
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove SQL block comment start
      .replace(/\*\//g, ''); // Remove SQL block comment end
  },

  // Path traversal protection
  sanitizePath: (input) => {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/\.\./g, '') // Remove directory traversal
      .replace(/[<>"|*?]/g, '') // Remove invalid filename characters
      .replace(/^\./, '') // Remove leading dot
      .replace(/\/$/, ''); // Remove trailing slash
  },

  // Command injection protection
  sanitizeCommand: (input) => {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[;&|`$(){}[\]]/g, '') // Remove command injection characters
      .replace(/\s+(and|or|not|xor)\s+/gi, '') // Remove logical operators
      .replace(/\s*[<>]\s*/g, ''); // Remove redirection operators
  },

  // General input sanitization
  sanitizeGeneral: (input, options = {}) => {
    if (typeof input !== 'string') return input;
    
    const maxLength = options.maxLength || 1000;
    const allowHtml = options.allowHtml || false;
    
    let sanitized = input.trim();
    
    // Apply length limit
    if (sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength);
    }
    
    // Apply sanitization based on options
    if (!allowHtml) {
      sanitized = inputSecurity.sanitizeXSS(sanitized);
    }
    
    sanitized = inputSecurity.sanitizeSQL(sanitized);
    sanitized = inputSecurity.sanitizeCommand(sanitized);
    
    return sanitized;
  }
};

// Security monitoring utilities
export const securityMonitoring = {
  
  // Detect suspicious patterns in requests
  detectSuspiciousActivity: (req) => {
    const suspiciousPatterns = [
      // XSS attempts
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      
      // SQL injection attempts
      /(\b(union|select|insert|delete|update|drop|create|alter)\b.*\b(from|where|join|into|values)\b)/gi,
      /['";]\s*(or|and|union)\s*['";]/gi,
      
      // Path traversal attempts
      /(\.\.[\/\\]){2,}/g,
      
      // Command injection attempts
      /[;&|`$(){}[\]]/g,
      
      // Server-side template injection
      /\{\{.*\}\}/g,
      /\$\{.*\}/g,
      
      // LDAP injection
      /\*\)\(.*\*\)/g,
      
      // NoSQL injection
      /\$where.*function/gi,
      /\$regex/gi
    ];
    
    const testString = JSON.stringify({
      url: req.url,
      query: req.query,
      body: req.body,
      headers: req.headers
    });
    
    return suspiciousPatterns.some(pattern => pattern.test(testString));
  },

  // Log security events
  logSecurityEvent: (eventType, details, severity = 'MEDIUM') => {
    const securityEvent = {
      timestamp: new Date().toISOString(),
      eventType,
      severity,
      details,
      source: 'FANZ_MONEY_DASH_SECURITY'
    };
    
    console.warn(`🚨 SECURITY EVENT [${severity}]: ${eventType}`, securityEvent);
    
    // In production, you might want to send this to a security monitoring service
    if (process.env.NODE_ENV === 'production' && process.env.SECURITY_WEBHOOK_URL) {
      // Send to security monitoring service
      // This could be Splunk, DataDog, or custom security dashboard
    }
  },

  // Rate limiting for security events
  securityEventLimiter: new Map(),
  
  // Throttle security event logging to prevent log spam
  throttledSecurityLog: function(eventKey, eventType, details, severity = 'MEDIUM') {
    const now = Date.now();
    const lastLogged = this.securityEventLimiter.get(eventKey) || 0;
    const cooldown = 60000; // 1 minute cooldown
    
    if (now - lastLogged > cooldown) {
      this.securityEventLimiter.set(eventKey, now);
      this.logSecurityEvent(eventType, details, severity);
    }
  }
};

// Security middleware factory for suspicious activity detection
export const suspiciousActivityDetector = () => {
  return (req, res, next) => {
    if (securityMonitoring.detectSuspiciousActivity(req)) {
      const eventKey = `suspicious_${req.ip}_${req.path}`;
      securityMonitoring.throttledSecurityLog(
        eventKey,
        'SUSPICIOUS_ACTIVITY_DETECTED',
        {
          ip: req.ip,
          method: req.method,
          path: req.path,
          userAgent: req.get('User-Agent'),
          referer: req.get('Referer')
        },
        'HIGH'
      );
      
      // Don't block the request, just log it
      // In a more aggressive setup, you might want to return 403
    }
    
    next();
  };
};

// Export all security configurations
export default {
  advancedSecurityConfig,
  advancedRateLimiting,
  securityHeaders,
  inputSecurity,
  securityMonitoring,
  suspiciousActivityDetector
};