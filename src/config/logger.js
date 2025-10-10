/**
 * FANZ MoneyDash Logging Configuration
 * Comprehensive logging setup with Winston for production monitoring
 */

import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log levels for FANZ MoneyDash
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
  trace: 'gray'
};

winston.addColors(logColors);

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.metadata(),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, userId, transactionId, ...meta } = info;
    
    const logEntry = {
      '@timestamp': timestamp,
      level: level.toUpperCase(),
      message,
      service: service || 'fanz-money-dash',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      pid: process.pid,
      hostname: process.env.HOSTNAME || require('os').hostname()
    };

    // Add context information if available
    if (userId) logEntry.userId = userId;
    if (transactionId) logEntry.transactionId = transactionId;

    // Add metadata
    if (Object.keys(meta).length > 0) {
      logEntry.metadata = meta;
    }

    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, userId, transactionId, ...meta } = info;
    let logLine = `[${timestamp}] ${level}: ${message}`;
    
    if (userId) logLine += ` | User: ${userId}`;
    if (transactionId) logLine += ` | Tx: ${transactionId}`;
    
    if (Object.keys(meta).length > 0) {
      logLine += ` | ${JSON.stringify(meta)}`;
    }
    
    return logLine;
  })
);

// Create logs directory
const logsDir = join(process.cwd(), 'logs');

// Logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels: logLevels,
  format: logFormat,
  defaultMeta: {
    service: 'fanz-money-dash'
  },
  transports: []
};

// Production transports
if (process.env.NODE_ENV === 'production') {
  // Application logs
  loggerConfig.transports.push(
    new winston.transports.File({
      filename: join(logsDir, 'app.log'),
      level: 'info',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      format: logFormat
    })
  );

  // Error logs
  loggerConfig.transports.push(
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      format: logFormat
    })
  );

  // Security logs
  loggerConfig.transports.push(
    new winston.transports.File({
      filename: join(logsDir, 'security.log'),
      level: 'warn',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      format: logFormat,
      filter: (info) => {
        // Only log security-related events
        return info.category === 'security' || 
               info.type === 'security' ||
               info.message.toLowerCase().includes('security') ||
               info.message.toLowerCase().includes('suspicious') ||
               info.message.toLowerCase().includes('unauthorized');
      }
    })
  );

  // Transaction logs for financial operations
  loggerConfig.transports.push(
    new winston.transports.File({
      filename: join(logsDir, 'transactions.log'),
      level: 'info',
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 20,
      format: logFormat,
      filter: (info) => {
        return info.category === 'transaction' || 
               info.type === 'transaction' ||
               info.transactionId;
      }
    })
  );

  // HTTP access logs
  loggerConfig.transports.push(
    new winston.transports.File({
      filename: join(logsDir, 'access.log'),
      level: 'http',
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 15,
      format: logFormat,
      filter: (info) => {
        return info.level === 'http' || info.category === 'http';
      }
    })
  );
}

// Development and console transport
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_CONSOLE_LOGGING === 'true') {
  loggerConfig.transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'debug'
    })
  );
}

// Create the logger
const logger = winston.createLogger(loggerConfig);

// Create specialized loggers for different categories
export const securityLogger = winston.createLogger({
  ...loggerConfig,
  defaultMeta: {
    service: 'fanz-money-dash',
    category: 'security'
  }
});

export const transactionLogger = winston.createLogger({
  ...loggerConfig,
  defaultMeta: {
    service: 'fanz-money-dash',
    category: 'transaction'
  }
});

export const auditLogger = winston.createLogger({
  ...loggerConfig,
  defaultMeta: {
    service: 'fanz-money-dash',
    category: 'audit'
  }
});

// HTTP access logging middleware
export const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime: duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
      sessionId: req.sessionID,
      category: 'http'
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('HTTP request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP request error', logData);
    } else {
      logger.http('HTTP request completed', logData);
    }
  });

  next();
};

// Security event logging helper
export const logSecurityEvent = (event, details = {}) => {
  securityLogger.warn('Security event detected', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Transaction logging helper
export const logTransaction = (level, message, transactionData = {}) => {
  transactionLogger.log(level, message, {
    timestamp: new Date().toISOString(),
    ...transactionData
  });
};

// Audit logging helper
export const logAudit = (action, details = {}) => {
  auditLogger.info('Audit event', {
    action,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Error logging helper with context
export const logError = (error, context = {}) => {
  logger.error('Application error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...context
  });
};

// Performance logging helper
export const logPerformance = (operation, duration, details = {}) => {
  logger.info('Performance metric', {
    operation,
    duration,
    category: 'performance',
    ...details
  });
};

// Database operation logging
export const logDatabaseOperation = (operation, collection, duration, details = {}) => {
  logger.debug('Database operation', {
    operation,
    collection,
    duration,
    category: 'database',
    ...details
  });
};

// Payment processor logging
export const logPayment = (processor, operation, amount, details = {}) => {
  transactionLogger.info('Payment operation', {
    processor,
    operation,
    amount,
    timestamp: new Date().toISOString(),
    category: 'payment',
    ...details
  });
};

// User action logging
export const logUserAction = (userId, action, details = {}) => {
  auditLogger.info('User action', {
    userId,
    action,
    timestamp: new Date().toISOString(),
    category: 'user_action',
    ...details
  });
};

// Startup logging
export const logStartup = (component, status, details = {}) => {
  logger.info(`${component} ${status}`, {
    component,
    status,
    category: 'startup',
    ...details
  });
};

// Graceful shutdown logging
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully', {
    category: 'shutdown'
  });
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully', {
    category: 'shutdown'
  });
});

// Uncaught exception logging
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    category: 'fatal'
  });
  
  // Give logger time to write before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Unhandled promise rejection logging
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      stack: reason.stack
    } : reason,
    promise: promise.toString(),
    category: 'fatal'
  });
});

export default logger;