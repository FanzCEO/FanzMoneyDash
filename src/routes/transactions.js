import express from 'express';
import { query, body, param, validationResult } from 'express-validator';
import authMiddleware from '../middleware/auth.js';
import logger from '../config/logger.js';
import { rateLimitConfig } from '../config/security.js';

const router = express.Router();

// Apply authentication middleware to all transaction routes
router.use(authMiddleware);

// Apply rate limiting to all transaction endpoints
router.use(rateLimitConfig.payment);

// Security helper to verify user access to transaction data
const verifyTransactionAccess = (req, userId) => {
  if (!req.user) {
    throw new Error('User not authenticated');
  }
  
  // Admins can access all transactions
  if (req.user.role === 'admin') {
    return true;
  }
  
  // Users can only access their own transactions
  if (req.user.userId !== userId) {
    throw new Error('Access denied: insufficient permissions');
  }
  
  return true;
};

// Get transaction history for authenticated user
router.get('/history', [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  query('type')
    .optional()
    .isIn(['payment', 'refund', 'withdrawal', 'deposit', 'fee'])
    .withMessage('Invalid transaction type'),
  query('status')
    .optional()
    .isIn(['pending', 'completed', 'failed', 'cancelled'])
    .withMessage('Invalid transaction status'),
  query('fromDate')
    .optional()
    .isISO8601()
    .withMessage('From date must be ISO 8601 format'),
  query('toDate')
    .optional()
    .isISO8601()
    .withMessage('To date must be ISO 8601 format')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { page = 1, limit = 20, userId, type, status, fromDate, toDate } = req.query;
    
    // Determine whose transactions to fetch
    const targetUserId = userId || req.user.userId;
    
    try {
      verifyTransactionAccess(req, targetUserId);
    } catch (error) {
      logger.warn('Unauthorized transaction history access attempt', {
        userId: req.user?.userId,
        attemptedUserId: targetUserId,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    logger.info('Transaction history accessed', {
      userId: req.user.userId,
      targetUserId,
      page,
      limit,
      filters: { type, status, fromDate, toDate },
      ip: req.ip
    });

    // TODO: Replace with actual database query
    // This is mock data - in production, query from actual transaction database
    const mockTransactions = [
      {
        id: 'txn_' + Date.now(),
        userId: targetUserId,
        type: type || 'payment',
        amount: 100.00,
        currency: 'USD',
        status: status || 'completed',
        description: 'Creator subscription payment',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    res.json({
      success: true,
      data: {
        transactions: mockTransactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(mockTransactions.length / limit),
          totalCount: mockTransactions.length,
          hasNextPage: false,
          hasPreviousPage: page > 1
        },
        filters: {
          userId: targetUserId,
          type,
          status,
          fromDate,
          toDate
        }
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Transaction history error', {
      error: error.message,
      userId: req.user?.userId,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction history'
      // Don't expose internal error details
    });
  }
});

// Get specific transaction by ID
router.get('/transaction/:transactionId', [
  param('transactionId')
    .isString()
    .matches(/^txn_[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid transaction ID format')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { transactionId } = req.params;

    // TODO: Replace with actual database query
    // Mock transaction data
    const mockTransaction = {
      id: transactionId,
      userId: req.user.userId, // Assume this transaction belongs to current user
      type: 'payment',
      amount: 100.00,
      currency: 'USD',
      status: 'completed',
      description: 'Creator subscription payment',
      metadata: {
        platform: 'boyfanz',
        creatorId: 'creator_123',
        subscriptionType: 'monthly'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      verifyTransactionAccess(req, mockTransaction.userId);
    } catch (error) {
      logger.warn('Unauthorized transaction access attempt', {
        userId: req.user?.userId,
        transactionId,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    logger.info('Transaction accessed', {
      userId: req.user.userId,
      transactionId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        transaction: mockTransaction
      },
      retrievedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Transaction retrieval error', {
      error: error.message,
      userId: req.user?.userId,
      transactionId: req.params.transactionId,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve transaction'
      // Don't expose internal error details
    });
  }
});

// Create new transaction - RESTRICTED TO ADMIN ONLY
router.post('/create', [
  body('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  body('type')
    .isIn(['payment', 'refund', 'withdrawal', 'deposit', 'fee'])
    .withMessage('Invalid transaction type'),
  body('amount')
    .isFloat({ min: 0.01, max: 999999.99 })
    .withMessage('Amount must be between $0.01 and $999,999.99')
    .toFloat(),
  body('currency')
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD'])
    .withMessage('Invalid currency code')
    .trim()
    .toUpperCase(),
  body('description')
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be 1-500 characters')
    .trim(),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Only admins can create transactions directly
    if (req.user.role !== 'admin') {
      logger.warn('Non-admin transaction creation attempt', {
        userId: req.user.userId,
        role: req.user.role,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions. Only administrators can create transactions directly.'
      });
    }

    const { userId, type, amount, currency, description, metadata } = req.body;

    // Generate secure transaction ID
    const transactionId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);

    // TODO: Replace with actual database insert
    const newTransaction = {
      id: transactionId,
      userId,
      type,
      amount: parseFloat(amount.toFixed(2)), // Ensure proper decimal places
      currency,
      description,
      metadata: metadata || {},
      status: 'pending',
      createdBy: req.user.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    logger.info('Transaction created by admin', {
      transactionId,
      userId,
      type,
      amount,
      currency,
      createdBy: req.user.userId,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: {
        transaction: newTransaction
      },
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Transaction creation error', {
      error: error.message,
      userId: req.user?.userId,
      requestBody: req.body,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create transaction'
      // Don't expose internal error details
    });
  }
});

// Get transaction statistics for current user
router.get('/stats', [
  query('period')
    .optional()
    .isIn(['7d', '30d', '90d', '1y', 'all'])
    .withMessage('Invalid period. Use: 7d, 30d, 90d, 1y, or all'),
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { period = '30d', userId } = req.query;
    const targetUserId = userId || req.user.userId;

    try {
      verifyTransactionAccess(req, targetUserId);
    } catch (error) {
      logger.warn('Unauthorized transaction stats access attempt', {
        userId: req.user?.userId,
        attemptedUserId: targetUserId,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // TODO: Replace with actual database aggregation
    const mockStats = {
      totalTransactions: 15,
      totalAmount: 1250.00,
      totalFees: 37.50,
      netAmount: 1212.50,
      currency: 'USD',
      period,
      byType: {
        payment: { count: 12, amount: 1200.00 },
        fee: { count: 3, amount: 50.00 }
      },
      byStatus: {
        completed: { count: 14, amount: 1225.00 },
        pending: { count: 1, amount: 25.00 }
      }
    };

    logger.info('Transaction stats accessed', {
      userId: req.user.userId,
      targetUserId,
      period,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        stats: mockStats,
        userId: targetUserId,
        period
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Transaction stats error', {
      error: error.message,
      userId: req.user?.userId,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve transaction statistics'
      // Don't expose internal error details
    });
  }
});

export default router;
