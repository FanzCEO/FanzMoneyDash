/**
 * Security Middleware
 * Authentication and authorization middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getSecurityConfig } from '../config/app';
import { Logger } from '../utils/logger';

const logger = new Logger('Security');
const config = getSecurityConfig();

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      rawBody?: Buffer;
    }
  }
}

/**
 * JWT Authentication Middleware
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
    return;
  }

  jwt.verify(token, config.jwtSecret, (err: any, user: any) => {
    if (err) {
      logger.warn('JWT verification failed', { error: err.message, token: token.substring(0, 20) + '...' });
      res.status(403).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
      return;
    }

    req.user = user;
    next();
  });
}

/**
 * Optional JWT Authentication (doesn't block if no token)
 */
export function authenticateOptional(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  jwt.verify(token, config.jwtSecret, (err: any, user: any) => {
    if (!err) {
      req.user = user;
    }
    next();
  });
}

/**
 * Role-based authorization middleware
 */
export function requireRole(roles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      logger.warn('Insufficient permissions', {
        userId: req.user.id,
        userRoles,
        requiredRoles,
        path: req.path,
        method: req.method
      });
      
      res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions' 
      });
      return;
    }

    next();
  };
}

/**
 * Admin only access
 */
export const requireAdmin = requireRole('admin');

/**
 * Creator access (admin or creator)
 */
export const requireCreator = requireRole(['admin', 'creator']);

/**
 * Webhook signature validation
 */
export function validateWebhookSignature(secretKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-webhook-signature'] || req.headers['stripe-signature'];
    
    if (!signature) {
      res.status(401).json({ 
        success: false, 
        error: 'Webhook signature required' 
      });
      return;
    }

    // Basic signature validation - implement according to each processor's requirements
    // For now, just log and continue
    logger.debug('Webhook signature received', { 
      signature: signature.toString().substring(0, 20) + '...',
      path: req.path 
    });

    next();
  };
}

/**
 * API Key validation middleware
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    res.status(401).json({ 
      success: false, 
      error: 'API key required' 
    });
    return;
  }

  // In production, validate against database of valid API keys
  // For now, just basic validation
  if (typeof apiKey !== 'string' || apiKey.length < 32) {
    res.status(401).json({ 
      success: false, 
      error: 'Invalid API key format' 
    });
    return;
  }

  next();
}

/**
 * Input sanitization middleware
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  // Basic XSS protection - remove script tags and dangerous attributes
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitize(obj[key]);
        }
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
}

/**
 * Generate JWT token
 */
export function generateToken(payload: object, expiresIn: string = config.jwtExpiresIn): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

// Aliases for compatibility
export const authenticate = authenticateToken;
export const authorize = requireRole;
export const auditLog = sanitizeInput; // Placeholder for audit functionality

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: object): string {
  return jwt.sign(payload, config.jwtSecret, { 
    expiresIn: config.jwtRefreshExpiresIn 
  });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.jwtSecret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
}