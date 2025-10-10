import express from 'express';
import FanzTaxService from '../services/fanzTaxService.js';
import authMiddleware from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';
import { validateTIN, sanitizeAmount, validateTaxYear } from '../utils/taxValidation.js';
import logger from '../config/logger.js';
import rateLimit from 'express-rate-limit';

// Rate limiting for sensitive endpoints
const taxRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Allow higher rate for webhooks
  message: {
    success: false,
    error: 'Webhook rate limit exceeded'
  },
  skip: (req) => {
    // Skip rate limiting for valid webhook signatures
    const signature = req.get('x-webhook-signature') || req.get('x-hub-signature-256');
    return Boolean(signature); // Only skip if signature present (will be validated later)
  }
});

// Security helper function
const verifyCreatorAccess = (req, creatorId) => {
  if (!req.user) {
    throw new Error('User not authenticated');
  }
  
  if (req.user.role === 'admin') {
    return true; // Admins have access to all creator data
  }
  
  if (req.user.userId !== creatorId) {
    throw new Error('Access denied: insufficient permissions');
  }
  
  return true;
};

// Input sanitization helper
const sanitizeString = (str, maxLength = 255) => {
  if (typeof str !== 'string') return null;
  return str.trim().substring(0, maxLength);
};

const router = express.Router();
const fanzTaxService = new FanzTaxService();

// Initialize webhook processing for all FANZ-compliant processors
const SUPPORTED_PROCESSORS = Object.keys(fanzTaxService.supportedProcessors);

/**
 * Webhook Routes - Process payout data from payment processors
 * These routes handle incoming webhooks from all FANZ-compliant gateways
 */

// Dynamic webhook routes for all supported processors
SUPPORTED_PROCESSORS.forEach(processorId => {
  router.post(`/webhooks/${processorId}`, [
    webhookRateLimit,
    // Webhook signature validation middleware
    body().custom((value, { req }) => {
      const signature = req.get('x-webhook-signature') || req.get('x-hub-signature-256');
      const timestamp = req.get('x-webhook-timestamp');
      
      if (!signature) {
        throw new Error('Missing webhook signature');
      }
      
      if (!timestamp) {
        throw new Error('Missing webhook timestamp');
      }
      
      // Check timestamp to prevent replay attacks (within 5 minutes)
      const webhookTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTime - webhookTime);
      
      if (timeDiff > 300) { // 5 minutes
        throw new Error('Webhook timestamp too old');
      }
      
      // Get webhook secret for this processor
      const webhookSecret = process.env[`WEBHOOK_SECRET_${processorId.toUpperCase()}`] || 
                           process.env.WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        throw new Error('Webhook secret not configured');
      }
      
      // Verify HMAC signature
      const crypto = await import('crypto');
      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto.createHmac('sha256', webhookSecret)
        .update(timestamp + payload)
        .digest('hex');
      
      const receivedSignature = signature.replace(/^(sha256=|whsec_)/, '');
      
      // Use timing-safe comparison
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const receivedBuffer = Buffer.from(receivedSignature, 'hex');
      
      if (expectedBuffer.length !== receivedBuffer.length) {
        throw new Error('Invalid webhook signature');
      }
      
      if (!crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
        throw new Error('Invalid webhook signature');
      }
      
      return true;
    })
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(`Invalid webhook signature from ${processorId}`, {
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook signature'
        });
      }

      logger.info(`📨 Received webhook from ${processorId}`, {
        processorId,
        contentLength: req.get('content-length'),
        ip: req.ip // Don't log full user agent for privacy
      });

      // Validate processorId to prevent injection
      if (!SUPPORTED_PROCESSORS.includes(processorId)) {
        logger.warn(`Unsupported processor ID: ${processorId}`);
        return res.status(400).json({
          success: false,
          error: 'Unsupported processor'
        });
      }

      // Process the webhook
      const result = await fanzTaxService.processPayoutWebhook(processorId, req.body, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        processed: true,
        processorId,
        message: result?.message || 'Webhook processed successfully'
      });

    } catch (error) {
      logger.error(`❌ Webhook processing failed for ${processorId}:`, {
        error: error.message,
        ip: req.ip,
        processorId
      });
      
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed',
        timestamp: new Date().toISOString()
        // Remove processorId from error response to prevent information disclosure
      });
    }
  });
});

// Generic webhook endpoint for testing - ONLY ENABLE IN DEVELOPMENT
if (process.env.NODE_ENV === 'development') {
  router.post('/webhooks/test', [
    authMiddleware, // Require authentication even for test endpoint
    body().isObject().withMessage('Request body must be an object'),
    // Optional signature validation for test endpoint
    body().custom((value, { req }) => {
      const signature = req.get('x-webhook-signature');
      if (signature && process.env.WEBHOOK_SECRET) {
        const crypto = require('crypto');
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET)
          .update(payload)
          .digest('hex');
        
        const receivedSignature = signature.replace('sha256=', '');
        
        if (!crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(receivedSignature, 'hex'))) {
          throw new Error('Invalid test webhook signature');
        }
      }
      return true;
    })
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      // Don't log the full request body for security
      logger.info('📨 Test webhook received', {
        userId: req.user?.userId,
        bodySize: JSON.stringify(req.body).length
      });
      
      res.json({
        success: true,
        message: 'Test webhook processed successfully',
        // Don't echo back the request body
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('❌ Test webhook failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: 'Test webhook processing failed' // Don't expose internal error details
      });
    }
  });
}

/**
 * Tax Center API Routes - Creator-facing tax management
 */

// Get real-time tax estimates for creator
router.get('/estimates/:creatorId', [
  taxRateLimit,
  authMiddleware,
  param('creatorId').isUUID().withMessage('Creator ID must be a valid UUID'),
  query('taxYear').optional().isInt({ min: 2020, max: new Date().getFullYear() + 1 }).withMessage('Tax year must be valid').toInt(),
  query('quarter').optional().isInt({ min: 1, max: 4 }).withMessage('Quarter must be 1-4').toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { creatorId } = req.params;
    
    try {
      verifyCreatorAccess(req, creatorId);
    } catch (error) {
      logger.warn('Unauthorized access attempt:', {
        userId: req.user?.userId,
        attemptedCreatorId: creatorId,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const estimates = await fanzTaxService.generateRealTimeEstimates(creatorId);

    res.json({
      success: true,
      data: estimates,
      generatedAt: new Date().toISOString()
    });

    } catch (error) {
      logger.error(`Failed to get tax estimates for creator ${creatorId}:`, {
        error: error.message,
        userId: req.user?.userId,
        creatorId
      });
      res.status(500).json({
        success: false,
        error: 'Failed to generate tax estimates'
        // Don't expose internal error details or stack traces
      });
    }
});

// Get AI-powered tax insights for creator
router.get('/insights/:creatorId', [
  taxRateLimit,
  authMiddleware,
  param('creatorId').isUUID().withMessage('Creator ID must be a valid UUID'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1-50').toInt(),
  query('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { creatorId } = req.params;
    
    try {
      verifyCreatorAccess(req, creatorId);
    } catch (error) {
      logger.warn('Unauthorized access attempt:', {
        userId: req.user?.userId,
        attemptedCreatorId: creatorId,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const insights = await fanzTaxService.generateTaxInsights(creatorId);

    res.json({
      success: true,
      data: {
        insights,
        totalInsights: insights.length,
        highPriorityCount: insights.filter(i => i.priority === 'high').length
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    const { creatorId } = req.params;
    logger.error(`Failed to get tax insights for creator ${creatorId}:`, {
      error: error.message,
      userId: req.user?.userId,
      creatorId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate tax insights'
      // Don't expose internal error details or stack traces
    });
  }
});

// Get Tax Vault optimization strategy
router.get('/tax-vault/:creatorId', [
  taxRateLimit,
  authMiddleware,
  param('creatorId').isUUID().withMessage('Creator ID must be a valid UUID'),
  query('strategy').optional().isIn(['aggressive', 'moderate', 'conservative']).withMessage('Strategy must be aggressive, moderate, or conservative')
], async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    try {
      verifyCreatorAccess(req, creatorId);
    } catch (error) {
      logger.warn('Unauthorized access attempt:', {
        userId: req.user?.userId,
        attemptedCreatorId: creatorId,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const strategy = await fanzTaxService.optimizeTaxVaultStrategy(creatorId);

    res.json({
      success: true,
      data: strategy
    });

  } catch (error) {
    const { creatorId } = req.params;
    logger.error(`Failed to get Tax Vault strategy for creator ${creatorId}:`, {
      error: error.message,
      userId: req.user?.userId,
      creatorId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to optimize Tax Vault strategy'
      // Don't expose internal error details or stack traces
    });
  }
});

// Calculate tax implications for a specific payout
router.post('/calculate-implications', [
  taxRateLimit,
  authMiddleware,
  body('payoutData').isObject().withMessage('Payout data must be an object'),
  body('payoutData.creatorId').isUUID().withMessage('Creator ID must be a valid UUID'),
  body('payoutData.amount').isFloat({ min: 0.01, max: 999999999 }).withMessage('Amount must be a positive number under $1B').toFloat(),
  body('payoutData.currency').isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD']).withMessage('Invalid currency code').trim().toUpperCase(),
  body('payoutData.processor').optional().isIn(SUPPORTED_PROCESSORS).withMessage('Invalid processor'),
  body('payoutData.taxYear').optional().isInt({ min: 2020, max: new Date().getFullYear() + 1 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { payoutData } = req.body;
    
    try {
      verifyCreatorAccess(req, payoutData.creatorId);
    } catch (error) {
      logger.warn('Unauthorized access attempt:', {
        userId: req.user?.userId,
        attemptedCreatorId: payoutData.creatorId,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Sanitize amount
    const sanitizedAmount = sanitizeAmount(payoutData.amount);
    if (sanitizedAmount === null) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount format'
      });
    }

    // Normalize payout data for calculation
    const normalizedPayout = {
      ...payoutData,
      amount: sanitizedAmount,
      netAmount: sanitizedAmount * 0.95, // Assume 5% fees if not provided
      payoutDate: new Date(),
      taxYear: new Date().getFullYear()
    };

    const implications = await fanzTaxService.calculateTaxImplications(normalizedPayout);

    res.json({
      success: true,
      data: implications
    });

  } catch (error) {
    logger.error('Failed to calculate tax implications:', {
      error: error.message,
      userId: req.user?.userId,
      creatorId: req.body?.payoutData?.creatorId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to calculate tax implications'
      // Don't expose internal error details or stack traces
    });
  }
});

// Get supported payment processors
router.get('/processors', authMiddleware, async (req, res) => {
  try {
    const processors = Object.entries(fanzTaxService.supportedProcessors).map(([id, config]) => ({
      id,
      name: config.name,
      countries: config.countries,
      cryptoProcessor: config.cryptoProcessor || false,
      payoutProcessor: config.payoutProcessor || false,
      eFileSupported: config.eFileSupported || false
    }));

    res.json({
      success: true,
      data: {
        processors,
        totalCount: processors.length,
        cryptoCount: processors.filter(p => p.cryptoProcessor).length,
        payoutCount: processors.filter(p => p.payoutProcessor).length
      }
    });

  } catch (error) {
    logger.error('Failed to get supported processors:', {
      error: error.message,
      userId: req.user?.userId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get processor information'
      // Don't expose internal error details or stack traces
    });
  }
});

// Get supported tax jurisdictions
router.get('/jurisdictions', async (req, res) => {
  try {
    const jurisdictions = Object.entries(fanzTaxService.taxRates).map(([code, rates]) => ({
      code,
      name: fanzTaxService.getJurisdictionName(code),
      quarterly: rates.quarterly || false,
      thresholds: rates.thresholds || {},
      features: {
        autoWithholding: code === 'US',
        eFileSupported: ['US', 'CA'].includes(code),
        realTimeEstimates: true
      }
    }));

    res.json({
      success: true,
      data: {
        jurisdictions,
        supported: jurisdictions.length
      }
    });

  } catch (error) {
    logger.error('Failed to get supported jurisdictions:', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get jurisdiction information'
      // Don't expose internal error details or stack traces
    });
  }
});

/**
 * Tax Profile Management Routes
 */

// Validate TIN for a specific jurisdiction
router.post('/validate-tin', [
  taxRateLimit,
  authMiddleware,
  body('tin').isString().trim().isLength({ min: 9, max: 15 }).withMessage('TIN must be 9-15 characters').matches(/^[A-Z0-9\-]+$/).withMessage('TIN contains invalid characters'),
  body('jurisdiction').isIn(['US', 'CA', 'UK', 'EU', 'AU']).withMessage('Invalid jurisdiction code').trim().toUpperCase()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { tin, jurisdiction } = req.body;
    const validation = validateTIN(tin, jurisdiction);

    // Don't return the normalized TIN in the response for security
    const response = {
      isValid: validation.isValid,
      tinType: validation.tinType,
      jurisdiction
    };

    if (!validation.isValid) {
      response.error = validation.error;
    }

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('TIN validation failed:', {
      error: error.message,
      userId: req.user?.userId,
      jurisdiction: req.body?.jurisdiction
    });
    res.status(500).json({
      success: false,
      error: 'TIN validation failed'
      // Don't expose internal error details or stack traces
    });
  }
});

// Get tax year summary for creator
router.get('/summary/:creatorId/:taxYear', [
  taxRateLimit,
  authMiddleware,
  param('creatorId').isUUID().withMessage('Creator ID must be a valid UUID'),
  param('taxYear').isInt({ min: 2020, max: new Date().getFullYear() + 1 }).withMessage('Tax year must be valid').toInt(),
  query('includeEstimates').optional().isBoolean().withMessage('Include estimates must be boolean').toBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { creatorId, taxYear } = req.params;
    
    // Verify access
    if (req.user.userId !== creatorId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const taxYearNum = parseInt(taxYear);
    
    // Get YTD payouts for the specified tax year
    const payouts = await fanzTaxService.getYtdPayouts(creatorId, taxYearNum);
    
    // Calculate summary
    const summary = {
      creatorId,
      taxYear: taxYearNum,
      totalPayouts: payouts.length,
      grossIncome: payouts.reduce((sum, p) => sum + p.amount, 0),
      netIncome: payouts.reduce((sum, p) => sum + p.netAmount, 0),
      totalFees: payouts.reduce((sum, p) => sum + p.fees, 0),
      processorBreakdown: fanzTaxService.calculateProcessorBreakdown(payouts),
      sourceBreakdown: payouts.reduce((breakdown, payout) => {
        breakdown[payout.source] = (breakdown[payout.source] || 0) + payout.netAmount;
        return breakdown;
      }, {})
    };

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error(`Failed to get tax summary for creator ${req.params.creatorId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tax summary'
    });
  }
});

/**
 * Tax Document Routes
 */

// Generate 1099 forms for a creator and tax year
router.post('/generate-1099', [
  authMiddleware,
  body('creatorId').isString().notEmpty(),
  body('taxYear').isInt({ min: 2020, max: 2030 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { creatorId, taxYear } = req.body;
    
    // Verify access (admin only for generating tax forms)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required for form generation'
      });
    }

    // TODO: Implement 1099 form generation
    // This would integrate with the actual form generation service
    const mockFormData = {
      formId: `1099-${creatorId}-${taxYear}`,
      creatorId,
      taxYear,
      formType: '1099-NEC',
      status: 'generated',
      generatedAt: new Date().toISOString(),
      downloadUrl: `/api/tax/forms/download/1099-${creatorId}-${taxYear}.pdf`
    };

    res.json({
      success: true,
      data: mockFormData
    });

  } catch (error) {
    logger.error('1099 generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate 1099 form'
    });
  }
});

/**
 * Admin Routes - Tax Operations Dashboard
 */

// Get tax processing statistics
router.get('/admin/statistics', [
  authMiddleware
], async (req, res) => {
  try {
    // Verify admin access
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { period = '30d' } = req.query;
    
    // TODO: Implement actual statistics gathering
    const mockStats = {
      period,
      generatedAt: new Date().toISOString(),
      payoutProcessing: {
        totalProcessed: 1247,
        successRate: 99.2,
        averageProcessingTime: 1.3, // seconds
        failureRate: 0.8
      },
      taxCalculations: {
        totalCalculations: 1247,
        averageCalculationTime: 0.5, // seconds
        jurisdictionBreakdown: {
          'US': 856,
          'CA': 201,
          'UK': 98,
          'EU': 67,
          'AU': 25
        }
      },
      complianceMetrics: {
        tinMatchSuccessRate: 96.5,
        formsGenerated: 45,
        eFilingSuccessRate: 98.9,
        correctionRate: 1.2
      },
      aiInsights: {
        totalInsightsGenerated: 892,
        highPriorityInsights: 67,
        avgInsightsPerCreator: 2.3,
        actionTakenRate: 34.5
      }
    };

    res.json({
      success: true,
      data: mockStats
    });

  } catch (error) {
    logger.error('Failed to get tax statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

// Get failed payout processing queue
router.get('/admin/failed-payouts', [
  authMiddleware,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    // Verify admin access
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // TODO: Implement actual failed payout queue
    const mockFailedPayouts = {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        pages: 0
      }
    };

    res.json({
      success: true,
      data: mockFailedPayouts
    });

  } catch (error) {
    logger.error('Failed to get failed payouts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get failed payouts'
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'FANZ Tax Service',
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    supportedProcessors: SUPPORTED_PROCESSORS.length,
    supportedJurisdictions: Object.keys(fanzTaxService.taxRates).length
  });
});

// Error handling middleware for tax routes
router.use((error, req, res, next) => {
  logger.error('FANZ Tax API error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    service: 'FANZ Tax Service',
    timestamp: new Date().toISOString()
  });
});

export default router;