/**
 * FanzMoneyDash API Routes
 * RESTful endpoints for all FANZ dashboard integrations
 * Provides secure, rate-limited APIs for financial operations
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

// Import controllers
import {
  adminDashboardController,
  creatorDashboardController,
  fanDashboardController,
  verificationController
} from '../controllers/dashboard-controllers';

// Import middleware
import { 
  authenticate, 
  authorize, 
  auditLog,
  validateApiKey,
  sanitizeInput 
} from '../middleware/security';

const router = Router();

// ========================================
// SECURITY MIDDLEWARE
// ========================================

// Security headers
router.use(helmet({
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
    /^https:\/\/.*\.fanz\.network$/,  // Allow all fanz.network subdomains
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Platform-ID'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

router.use(cors(corsOptions));

// Rate limiting by endpoint type
const createRateLimit = (windowMs: number, max: number, message: string) => 
  rateLimit({
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
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
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
router.get('/admin/financial-overview',
  adminRateLimit,
  authenticate,
  authorize(['admin', 'moderator']),
  [
    query('timeframe').optional().isIn(['1d', '7d', '30d', '90d', '1y']),
    query('platforms').optional().isString()
  ],
  handleValidationErrors,
  // // auditLog - TODO: Implement proper audit logging // TODO: Implement proper audit logging
  adminDashboardController.getFinancialOverview
);

/**
 * Settlement Reports
 * GET /api/admin/settlements
 */
router.get('/admin/settlements',
  adminRateLimit,
  authenticate,
  authorize(['admin', 'moderator']),
  [
    query('dateFrom').isISO8601().withMessage('Invalid dateFrom format'),
    query('dateTo').isISO8601().withMessage('Invalid dateTo format'),
    query('processors').optional().isString()
  ],
  handleValidationErrors,
  // auditLog - TODO: Implement proper audit logging
  adminDashboardController.getSettlementReports
);

/**
 * Transaction Monitoring
 * GET /api/admin/transactions/monitor
 */
router.get('/admin/transactions/monitor',
  adminRateLimit,
  authenticate,
  authorize(['admin', 'moderator', 'support']),
  [
    query('status').optional().isIn(['pending', 'completed', 'failed', 'requires_verification']),
    query('processor').optional().isString(),
    query('platform').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  // auditLog - TODO: Implement proper audit logging
  adminDashboardController.getTransactionMonitoring
);

/**
 * Dispute Management
 * PUT /api/admin/disputes/:disputeId
 */
router.put('/admin/disputes/:disputeId',
  adminRateLimit,
  authenticate,
  authorize(['admin', 'moderator']),
  [
    param('disputeId').isUUID().withMessage('Invalid dispute ID'),
    body('action').isIn(['accept', 'fight', 'settle']).withMessage('Invalid action'),
    body('notes').optional().isString().isLength({ max: 1000 }),
    body('evidence').optional().isObject()
  ],
  handleValidationErrors,
  sanitizeInput,
  // auditLog - TODO: Implement proper audit logging
  adminDashboardController.manageDispute
);

/**
 * Refund Approval
 * POST /api/admin/approvals/:approvalId/process
 */
router.post('/admin/approvals/:approvalId/process',
  adminRateLimit,
  authenticate,
  authorize(['admin', 'moderator']),
  [
    param('approvalId').isUUID().withMessage('Invalid approval ID'),
    body('action').isIn(['approve', 'reject']).withMessage('Invalid action'),
    body('reason').isString().isLength({ min: 10, max: 500 }),
    body('notes').optional().isString().isLength({ max: 1000 })
  ],
  handleValidationErrors,
  sanitizeInput,
  // auditLog - TODO: Implement proper audit logging
  adminDashboardController.processRefundApproval
);

// ========================================
// CREATOR DASHBOARD ROUTES
// ========================================

/**
 * Creator Financial Summary
 * GET /api/creators/:creatorId/financial-summary
 */
router.get('/creators/:creatorId/financial-summary',
  generalRateLimit,
  authenticate,
  authorize(['admin', 'moderator', 'creator']),
  [
    param('creatorId').isUUID().withMessage('Invalid creator ID')
  ],
  handleValidationErrors,
  // auditLog - TODO: Implement proper audit logging
  creatorDashboardController.getFinancialSummary
);

/**
 * Creator Payout Request
 * POST /api/creators/:creatorId/payouts
 */
router.post('/creators/:creatorId/payouts',
  paymentRateLimit,
  authenticate,
  authorize(['admin', 'creator']),
  [
    param('creatorId').isUUID().withMessage('Invalid creator ID'),
    body('amount').isDecimal({ decimal_digits: '0,2' }).withMessage('Invalid amount'),
    body('currency').isISO4217().withMessage('Invalid currency code'),
    body('payoutMethod').isIn(['paxum', 'wise', 'payoneer', 'crypto', 'ach', 'wire']),
    body('payoutDetails').isObject().withMessage('Payout details required'),
    body('scheduleType').optional().isIn(['instant', 'daily', 'weekly', 'manual']),
    body('platform').optional().isString(),
    body('notes').optional().isString().isLength({ max: 500 })
  ],
  handleValidationErrors,
  sanitizeInput,
  // auditLog - TODO: Implement proper audit logging
  creatorDashboardController.requestPayout
);

/**
 * Creator Transaction History
 * GET /api/creators/:creatorId/transactions
 */
router.get('/creators/:creatorId/transactions',
  generalRateLimit,
  authenticate,
  authorize(['admin', 'moderator', 'creator']),
  [
    param('creatorId').isUUID().withMessage('Invalid creator ID'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'completed', 'failed', 'refunded']),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601()
  ],
  handleValidationErrors,
  // auditLog - TODO: Implement proper audit logging
  creatorDashboardController.getTransactionHistory
);

// ========================================
// FAN DASHBOARD ROUTES
// ========================================

/**
 * Fan Spending Summary
 * GET /api/fans/:fanId/spending-summary
 */
router.get('/fans/:fanId/spending-summary',
  generalRateLimit,
  authenticate,
  authorize(['admin', 'moderator', 'fan']),
  [
    param('fanId').isUUID().withMessage('Invalid fan ID')
  ],
  handleValidationErrors,
  // auditLog - TODO: Implement proper audit logging
  fanDashboardController.getSpendingSummary
);

/**
 * Fan Payment Processing
 * POST /api/fans/:fanId/payments
 */
router.post('/fans/:fanId/payments',
  paymentRateLimit,
  authenticate,
  authorize(['admin', 'fan']),
  [
    param('fanId').isUUID().withMessage('Invalid fan ID'),
    body('creatorId').isUUID().withMessage('Invalid creator ID'),
    body('platform').isString().withMessage('Platform required'),
    body('amount').isDecimal({ decimal_digits: '0,2' }).withMessage('Invalid amount'),
    body('currency').optional().isISO4217(),
    body('paymentMethod').isIn(['card', 'crypto', 'bank', 'wallet', 'apple_pay', 'google_pay']),
    body('paymentDetails').isObject().withMessage('Payment details required'),
    body('deviceFingerprint').optional().isString(),
    body('metadata').optional().isObject()
  ],
  handleValidationErrors,
  sanitizeInput,
  // auditLog - TODO: Implement proper audit logging
  fanDashboardController.processPayment
);

/**
 * Fan Refund Request
 * POST /api/fans/:fanId/transactions/:transactionId/refund
 */
router.post('/fans/:fanId/transactions/:transactionId/refund',
  paymentRateLimit,
  authenticate,
  authorize(['admin', 'fan']),
  [
    param('fanId').isUUID().withMessage('Invalid fan ID'),
    param('transactionId').isUUID().withMessage('Invalid transaction ID'),
    body('reason').isString().isLength({ min: 10, max: 500 }).withMessage('Reason required'),
    body('reasonDetails').optional().isString().isLength({ max: 1000 }),
    body('evidence').optional().isObject()
  ],
  handleValidationErrors,
  sanitizeInput,
  // auditLog - TODO: Implement proper audit logging
  fanDashboardController.requestRefund
);

// ========================================
// VERIFICATION ROUTES
// ========================================

/**
 * Manual Transaction Verification
 * POST /api/verification/verify-transaction
 */
router.post('/verification/verify-transaction',
  adminRateLimit,
  authenticate,
  authorize(['admin', 'moderator']),
  [
    body('fanId').isUUID().withMessage('Invalid fan ID'),
    body('creatorId').isUUID().withMessage('Invalid creator ID'),
    body('transactionId').optional().isUUID(),
    body('paymentMethod').isIn(['card', 'crypto', 'bank', 'wallet']),
    body('platform').isString().withMessage('Platform required'),
    body('proof').isObject().withMessage('Proof required'),
    body('metadata').optional().isObject()
  ],
  handleValidationErrors,
  sanitizeInput,
  // auditLog - TODO: Implement proper audit logging
  verificationController.verifyTransaction
);

/**
 * Get Pending Verifications
 * GET /api/verification/pending
 */
router.get('/verification/pending',
  generalRateLimit,
  authenticate,
  authorize(['admin', 'moderator']),
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('platform').optional().isString()
  ],
  handleValidationErrors,
  // auditLog - TODO: Implement proper audit logging
  verificationController.getPendingVerifications
);

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
router.get('/status',
  generalRateLimit,
  authenticate,
  authorize(['admin', 'moderator']),
  async (req, res) => {
    try {
      // Check database connection
      const dbStatus = await checkDatabaseStatus();
      
      // Check Redis connection
      const redisStatus = await checkRedisStatus();
      
      // Check processor health
      const processorsStatus = await checkProcessorsStatus();

      const overallStatus = 
        dbStatus.healthy && redisStatus.healthy && processorsStatus.healthy 
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

    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Status check failed',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// ========================================
// WEBHOOK ROUTES (For processor callbacks)
// ========================================

/**
 * Payment Processor Webhooks
 * POST /api/webhooks/:processor
 */
router.post('/webhooks/:processor',
  createRateLimit(60 * 1000, 1000, 'Too many webhook requests'), // High limit for webhooks
  validateApiKey, // API key validation for processors
  [
    param('processor').isIn(['rocketgate', 'segpay', 'ccbill', 'bitpay', 'coinbase']),
    body().isObject() // Accept any JSON payload
  ],
  handleValidationErrors,
  async (req, res) => {
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

    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

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
router.use((err: any, req: any, res: any, next: any) => {
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

async function checkDatabaseStatus(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  try {
    const start = Date.now();
    // TODO: Implement actual database ping
    // await database.query('SELECT 1');
    const latency = Date.now() - start;
    
    return { healthy: true, latency };
  } catch (error) {
    return { healthy: false, error: (error as Error).message };
  }
}

async function checkRedisStatus(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  try {
    const start = Date.now();
    // TODO: Implement actual Redis ping
    // await redis.ping();
    const latency = Date.now() - start;
    
    return { healthy: true, latency };
  } catch (error) {
    return { healthy: false, error: (error as Error).message };
  }
}

async function checkProcessorsStatus(): Promise<{ healthy: boolean; details?: any; error?: string }> {
  try {
    // TODO: Implement processor health checks
    return { healthy: true, details: { rocketgate: 'healthy', segpay: 'healthy' } };
  } catch (error) {
    return { healthy: false, error: (error as Error).message };
  }
}

export default router;