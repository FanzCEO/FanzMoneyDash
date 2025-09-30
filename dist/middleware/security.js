"use strict";
/**
 * Security Middleware
 * Authentication and authorization middleware
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = exports.authorize = exports.authenticate = exports.requireCreator = exports.requireAdmin = void 0;
exports.authenticateToken = authenticateToken;
exports.authenticateOptional = authenticateOptional;
exports.requireRole = requireRole;
exports.validateWebhookSignature = validateWebhookSignature;
exports.validateApiKey = validateApiKey;
exports.sanitizeInput = sanitizeInput;
exports.generateToken = generateToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_1 = require("../config/app");
const logger_1 = require("../utils/logger");
const logger = new logger_1.Logger('Security');
const config = (0, app_1.getSecurityConfig)();
/**
 * JWT Authentication Middleware
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({
            success: false,
            error: 'Access token required'
        });
        return;
    }
    jsonwebtoken_1.default.verify(token, config.jwtSecret, (err, user) => {
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
function authenticateOptional(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        next();
        return;
    }
    jsonwebtoken_1.default.verify(token, config.jwtSecret, (err, user) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
}
/**
 * Role-based authorization middleware
 */
function requireRole(roles) {
    return (req, res, next) => {
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
exports.requireAdmin = requireRole('admin');
/**
 * Creator access (admin or creator)
 */
exports.requireCreator = requireRole(['admin', 'creator']);
/**
 * Webhook signature validation
 */
function validateWebhookSignature(secretKey) {
    return (req, res, next) => {
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
function validateApiKey(req, res, next) {
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
function sanitizeInput(req, res, next) {
    // Basic XSS protection - remove script tags and dangerous attributes
    const sanitize = (obj) => {
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
            const sanitized = {};
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
function generateToken(payload, expiresIn = config.jwtExpiresIn) {
    return jsonwebtoken_1.default.sign(payload, config.jwtSecret, { expiresIn });
}
// Aliases for compatibility
exports.authenticate = authenticateToken;
exports.authorize = requireRole;
exports.auditLog = sanitizeInput; // Placeholder for audit functionality
/**
 * Generate refresh token
 */
function generateRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtRefreshExpiresIn
    });
}
/**
 * Verify and decode JWT token
 */
function verifyToken(token) {
    return new Promise((resolve, reject) => {
        jsonwebtoken_1.default.verify(token, config.jwtSecret, (err, decoded) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(decoded);
            }
        });
    });
}
//# sourceMappingURL=security.js.map