"use strict";
/**
 * FanzMoneyDash API Routes
 * RESTful endpoints for all FANZ dashboard integrations
 * Provides secure, rate-limited APIs for financial operations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
// Import controllers
const dashboard_controllers_1 = require("../controllers/dashboard-controllers");
// Import middleware
const security_1 = require("../middleware/security");
const router = (0, express_1.Router)();
// ========================================
// SECURITY MIDDLEWARE
// ========================================
// Security headers
router.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
// CORS configuration for different dashboard origins
const corsOptions = {
    origin: [
        'https://fanzdash.com',
        'https://admin.fanz.network',
        'https://creator.boyfanz.com',
        'https://creator.girlfanz.com',
        'https://creator.pupfanz.com',
        'https://starz.boyfanz.com',
        'https://starz.girlfanz.com',
        'https://starz.pupfanz.com',
        'https://dashboard.taboofanz.com',
        'https://dashboard.transfanz.com',
        /^https:\/\/.*\.fanz\.network$/, // Allow all fanz.network subdomains
        process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Platform-ID'],
    credentials: true,
    maxAge: 86400 // 24 hours
};
router.use((0, cors_1.default)(corsOptions));
// Rate limiting by endpoint type
const createRateLimit = (windowMs, max, message) => (0, express_rate_limit_1.default)({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: message,
            retryAfter: Math.ceil(windowMs / 1000)
        });
    }
});
// Different rate limits for different operations
const adminRateLimit = createRateLimit(15 * 60 * 1000, 100, 'Too many admin requests'); // 100 req/15min
const paymentRateLimit = createRateLimit(60 * 1000, 10, 'Too many payment requests'); // 10 req/min
const generalRateLimit = createRateLimit(15 * 60 * 1000, 1000, 'Too many requests'); // 1000 req/15min
// Input validation helper
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};
// ========================================
// ADMIN DASHBOARD ROUTES
// ========================================
/**
 * Admin Financial Overview
 * GET /api/admin/financial-overview
 */
router.get('/admin/financial-overview', adminRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'moderator']), [
    (0, express_validator_1.query)('timeframe').optional().isIn(['1d', '7d', '30d', '90d', '1y']),
    (0, express_validator_1.query)('platforms').optional().isString()
], handleValidationErrors, (0, security_1.auditLog)('admin.financial_overview.view'), dashboard_controllers_1.adminDashboardController.getFinancialOverview);
/**
 * Settlement Reports
 * GET /api/admin/settlements
 */
router.get('/admin/settlements', adminRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'moderator']), [
    (0, express_validator_1.query)('dateFrom').isISO8601().withMessage('Invalid dateFrom format'),
    (0, express_validator_1.query)('dateTo').isISO8601().withMessage('Invalid dateTo format'),
    (0, express_validator_1.query)('processors').optional().isString()
], handleValidationErrors, (0, security_1.auditLog)('admin.settlements.view'), dashboard_controllers_1.adminDashboardController.getSettlementReports);
/**
 * Transaction Monitoring
 * GET /api/admin/transactions/monitor
 */
router.get('/admin/transactions/monitor', adminRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'moderator', 'support']), [
    (0, express_validator_1.query)('status').optional().isIn(['pending', 'completed', 'failed', 'requires_verification']),
    (0, express_validator_1.query)('processor').optional().isString(),
    (0, express_validator_1.query)('platform').optional().isString(),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, (0, security_1.auditLog)('admin.transactions.monitor'), dashboard_controllers_1.adminDashboardController.getTransactionMonitoring);
/**
 * Dispute Management
 * PUT /api/admin/disputes/:disputeId
 */
router.put('/admin/disputes/:disputeId', adminRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'moderator']), [
    (0, express_validator_1.param)('disputeId').isUUID().withMessage('Invalid dispute ID'),
    (0, express_validator_1.body)('action').isIn(['accept', 'fight', 'settle']).withMessage('Invalid action'),
    (0, express_validator_1.body)('notes').optional().isString().isLength({ max: 1000 }),
    (0, express_validator_1.body)('evidence').optional().isObject()
], handleValidationErrors, security_1.sanitizeInput, (0, security_1.auditLog)('admin.dispute.manage'), dashboard_controllers_1.adminDashboardController.manageDispute);
/**
 * Refund Approval
 * POST /api/admin/approvals/:approvalId/process
 */
router.post('/admin/approvals/:approvalId/process', adminRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'moderator']), [
    (0, express_validator_1.param)('approvalId').isUUID().withMessage('Invalid approval ID'),
    (0, express_validator_1.body)('action').isIn(['approve', 'reject']).withMessage('Invalid action'),
    (0, express_validator_1.body)('reason').isString().isLength({ min: 10, max: 500 }),
    (0, express_validator_1.body)('notes').optional().isString().isLength({ max: 1000 })
], handleValidationErrors, security_1.sanitizeInput, (0, security_1.auditLog)('admin.refund.approve'), dashboard_controllers_1.adminDashboardController.processRefundApproval);
// ========================================
// CREATOR DASHBOARD ROUTES
// ========================================
/**
 * Creator Financial Summary
 * GET /api/creators/:creatorId/financial-summary
 */
router.get('/creators/:creatorId/financial-summary', generalRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'moderator', 'creator']), [
    (0, express_validator_1.param)('creatorId').isUUID().withMessage('Invalid creator ID')
], handleValidationErrors, (0, security_1.auditLog)('creator.financial_summary.view'), dashboard_controllers_1.creatorDashboardController.getFinancialSummary);
/**
 * Creator Payout Request
 * POST /api/creators/:creatorId/payouts
 */
router.post('/creators/:creatorId/payouts', paymentRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'creator']), [
    (0, express_validator_1.param)('creatorId').isUUID().withMessage('Invalid creator ID'),
    (0, express_validator_1.body)('amount').isDecimal({ decimal_digits: '0,2' }).withMessage('Invalid amount'),
    (0, express_validator_1.body)('currency').isISO4217().withMessage('Invalid currency code'),
    (0, express_validator_1.body)('payoutMethod').isIn(['paxum', 'wise', 'payoneer', 'crypto', 'ach', 'wire']),
    (0, express_validator_1.body)('payoutDetails').isObject().withMessage('Payout details required'),
    (0, express_validator_1.body)('scheduleType').optional().isIn(['instant', 'daily', 'weekly', 'manual']),
    (0, express_validator_1.body)('platform').optional().isString(),
    (0, express_validator_1.body)('notes').optional().isString().isLength({ max: 500 })
], handleValidationErrors, security_1.sanitizeInput, (0, security_1.auditLog)('creator.payout.request'), dashboard_controllers_1.creatorDashboardController.requestPayout);
/**
 * Creator Transaction History
 * GET /api/creators/:creatorId/transactions
 */
router.get('/creators/:creatorId/transactions', generalRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'moderator', 'creator']), [
    (0, express_validator_1.param)('creatorId').isUUID().withMessage('Invalid creator ID'),
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('status').optional().isIn(['pending', 'completed', 'failed', 'refunded']),
    (0, express_validator_1.query)('dateFrom').optional().isISO8601(),
    (0, express_validator_1.query)('dateTo').optional().isISO8601()
], handleValidationErrors, (0, security_1.auditLog)('creator.transactions.view'), dashboard_controllers_1.creatorDashboardController.getTransactionHistory);
// ========================================
// FAN DASHBOARD ROUTES
// ========================================
/**
 * Fan Spending Summary
 * GET /api/fans/:fanId/spending-summary
 */
router.get('/fans/:fanId/spending-summary', generalRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'moderator', 'fan']), [
    (0, express_validator_1.param)('fanId').isUUID().withMessage('Invalid fan ID')
], handleValidationErrors, (0, security_1.auditLog)('fan.spending_summary.view'), dashboard_controllers_1.fanDashboardController.getSpendingSummary);
/**
 * Fan Payment Processing
 * POST /api/fans/:fanId/payments
 */
router.post('/fans/:fanId/payments', paymentRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'fan']), [
    (0, express_validator_1.param)('fanId').isUUID().withMessage('Invalid fan ID'),
    (0, express_validator_1.body)('creatorId').isUUID().withMessage('Invalid creator ID'),
    (0, express_validator_1.body)('platform').isString().withMessage('Platform required'),
    (0, express_validator_1.body)('amount').isDecimal({ decimal_digits: '0,2' }).withMessage('Invalid amount'),
    (0, express_validator_1.body)('currency').optional().isISO4217(),
    (0, express_validator_1.body)('paymentMethod').isIn(['card', 'crypto', 'bank', 'wallet', 'apple_pay', 'google_pay']),
    (0, express_validator_1.body)('paymentDetails').isObject().withMessage('Payment details required'),
    (0, express_validator_1.body)('deviceFingerprint').optional().isString(),
    (0, express_validator_1.body)('metadata').optional().isObject()
], handleValidationErrors, security_1.sanitizeInput, (0, security_1.auditLog)('fan.payment.process'), dashboard_controllers_1.fanDashboardController.processPayment);
/**
 * Fan Refund Request
 * POST /api/fans/:fanId/transactions/:transactionId/refund
 */
router.post('/fans/:fanId/transactions/:transactionId/refund', paymentRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'fan']), [
    (0, express_validator_1.param)('fanId').isUUID().withMessage('Invalid fan ID'),
    (0, express_validator_1.param)('transactionId').isUUID().withMessage('Invalid transaction ID'),
    (0, express_validator_1.body)('reason').isString().isLength({ min: 10, max: 500 }).withMessage('Reason required'),
    (0, express_validator_1.body)('reasonDetails').optional().isString().isLength({ max: 1000 }),
    (0, express_validator_1.body)('evidence').optional().isObject()
], handleValidationErrors, security_1.sanitizeInput, (0, security_1.auditLog)('fan.refund.request'), dashboard_controllers_1.fanDashboardController.requestRefund);
// ========================================
// VERIFICATION ROUTES
// ========================================
/**
 * Manual Transaction Verification
 * POST /api/verification/verify-transaction
 */
router.post('/verification/verify-transaction', adminRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'moderator']), [
    (0, express_validator_1.body)('fanId').isUUID().withMessage('Invalid fan ID'),
    (0, express_validator_1.body)('creatorId').isUUID().withMessage('Invalid creator ID'),
    (0, express_validator_1.body)('transactionId').optional().isUUID(),
    (0, express_validator_1.body)('paymentMethod').isIn(['card', 'crypto', 'bank', 'wallet']),
    (0, express_validator_1.body)('platform').isString().withMessage('Platform required'),
    (0, express_validator_1.body)('proof').isObject().withMessage('Proof required'),
    (0, express_validator_1.body)('metadata').optional().isObject()
], handleValidationErrors, security_1.sanitizeInput, (0, security_1.auditLog)('admin.verification.manual'), dashboard_controllers_1.verificationController.verifyTransaction);
/**
 * Get Pending Verifications
 * GET /api/verification/pending
 */
router.get('/verification/pending', generalRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'moderator']), [
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 50 }),
    (0, express_validator_1.query)('platform').optional().isString()
], handleValidationErrors, (0, security_1.auditLog)('admin.verification.pending'), dashboard_controllers_1.verificationController.getPendingVerifications);
// ========================================
// HEALTH & STATUS ROUTES
// ========================================
/**
 * Health Check
 * GET /api/health
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});
/**
 * System Status
 * GET /api/status
 */
router.get('/status', generalRateLimit, security_1.authenticate, (0, security_1.authorize)(['admin', 'moderator']), async (req, res) => {
    try {
        // Check database connection
        const dbStatus = await checkDatabaseStatus();
        // Check Redis connection
        const redisStatus = await checkRedisStatus();
        // Check processor health
        const processorsStatus = await checkProcessorsStatus();
        const overallStatus = dbStatus.healthy && redisStatus.healthy && processorsStatus.healthy
            ? 'healthy'
            : 'degraded';
        res.json({
            success: true,
            status: overallStatus,
            components: {
                database: dbStatus,
                redis: redisStatus,
                processors: processorsStatus
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: 'Status check failed',
            timestamp: new Date().toISOString()
        });
    }
});
// ========================================
// WEBHOOK ROUTES (For processor callbacks)
// ========================================
/**
 * Payment Processor Webhooks
 * POST /api/webhooks/:processor
 */
router.post('/webhooks/:processor', createRateLimit(60 * 1000, 1000, 'Too many webhook requests'), // High limit for webhooks
security_1.validateApiKey, // API key validation for processors
[
    (0, express_validator_1.param)('processor').isIn(['rocketgate', 'segpay', 'ccbill', 'bitpay', 'coinbase']),
    (0, express_validator_1.body)().isObject() // Accept any JSON payload
], handleValidationErrors, async (req, res) => {
    try {
        const { processor } = req.params;
        const webhookData = req.body;
        // TODO: Process webhook based on processor
        // This would integrate with the money orchestrator
        console.log(`Webhook received from ${processor}:`, webhookData);
        // Respond quickly to acknowledge receipt
        res.status(200).json({ received: true });
        // Process webhook asynchronously
        // await processWebhook(processor, webhookData);
    }
    catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================
// 404 handler
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
    });
});
// Global error handler
router.use((err, req, res, next) => {
    console.error('API Error:', err);
    // Don't leak internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(err.status || 500).json({
        success: false,
        error: isDevelopment ? err.message : 'Internal server error',
        code: err.code || 'INTERNAL_ERROR',
        ...(isDevelopment && { stack: err.stack })
    });
});
// ========================================
// HELPER FUNCTIONS
// ========================================
async function checkDatabaseStatus() {
    try {
        const start = Date.now();
        // TODO: Implement actual database ping
        // await database.query('SELECT 1');
        const latency = Date.now() - start;
        return { healthy: true, latency };
    }
    catch (error) {
        return { healthy: false, error: error.message };
    }
}
async function checkRedisStatus() {
    try {
        const start = Date.now();
        // TODO: Implement actual Redis ping
        // await redis.ping();
        const latency = Date.now() - start;
        return { healthy: true, latency };
    }
    catch (error) {
        return { healthy: false, error: error.message };
    }
}
async function checkProcessorsStatus() {
    try {
        // TODO: Implement processor health checks
        return { healthy: true, details: { rocketgate: 'healthy', segpay: 'healthy' } };
    }
    catch (error) {
        return { healthy: false, error: error.message };
    }
}
exports.default = router;
//# sourceMappingURL=api.js.map