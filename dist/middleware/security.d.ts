/**
 * Security Middleware
 * Authentication and authorization middleware
 */
import { Request, Response, NextFunction } from 'express';
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
export declare function authenticateToken(req: Request, res: Response, next: NextFunction): void;
/**
 * Optional JWT Authentication (doesn't block if no token)
 */
export declare function authenticateOptional(req: Request, res: Response, next: NextFunction): void;
/**
 * Role-based authorization middleware
 */
export declare function requireRole(roles: string | string[]): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Admin only access
 */
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Creator access (admin or creator)
 */
export declare const requireCreator: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Webhook signature validation
 */
export declare function validateWebhookSignature(secretKey: string): (req: Request, res: Response, next: NextFunction) => void;
/**
 * API Key validation middleware
 */
export declare function validateApiKey(req: Request, res: Response, next: NextFunction): void;
/**
 * Input sanitization middleware
 */
export declare function sanitizeInput(req: Request, res: Response, next: NextFunction): void;
/**
 * Generate JWT token
 */
export declare function generateToken(payload: object, expiresIn?: string): string;
export declare const authenticate: typeof authenticateToken;
export declare const authorize: typeof requireRole;
export declare const auditLog: typeof sanitizeInput;
/**
 * Generate refresh token
 */
export declare function generateRefreshToken(payload: object): string;
/**
 * Verify and decode JWT token
 */
export declare function verifyToken(token: string): Promise<any>;
//# sourceMappingURL=security.d.ts.map