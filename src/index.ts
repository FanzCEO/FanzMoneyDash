/**
 * FanzMoneyDash - Main Application Entry Point
 * Enterprise-grade financial operations system for the FANZ ecosystem
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Logger } from './utils/logger';
import { getConfig, isProduction, isDevelopment } from './config/app';
import { DatabaseConnection } from './config/database';
import { RedisConnection } from './config/redis';
import { HealthChecker, checkHealth } from './utils/health';
import { setupMiddleware } from './middleware/setup';
import apiRoutes from './routes/api';

// Import services for initialization
import { moneyOrchestrator } from './services/money-orchestrator';
import { fanzTrustEngine } from './services/fanztrust-service';

const logger = new Logger('FanzMoneyDash');
const config = getConfig();
const app = express();
const server = createServer(app);

/**
 * Initialize application
 */
async function initializeApp(): Promise<void> {
  try {
    logger.info('🚀 Initializing FanzMoneyDash...');

    // Initialize database connection
    logger.info('📊 Connecting to database...');
    await DatabaseConnection.initialize();
    logger.info('✅ Database connected');

    // Initialize Redis connection
    logger.info('🔴 Connecting to Redis...');
    await RedisConnection.initialize();
    logger.info('✅ Redis connected');

    // Setup Express middleware
    logger.info('🔧 Setting up middleware...');
    setupMiddleware(app);

    // Setup API routes
    logger.info('🛣️ Setting up routes...');
    app.use('/api', apiRoutes);

    // Health check endpoints
    app.get('/', (req, res) => {
      res.json({
        service: 'FanzMoneyDash',
        status: 'healthy',
        version: process.env.npm_package_version || '1.0.0',
        environment: config.env,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime())
      });
    });

    // Detailed health check endpoint
    app.get('/health', async (req, res) => {
      try {
        const healthStatus = await checkHealth();
        const statusCode = healthStatus.overall === 'healthy' ? 200 : 
                          healthStatus.overall === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(healthStatus);
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          overall: 'unhealthy',
          services: [],
          error: 'Health check system failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Simple health check for load balancers
    app.get('/healthz', (req, res) => {
      res.status(200).send('OK');
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Global error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err, {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.status(err.status || 500).json({
        success: false,
        error: isDevelopment() ? err.message : 'Internal server error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'],
        ...(isDevelopment() && { stack: err.stack })
      });
    });

    // Initialize health monitoring if enabled
    if (config.monitoring.healthCheck.enabled) {
      logger.info('🏥 Starting health monitoring...');
      HealthChecker.startMonitoring(config.monitoring.healthCheck.interval);
    }

    logger.info('✅ Application initialized');
  } catch (error) {
    logger.error('❌ Failed to initialize application:', error);
    throw error;
  }
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    await initializeApp();

    server.listen(config.port, config.host, () => {
      logger.info(`🌟 FanzMoneyDash server running on ${config.host}:${config.port}`);
      logger.info(`📝 Environment: ${config.env}`);
      logger.info(`🔗 API Base URL: http://${config.host}:${config.port}/api`);
      logger.info(`🏥 Health Check: http://${config.host}:${config.port}/health`);
      
      if (isDevelopment()) {
        logger.info(`🏠 Basic Status: http://${config.host}:${config.port}/`);
        logger.info(`📊 Admin Overview: http://${config.host}:${config.port}/api/admin/financial-overview`);
        logger.info(`🔍 Creator Dashboard: http://${config.host}:${config.port}/api/creator/financial-overview`);
        logger.info(`💳 Payment Processing: http://${config.host}:${config.port}/api/payments/process`);
      }
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`🛑 ${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('📡 HTTP server closed');
        
        try {
          await DatabaseConnection.close();
          logger.info('📊 Database connection closed');
          
          await RedisConnection.close();
          logger.info('🔴 Redis connection closed');
          
          logger.info('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Handle uncaught exceptions and unhandled rejections
 */
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  startServer();
}

export { app, server };