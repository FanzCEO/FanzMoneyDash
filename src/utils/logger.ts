/**
 * Logger Utility
 * Winston-based logging system for FanzMoneyDash
 */

import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFilePath = process.env.LOG_FILE_PATH || './logs/fanzmoney.log';
const maxSize = process.env.LOG_MAX_SIZE || '20m';
const maxFiles = process.env.LOG_MAX_FILES || '14d';

// Ensure logs directory exists
import { mkdir } from 'fs/promises';
mkdir(path.dirname(logFilePath), { recursive: true }).catch(() => {});

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, ...meta } = info;
    
    const logObject = {
      timestamp,
      level,
      service: service || 'FanzMoneyDash',
      message,
      ...(Object.keys(meta).length && { meta })
    };
    
    return JSON.stringify(logObject);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, ...meta } = info;
    const serviceName = service || 'FanzMoneyDash';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${serviceName}] ${level}: ${message}${metaStr}`;
  })
);

// Create winston logger instance
const winstonLogger = winston.createLogger({
  level: logLevel,
  format: customFormat,
  defaultMeta: { service: 'FanzMoneyDash' },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: logFilePath,
      maxsize: maxSize === '20m' ? 20 * 1024 * 1024 : parseInt(maxSize),
      maxFiles: maxFiles === '14d' ? 14 : parseInt(maxFiles),
      tailable: true,
      zippedArchive: true
    }),
    
    // Error-specific log file
    new winston.transports.File({
      filename: path.join(path.dirname(logFilePath), 'error.log'),
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
  winstonLogger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

/**
 * Logger class wrapper around Winston
 */
export class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void {
    winstonLogger.debug(message, { service: this.service, ...meta });
  }

  /**
   * Log info message
   */
  info(message: string, meta?: any): void {
    winstonLogger.info(message, { service: this.service, ...meta });
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void {
    winstonLogger.warn(message, { service: this.service, ...meta });
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | any, meta?: any): void {
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
  }): void {
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
  security(event: string, data: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    riskScore?: number;
    action?: string;
    [key: string]: any;
  }): void {
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
  audit(action: string, data: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    changes?: any;
    ipAddress?: string;
    [key: string]: any;
  }): void {
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
  performance(metric: string, data: {
    duration?: number;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    [key: string]: any;
  }): void {
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
  health(component: string, status: 'healthy' | 'degraded' | 'unhealthy', data?: any): void {
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

// Export default logger instance
export const logger = new Logger('FanzMoneyDash');
export default winstonLogger;