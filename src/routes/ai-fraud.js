/**
 * FANZ AI Fraud Detection API Routes
 * RESTful endpoints for AI-powered fraud detection and risk assessment
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const { AIFraudDetectionService } = require('../services/ai-fraud-detection');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { auditLogger } = require('../middleware/audit');
const { logger } = require('../utils/logger');

const router = express.Router();

// Initialize AI Fraud Detection Service
const fraudDetectionService = new AIFraudDetectionService();
fraudDetectionService.initialize().catch(err => {
    logger.error('Failed to initialize AI Fraud Detection Service:', err);
});

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const assessmentLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit assessments to 100 per minute per IP
    message: 'Too many fraud assessments from this IP, please try again later'
});

// Apply rate limiting
router.use(apiLimiter);

/**
 * @swagger
 * /api/ai-fraud/assess:
 *   post:
 *     summary: Assess transaction fraud risk using AI
 *     description: Analyze a transaction for fraud risk using machine learning and rule-based detection
 *     tags: [AI Fraud Detection]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *             properties:
 *               transactionId:
 *                 type: string
 *                 description: Unique transaction identifier
 *               includeRecommendations:
 *                 type: boolean
 *                 default: true
 *                 description: Include recommended actions in response
 *               detailedAnalysis:
 *                 type: boolean
 *                 default: false
 *                 description: Include detailed feature analysis
 *     responses:
 *       200:
 *         description: Fraud risk assessment completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FraudAssessment'
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized access
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/assess',
    assessmentLimiter,
    authenticateToken,
    requireRole(['admin', 'security', 'risk_analyst']),
    [
        body('transactionId')
            .isString()
            .notEmpty()
            .withMessage('Transaction ID is required'),
        body('includeRecommendations')
            .optional()
            .isBoolean()
            .withMessage('includeRecommendations must be a boolean'),
        body('detailedAnalysis')
            .optional()
            .isBoolean()
            .withMessage('detailedAnalysis must be a boolean')
    ],
    auditLogger('ai_fraud_assessment'),
    async (req, res) => {
        try {
            // Validate request
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { transactionId, includeRecommendations = true, detailedAnalysis = false } = req.body;

            // Fetch transaction details (this would be from your existing transaction service)
            const transaction = await getTransactionById(transactionId);
            if (!transaction) {
                return res.status(404).json({
                    error: 'Transaction not found',
                    transactionId: transactionId
                });
            }

            // Get user profile for enhanced analysis
            const userProfile = await getUserProfile(transaction.userId);

            // Assess fraud risk
            const assessment = await fraudDetectionService.assessTransactionRisk(
                transaction,
                userProfile,
                {
                    requestedBy: req.user.id,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            );

            // Prepare response
            const response = {
                transactionId: transactionId,
                riskScore: assessment.riskScore,
                riskLevel: assessment.riskLevel,
                timestamp: assessment.timestamp,
                modelVersion: assessment.modelVersion
            };

            if (includeRecommendations) {
                response.recommendations = assessment.recommendations;
            }

            if (detailedAnalysis && req.user.role === 'admin') {
                response.detailedAnalysis = {
                    mlScore: assessment.mlScore,
                    ruleBasedScore: assessment.ruleBasedScore,
                    factors: assessment.factors
                };
            }

            logger.info(`Fraud assessment completed for transaction ${transactionId}`, {
                riskLevel: assessment.riskLevel,
                riskScore: assessment.riskScore,
                userId: req.user.id
            });

            res.json({
                success: true,
                data: response
            });

        } catch (error) {
            logger.error('Failed to assess transaction fraud risk:', error);
            res.status(500).json({
                error: 'Failed to assess fraud risk',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
);

/**
 * @swagger
 * /api/ai-fraud/feedback:
 *   post:
 *     summary: Provide feedback on fraud assessment
 *     description: Submit feedback to improve AI model accuracy through continuous learning
 *     tags: [AI Fraud Detection]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *               - actualOutcome
 *             properties:
 *               transactionId:
 *                 type: string
 *                 description: Transaction identifier
 *               actualOutcome:
 *                 type: string
 *                 enum: [fraud, legitimate]
 *                 description: Actual outcome determined by investigation
 *               confidence:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 description: Confidence level in the assessment (0-1)
 *               notes:
 *                 type: string
 *                 description: Additional notes about the assessment
 *     responses:
 *       200:
 *         description: Feedback submitted successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post('/feedback',
    authenticateToken,
    requireRole(['admin', 'security', 'risk_analyst']),
    [
        body('transactionId')
            .isString()
            .notEmpty()
            .withMessage('Transaction ID is required'),
        body('actualOutcome')
            .isIn(['fraud', 'legitimate'])
            .withMessage('actualOutcome must be either "fraud" or "legitimate"'),
        body('confidence')
            .optional()
            .isFloat({ min: 0, max: 1 })
            .withMessage('confidence must be between 0 and 1'),
        body('notes')
            .optional()
            .isString()
            .isLength({ max: 1000 })
            .withMessage('notes cannot exceed 1000 characters')
    ],
    auditLogger('ai_fraud_feedback'),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { transactionId, actualOutcome, confidence, notes } = req.body;

            // Submit feedback for continuous learning
            await fraudDetectionService.continuousLearning({
                transactionId,
                actualOutcome,
                userFeedback: {
                    confidence,
                    notes,
                    submittedBy: req.user.id,
                    submittedAt: new Date()
                }
            });

            logger.info(`Fraud detection feedback submitted for transaction ${transactionId}`, {
                actualOutcome,
                confidence,
                submittedBy: req.user.id
            });

            res.json({
                success: true,
                message: 'Feedback submitted successfully'
            });

        } catch (error) {
            logger.error('Failed to submit fraud detection feedback:', error);
            res.status(500).json({
                error: 'Failed to submit feedback',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
);

/**
 * @swagger
 * /api/ai-fraud/statistics:
 *   get:
 *     summary: Get fraud detection statistics
 *     description: Retrieve statistics about fraud detection performance and model metrics
 *     tags: [AI Fraud Detection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
 *         description: Time period for statistics
 *       - in: query
 *         name: detailed
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include detailed metrics (admin only)
 *     responses:
 *       200:
 *         description: Fraud detection statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FraudStatistics'
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/statistics',
    authenticateToken,
    requireRole(['admin', 'security', 'risk_analyst']),
    [
        query('period')
            .optional()
            .isIn(['day', 'week', 'month', 'quarter', 'year'])
            .withMessage('Invalid period specified'),
        query('detailed')
            .optional()
            .isBoolean()
            .withMessage('detailed must be a boolean')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { period = 'month', detailed = false } = req.query;

            // Calculate date range
            const dateRange = calculateDateRange(period);

            // Get basic statistics
            const statistics = await getFraudStatistics(dateRange);

            // Add detailed metrics for admin users
            if (detailed && req.user.role === 'admin') {
                statistics.modelMetrics = await getModelMetrics();
                statistics.performanceMetrics = await getPerformanceMetrics(dateRange);
            }

            res.json({
                success: true,
                data: {
                    period,
                    dateRange,
                    statistics
                }
            });

        } catch (error) {
            logger.error('Failed to get fraud detection statistics:', error);
            res.status(500).json({
                error: 'Failed to get statistics',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
);

/**
 * @swagger
 * /api/ai-fraud/model/retrain:
 *   post:
 *     summary: Trigger model retraining
 *     description: Manually trigger AI model retraining (admin only)
 *     tags: [AI Fraud Detection]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Model retraining initiated
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/model/retrain',
    authenticateToken,
    requireRole(['admin']),
    auditLogger('ai_model_retrain'),
    async (req, res) => {
        try {
            // Trigger model retraining in the background
            setImmediate(async () => {
                try {
                    await fraudDetectionService.retrainModel();
                    logger.info('AI fraud detection model retraining completed', {
                        triggeredBy: req.user.id
                    });
                } catch (error) {
                    logger.error('AI fraud detection model retraining failed:', error);
                }
            });

            res.json({
                success: true,
                message: 'Model retraining initiated'
            });

        } catch (error) {
            logger.error('Failed to trigger model retraining:', error);
            res.status(500).json({
                error: 'Failed to trigger retraining',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
);

// Helper functions (these would typically be in separate service files)

async function getTransactionById(transactionId) {
    // This would fetch from your existing transaction service
    // Placeholder implementation
    return {
        id: transactionId,
        amount: 1000,
        userId: 'user123',
        paymentMethod: 'credit_card',
        createdAt: new Date(),
        status: 'pending'
    };
}

async function getUserProfile(userId) {
    // This would fetch from your existing user service
    // Placeholder implementation
    return {
        id: userId,
        accountAge: 365,
        transactionCount: 50,
        averageTransactionAmount: 500,
        isVerified: true,
        riskScore: 0.2
    };
}

function calculateDateRange(period) {
    const now = new Date();
    const ranges = {
        day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        quarter: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    };

    return {
        start: ranges[period],
        end: now
    };
}

async function getFraudStatistics(dateRange) {
    // Placeholder implementation - would query your database
    return {
        totalAssessments: 1250,
        fraudDetected: 45,
        fraudPrevented: 42,
        falsePositives: 8,
        falseNegatives: 3,
        accuracyRate: 0.94,
        avgRiskScore: 0.23,
        topRiskFactors: [
            'High transaction amount',
            'Unusual geographic location',
            'New device'
        ]
    };
}

async function getModelMetrics() {
    // Placeholder implementation
    return {
        version: '1.2.0',
        accuracy: 0.94,
        precision: 0.91,
        recall: 0.89,
        f1Score: 0.90,
        lastTraining: new Date('2024-01-15'),
        trainingDataSize: 50000
    };
}

async function getPerformanceMetrics(dateRange) {
    // Placeholder implementation
    return {
        avgProcessingTime: 145, // milliseconds
        throughput: 850, // assessments per minute
        errorRate: 0.002,
        uptime: 0.999
    };
}

module.exports = router;