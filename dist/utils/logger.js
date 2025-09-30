"use strict";
/**
 * Logger Utility
 * Winston-based logging system for FanzMoneyDash
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logLevel = process.env.LOG_LEVEL || 'info';
const logFilePath = process.env.LOG_FILE_PATH || './logs/fanzmoney.log';
const maxSize = process.env.LOG_MAX_SIZE || '20m';
const maxFiles = process.env.LOG_MAX_FILES || '14d';
// Ensure logs directory exists
const promises_1 = require("fs/promises");
(0, promises_1.mkdir)(path_1.default.dirname(logFilePath), { recursive: true }).catch(() => { });
// Custom format for structured logging
const customFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
}), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf((info) => {
    const { timestamp, level, message, service, ...meta } = info;
    const logObject = {
        timestamp,
        level,
        service: service || 'FanzMoneyDash',
        message,
        ...(Object.keys(meta).length && { meta })
    };
    return JSON.stringify(logObject);
}));
// Console format for development
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({
    format: 'HH:mm:ss'
}), winston_1.default.format.printf((info) => {
    const { timestamp, level, message, service, ...meta } = info;
    const serviceName = service || 'FanzMoneyDash';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${serviceName}] ${level}: ${message}${metaStr}`;
}));
// Create winston logger instance
const winstonLogger = winston_1.default.createLogger({
    level: logLevel,
    format: customFormat,
    defaultMeta: { service: 'FanzMoneyDash' },
    transports: [
        // File transport for all logs
        new winston_1.default.transports.File({
            filename: logFilePath,
            maxsize: maxSize === '20m' ? 20 * 1024 * 1024 : parseInt(maxSize),
            maxFiles: maxFiles === '14d' ? 14 : parseInt(maxFiles),
            tailable: true,
            zippedArchive: true
        }),
        // Error-specific log file
        new winston_1.default.transports.File({
            filename: path_1.default.join(path_1.default.dirname(logFilePath), 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 7,
            tailable: true,
            zippedArchive: true
        })
    ]
});
// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    winstonLogger.add(new winston_1.default.transports.Console({
        format: consoleFormat,
        level: 'debug'
    }));
}
/**
 * Logger class wrapper around Winston
 */
class Logger {
    service;
    constructor(service) {
        this.service = service;
    }
    /**
     * Log debug message
     */
    debug(message, meta) {
        winstonLogger.debug(message, { service: this.service, ...meta });
    }
    /**
     * Log info message
     */
    info(message, meta) {
        winstonLogger.info(message, { service: this.service, ...meta });
    }
    /**
     * Log warning message
     */
    warn(message, meta) {
        winstonLogger.warn(message, { service: this.service, ...meta });
    }
    /**
     * Log error message
     */
    error(message, error, meta) {
        const errorMeta = error instanceof Error
            ? { error: { message: error.message, stack: error.stack, name: error.name } }
            : { error };
        winstonLogger.error(message, {
            service: this.service,
            ...errorMeta,
            ...meta
        });
    }
    /**
     * Log financial transaction
     */
    transaction(action, data) {
        winstonLogger.info(`Transaction: ${action}`, {
            service: this.service,
            category: 'transaction',
            action,
            ...data
        });
    }
    /**
     * Log security event
     */
    security(event, data) {
        winstonLogger.warn(`Security: ${event}`, {
            service: this.service,
            category: 'security',
            event,
            ...data
        });
    }
    /**
     * Log audit event
     */
    audit(action, data) {
        winstonLogger.info(`Audit: ${action}`, {
            service: this.service,
            category: 'audit',
            action,
            ...data
        });
    }
    /**
     * Log performance metrics
     */
    performance(metric, data) {
        winstonLogger.info(`Performance: ${metric}`, {
            service: this.service,
            category: 'performance',
            metric,
            ...data
        });
    }
    /**
     * Log system health metrics
     */
    health(component, status, data) {
        const level = status === 'healthy' ? 'info' : status === 'degraded' ? 'warn' : 'error';
        winstonLogger.log(level, `Health: ${component} is ${status}`, {
            service: this.service,
            category: 'health',
            component,
            status,
            ...data
        });
    }
}
exports.Logger = Logger;
// Export default logger instance
exports.logger = new Logger('FanzMoneyDash');
exports.default = winstonLogger;
//# sourceMappingURL=logger.js.map