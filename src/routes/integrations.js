/**
 * FANZ Integration Routes
 * Handles webhooks and API endpoints for ecosystem integration
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { processFanzDashWebhook, processPlatformWebhook } from '../integrations/webhook-handler.js';
import { 
  checkEcosystemHealth, 
  syncUserWithEcosystem, 
  getUserPermissions,
  syncEarnings 
} from '../integrations/fanz-ecosystem.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAudit, logError } from '../config/logger.js';

const router = express.Router();

// Rate limiting for webhook endpoints
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // max 100 requests per minute per IP
  message: {
    error: 'Too many webhook requests, please try again later',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logError(new Error('Rate limit exceeded for webhook'), {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path
    });
    res.status(429).json({
      error: 'Too many webhook requests, please try again later',
      retryAfter: 60
    });
  }
});

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // max 1000 requests per 15 minutes per IP
  message: {
    error: 'Too many API requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @swagger
 * components:
 *   schemas:
 *     WebhookPayload:
 *       type: object
 *       required:
 *         - event
 *         - data
 *         - timestamp
 *       properties:
 *         event:
 *           type: string
 *           description: Type of event
 *         data:
 *           type: object
 *           description: Event payload
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Event timestamp
 *         source:
 *           type: string
 *           description: Source system
 */

/**
 * @swagger
 * /api/integrations/webhooks/fanzdash:
 *   post:
 *     summary: Receive webhook from FanzDash
 *     tags: [Integrations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebhookPayload'
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: processed
 *       401:
 *         description: Invalid signature
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Processing failed
 */
router.post('/webhooks/fanzdash', webhookLimiter, processFanzDashWebhook);

/**
 * @swagger
 * /api/integrations/webhooks/{platform}:
 *   post:
 *     summary: Receive webhook from FANZ platform
 *     tags: [Integrations]
 *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [boyfanz, girlfanz, pupfanz, daddiesfanz, cougarfanz, taboofanz]
 *         description: Platform name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebhookPayload'
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: processed
 *       401:
 *         description: Invalid signature
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Processing failed
 */
router.post('/webhooks/:platform', webhookLimiter, processPlatformWebhook);

/**
 * @swagger
 * /api/integrations/health:
 *   get:
 *     summary: Check health of all integrated services
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health check results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fanzdash:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, unhealthy]
 *                     responseTime:
 *                       type: string
 *                     statusCode:
 *                       type: number
 *                 sso:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, unhealthy]
 *                     responseTime:
 *                       type: string
 *                     statusCode:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Health check failed
 */
router.get('/health', apiLimiter, authenticateToken, async (req, res) => {
  try {
    const healthResults = await checkEcosystemHealth();
    
    logAudit('ecosystem_health_check', {
      userId: req.user?.id,
      results: Object.keys(healthResults).reduce((acc, service) => {
        acc[service] = healthResults[service].status;
        return acc;
      }, {})
    });

    res.json(healthResults);
  } catch (error) {
    logError(error, { context: 'ecosystem_health_check', userId: req.user?.id });
    res.status(500).json({ error: 'Health check failed' });
  }
});

/**
 * @swagger
 * /api/integrations/sync/user:
 *   post:
 *     summary: Sync user data with ecosystem
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - username
 *               - email
 *               - role
 *             properties:
 *               id:
 *                 type: string
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [creator, fan, admin, moderator]
 *               status:
 *                 type: string
 *                 enum: [active, suspended, locked]
 *     responses:
 *       200:
 *         description: User synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 syncId:
 *                   type: string
 *       400:
 *         description: Invalid user data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Sync failed
 */
router.post('/sync/user', apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { id, username, email, role, status } = req.body;
    
    if (!id || !username || !email || !role) {
      return res.status(400).json({ error: 'Missing required user fields' });
    }

    const validRoles = ['creator', 'fan', 'admin', 'moderator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const userData = {
      id,
      username,
      email,
      role,
      status: status || 'active'
    };

    const result = await syncUserWithEcosystem(userData);
    
    logAudit('user_sync_requested', {
      userId: req.user?.id,
      targetUserId: id,
      role
    });

    res.json({
      success: true,
      syncId: result.syncId || 'sync-' + Date.now()
    });
  } catch (error) {
    logError(error, { context: 'user_sync_api', userId: req.user?.id });
    res.status(500).json({ error: 'Sync failed' });
  }
});

/**
 * @swagger
 * /api/integrations/users/{userId}/permissions:
 *   get:
 *     summary: Get user permissions from FanzDash
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: string
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to fetch permissions
 */
router.get('/users/:userId/permissions', apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if requesting user has permission to view permissions
    if (req.user?.role !== 'admin' && req.user?.id !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const permissions = await getUserPermissions(userId);
    
    logAudit('permissions_requested', {
      userId: req.user?.id,
      targetUserId: userId
    });

    res.json({ permissions });
  } catch (error) {
    logError(error, { context: 'get_permissions_api', userId: req.user?.id });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

/**
 * @swagger
 * /api/integrations/sync/earnings:
 *   post:
 *     summary: Sync creator earnings across platforms
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - creatorId
 *               - earnings
 *             properties:
 *               creatorId:
 *                 type: string
 *               earnings:
 *                 type: object
 *                 required:
 *                   - total
 *                   - thisMonth
 *                   - lastPayout
 *                   - pendingPayout
 *                 properties:
 *                   total:
 *                     type: number
 *                   thisMonth:
 *                     type: number
 *                   lastPayout:
 *                     type: number
 *                   pendingPayout:
 *                     type: number
 *                   platforms:
 *                     type: object
 *     responses:
 *       200:
 *         description: Earnings synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 syncId:
 *                   type: string
 *       400:
 *         description: Invalid earnings data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Sync failed
 */
router.post('/sync/earnings', apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { creatorId, earnings } = req.body;
    
    if (!creatorId || !earnings) {
      return res.status(400).json({ error: 'Missing creatorId or earnings data' });
    }

    const requiredFields = ['total', 'thisMonth', 'lastPayout', 'pendingPayout'];
    const missingFields = requiredFields.filter(field => earnings[field] === undefined);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required earnings fields', 
        missingFields 
      });
    }

    // Check if user has permission to sync earnings for this creator
    if (req.user?.role !== 'admin' && req.user?.id !== creatorId) {
      return res.status(403).json({ error: 'Insufficient permissions to sync earnings' });
    }

    const result = await syncEarnings(creatorId, earnings);
    
    logAudit('earnings_sync_requested', {
      userId: req.user?.id,
      creatorId,
      totalEarnings: earnings.total
    });

    res.json({
      success: true,
      syncId: result.syncId || 'earnings-sync-' + Date.now()
    });
  } catch (error) {
    logError(error, { context: 'earnings_sync_api', userId: req.user?.id });
    res.status(500).json({ error: 'Earnings sync failed' });
  }
});

/**
 * @swagger
 * /api/integrations/test/webhook:
 *   post:
 *     summary: Test webhook endpoint (development only)
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [fanzdash, boyfanz, girlfanz, pupfanz, daddiesfanz, cougarfanz, taboofanz]
 *               event:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Test webhook processed
 *       400:
 *         description: Invalid test data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not available in production
 */
router.post('/test/webhook', apiLimiter, authenticateToken, async (req, res) => {
  // Only allow in development environment
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test endpoints not available in production' });
  }

  // Only allow admin users
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { platform, event, data } = req.body;
    
    if (!platform || !event || !data) {
      return res.status(400).json({ error: 'Missing platform, event, or data' });
    }

    // Create mock webhook request
    const mockReq = {
      body: {
        event,
        data,
        timestamp: new Date().toISOString(),
        source: platform
      },
      headers: {
        'x-fanz-signature': 'sha256=test-signature',
        'x-fanz-platform': platform,
        'user-agent': 'FANZ-Test-Webhook/1.0'
      },
      ip: req.ip,
      params: { platform }
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => {
          res.status(code).json(data);
          return mockRes;
        }
      }),
      json: (data) => {
        res.json(data);
        return mockRes;
      }
    };

    // Process webhook
    if (platform === 'fanzdash') {
      await processFanzDashWebhook(mockReq, mockRes);
    } else {
      await processPlatformWebhook(mockReq, mockRes);
    }

    logAudit('test_webhook_executed', {
      userId: req.user?.id,
      platform,
      event
    });
  } catch (error) {
    logError(error, { context: 'test_webhook', userId: req.user?.id });
    res.status(500).json({ error: 'Test webhook failed' });
  }
});

/**
 * @swagger
 * /api/integrations/status:
 *   get:
 *     summary: Get integration status and statistics
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Integration status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uptime:
 *                   type: number
 *                   description: Uptime in seconds
 *                 webhooksReceived:
 *                   type: object
 *                   description: Count of webhooks received by platform
 *                 lastSync:
 *                   type: string
 *                   format: date-time
 *                   description: Last successful sync time
 *                 health:
 *                   type: object
 *                   description: Health status of integrated services
 *       401:
 *         description: Unauthorized
 */
router.get('/status', apiLimiter, authenticateToken, async (req, res) => {
  try {
    const uptime = process.uptime();
    const health = await checkEcosystemHealth();
    
    // In a real implementation, you would track these metrics
    const webhooksReceived = {
      fanzdash: 0,
      boyfanz: 0,
      girlfanz: 0,
      pupfanz: 0,
      daddiesfanz: 0,
      cougarfanz: 0,
      taboofanz: 0
    };

    const status = {
      uptime,
      webhooksReceived,
      lastSync: new Date().toISOString(),
      health
    };

    logAudit('integration_status_requested', {
      userId: req.user?.id
    });

    res.json(status);
  } catch (error) {
    logError(error, { context: 'integration_status', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to get integration status' });
  }
});

export default router;