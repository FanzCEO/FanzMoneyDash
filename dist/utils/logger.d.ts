/**
 * Logger Utility
 * Winston-based logging system for FanzMoneyDash
 */
import winston from 'winston';
declare const winstonLogger: winston.Logger;
/**
 * Logger class wrapper around Winston
 */
export declare class Logger {
    private service;
    constructor(service: string);
    /**
     * Log debug message
     */
    debug(message: string, meta?: any): void;
    /**
     * Log info message
     */
    info(message: string, meta?: any): void;
    /**
     * Log warning message
     */
    warn(message: string, meta?: any): void;
    /**
     * Log error message
     */
    error(message: string, error?: Error | any, meta?: any): void;
    /**
     * Log financial transaction
     */
    transaction(action: string, data: {
        transactionId?: string;
        amount?: string;
        currency?: string;
        userId?: string;
        creatorId?: string;
        platform?: string;
        processor?: string;
        status?: string;
        [key: string]: any;
    }): void;
    /**
     * Log security event
     */
    security(event: string, data: {
        userId?: string;
        ipAddress?: string;
        userAgent?: string;
        riskScore?: number;
        action?: string;
        [key: string]: any;
    }): void;
    /**
     * Log audit event
     */
    audit(action: string, data: {
        userId?: string;
        entityType?: string;
        entityId?: string;
        changes?: any;
        ipAddress?: string;
        [key: string]: any;
    }): void;
    /**
     * Log performance metrics
     */
    performance(metric: string, data: {
        duration?: number;
        endpoint?: string;
        method?: string;
        statusCode?: number;
        [key: string]: any;
    }): void;
    /**
     * Log system health metrics
     */
    health(component: string, status: 'healthy' | 'degraded' | 'unhealthy', data?: any): void;
}
export declare const logger: Logger;
export default winstonLogger;
//# sourceMappingURL=logger.d.ts.map