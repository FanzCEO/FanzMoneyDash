"use strict";
/**
 * FanzMoneyDash - Main Application Entry Point
 * Enterprise-grade financial operations system for the FANZ ecosystem
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const logger_1 = require("./utils/logger");
const app_1 = require("./config/app");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const health_1 = require("./utils/health");
const setup_1 = require("./middleware/setup");
const api_1 = __importDefault(require("./routes/api"));
const logger = new logger_1.Logger('FanzMoneyDash');
const config = (0, app_1.getConfig)();
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
exports.server = server;
/**
 * Initialize application
 */
async function initializeApp() {
    try {
        logger.info('🚀 Initializing FanzMoneyDash...');
        // Initialize database connection
        logger.info('📊 Connecting to database...');
        await database_1.DatabaseConnection.initialize();
        logger.info('✅ Database connected');
        // Initialize Redis connection
        logger.info('🔴 Connecting to Redis...');
        await redis_1.RedisConnection.initialize();
        logger.info('✅ Redis connected');
        // Setup Express middleware
        logger.info('🔧 Setting up middleware...');
        (0, setup_1.setupMiddleware)(app);
        // Setup API routes
        logger.info('🛣️ Setting up routes...');
        app.use('/api', api_1.default);
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
                const healthStatus = await (0, health_1.checkHealth)();
                const statusCode = healthStatus.overall === 'healthy' ? 200 :
                    healthStatus.overall === 'degraded' ? 200 : 503;
                res.status(statusCode).json(healthStatus);
            }
            catch (error) {
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
        app.use((err, req, res, next) => {
            logger.error('Unhandled error:', err, {
                url: req.url,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            res.status(err.status || 500).json({
                success: false,
                error: (0, app_1.isDevelopment)() ? err.message : 'Internal server error',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'],
                ...((0, app_1.isDevelopment)() && { stack: err.stack })
            });
        });
        // Initialize health monitoring if enabled
        if (config.monitoring.healthCheck.enabled) {
            logger.info('🏥 Starting health monitoring...');
            health_1.HealthChecker.startMonitoring(config.monitoring.healthCheck.interval);
        }
        logger.info('✅ Application initialized');
    }
    catch (error) {
        logger.error('❌ Failed to initialize application:', error);
        throw error;
    }
}
/**
 * Start the server
 */
async function startServer() {
    try {
        await initializeApp();
        server.listen(config.port, config.host, () => {
            logger.info(`🌟 FanzMoneyDash server running on ${config.host}:${config.port}`);
            logger.info(`📝 Environment: ${config.env}`);
            logger.info(`🔗 API Base URL: http://${config.host}:${config.port}/api`);
            logger.info(`🏥 Health Check: http://${config.host}:${config.port}/health`);
            if ((0, app_1.isDevelopment)()) {
                logger.info(`🏠 Basic Status: http://${config.host}:${config.port}/`);
                logger.info(`📊 Admin Overview: http://${config.host}:${config.port}/api/admin/financial-overview`);
                logger.info(`🔍 Creator Dashboard: http://${config.host}:${config.port}/api/creator/financial-overview`);
                logger.info(`💳 Payment Processing: http://${config.host}:${config.port}/api/payments/process`);
            }
        });
        // Graceful shutdown
        const gracefulShutdown = (signal) => {
            logger.info(`🛑 ${signal} received. Starting graceful shutdown...`);
            server.close(async () => {
                logger.info('📡 HTTP server closed');
                try {
                    await database_1.DatabaseConnection.close();
                    logger.info('📊 Database connection closed');
                    await redis_1.RedisConnection.close();
                    logger.info('🔴 Redis connection closed');
                    logger.info('✅ Graceful shutdown completed');
                    process.exit(0);
                }
                catch (error) {
                    logger.error('❌ Error during shutdown:', error);
                    process.exit(1);
                }
            });
        };
        // Handle shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map