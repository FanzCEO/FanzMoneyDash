/**
 * Middleware Setup
 * Centralized middleware configuration and setup
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { getConfig, isDevelopment } from '../config/app';
import { Logger } from '../utils/logger';

const logger = new Logger('Middleware');
const config = getConfig();

/**
 * Set up all Express middleware
 */
export function setupMiddleware(app: express.Application): void {
  logger.info('🔧 Setting up middleware...');

  // Request ID middleware for tracing
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || 
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    res.setHeader('X-Request-ID', req.headers['x-request-id'] as string);
    next();
  });

  // Security middleware
  if (config.security.helmetEnabled) {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      // Disable CSP in development for easier debugging
      ...(isDevelopment() && { contentSecurityPolicy: false })
    }));
    logger.debug('✅ Helmet security headers enabled');
  }

  // Compression middleware
  app.use(compression({
    filter: (req: express.Request, res: express.Response) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024, // Only compress if size > 1KB
  }));
  logger.debug('✅ Response compression enabled');

  // CORS middleware
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (config.security.corsOrigins.includes(origin) || 
          config.security.corsOrigins.includes('*')) {
        return callback(null, true);
      }
      
      // In development, be more permissive
      if (isDevelopment()) {
        return callback(null, true);
      }
      
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'X-Request-ID',
      'X-API-Key'
    ],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400 // 24 hours
  }));
  logger.debug('✅ CORS configured', { origins: config.security.corsOrigins.length });

  // Rate limiting middleware
  const limiter = rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.rateLimitMax,
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: express.Request, res: express.Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      });
      
      res.status(429).json({
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000),
        timestamp: new Date().toISOString()
      });
    },
    // Skip rate limiting for health checks
    skip: (req: express.Request) => {
      return req.path === '/health' || req.path === '/healthz' || req.path === '/';
    }
  });

  app.use(limiter);
  logger.debug('✅ Rate limiting enabled', { 
    max: config.security.rateLimitMax,
    windowMs: config.security.rateLimitWindowMs 
  });

  // Body parsing middleware
  app.use(express.json({ 
    limit: '10mb',
    verify: (req: any, res: express.Response, buf: Buffer) => {
      // Store raw body for webhook signature verification
      req.rawBody = buf;
    }
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
  }));
  
  logger.debug('✅ Body parsing configured');

  // Request logging middleware
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();
    
    // Log request
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.headers['x-request-id']
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
      
      logger[logLevel]('HTTP Response', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId: req.headers['x-request-id']
      });
    });

    next();
  });

  // Trust proxy settings for accurate IP addresses
  if (config.env === 'production') {
    app.set('trust proxy', 1);
    logger.debug('✅ Trust proxy enabled for production');
  }

  // Disable X-Powered-By header
  app.disable('x-powered-by');

  logger.info('✅ All middleware configured');
}