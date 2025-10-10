/**
 * FANZ Webhook Security Utilities
 * Provides secure webhook signature validation and replay attack prevention
 */

import crypto from 'crypto';
import logger from '../config/logger.js';

/**
 * Verify webhook signature using HMAC-SHA256
 * Supports multiple signature formats and includes replay attack protection
 */
export function verifyWebhookSignature(params) {
  const {
    payload,          // Request body as string
    signature,        // Signature header
    secret,          // Webhook secret
    timestamp,       // Timestamp header (optional)
    tolerance = 300,  // Tolerance in seconds (default: 5 minutes)
    processor        // Processor ID for logging
  } = params;

  try {
    // Validate required parameters
    if (!payload || typeof payload !== 'string') {
      throw new Error('Payload must be a non-empty string');
    }

    if (!signature || typeof signature !== 'string') {
      throw new Error('Signature is required');
    }

    if (!secret || typeof secret !== 'string' || secret.length < 16) {
      throw new Error('Secret must be at least 16 characters');
    }

    // Extract signature from header (support multiple formats)
    let cleanSignature = signature;
    
    // Remove common prefixes
    const prefixes = ['sha256=', 'whsec_', 'hmac-sha256='];
    for (const prefix of prefixes) {
      if (cleanSignature.startsWith(prefix)) {
        cleanSignature = cleanSignature.substring(prefix.length);
        break;
      }
    }

    // Validate signature format (hex string)
    if (!/^[a-fA-F0-9]+$/.test(cleanSignature)) {
      throw new Error('Invalid signature format');
    }

    // Check timestamp for replay attack prevention
    if (timestamp) {
      const webhookTime = parseInt(timestamp, 10);
      
      if (isNaN(webhookTime) || webhookTime <= 0) {
        throw new Error('Invalid timestamp format');
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTime - webhookTime);
      
      if (timeDiff > tolerance) {
        logger.warn('Webhook replay attack detected', {
          processor,
          timeDiff,
          tolerance,
          webhookTime,
          currentTime
        });
        throw new Error(`Webhook timestamp too old (${timeDiff}s ago, tolerance: ${tolerance}s)`);
      }
    }

    // Calculate expected signature
    // Include timestamp in signature calculation if provided
    const signaturePayload = timestamp ? timestamp + payload : payload;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');

    // Convert to buffers for timing-safe comparison
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const receivedBuffer = Buffer.from(cleanSignature, 'hex');

    // Check buffer lengths first
    if (expectedBuffer.length !== receivedBuffer.length) {
      throw new Error('Signature length mismatch');
    }

    // Perform timing-safe comparison
    if (!crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      throw new Error('Signature verification failed');
    }

    return {
      valid: true,
      processor,
      timestamp: timestamp ? parseInt(timestamp, 10) : null,
      signatureMethod: 'HMAC-SHA256'
    };

  } catch (error) {
    logger.warn('Webhook signature validation failed', {
      processor,
      error: error.message,
      hasPayload: !!payload,
      hasSignature: !!signature,
      hasSecret: !!secret,
      hasTimestamp: !!timestamp,
      signatureLength: signature?.length || 0
    });

    return {
      valid: false,
      error: error.message,
      processor
    };
  }
}

/**
 * Generate webhook signature for testing purposes
 */
export function generateWebhookSignature(payload, secret, timestamp = null) {
  if (typeof payload !== 'string') {
    payload = JSON.stringify(payload);
  }

  const signaturePayload = timestamp ? timestamp + payload : payload;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  return {
    signature: 'sha256=' + signature,
    timestamp: timestamp || Math.floor(Date.now() / 1000),
    payload
  };
}

/**
 * Middleware factory for webhook signature validation
 */
export function createWebhookValidator(options = {}) {
  const {
    secretEnvVar = 'WEBHOOK_SECRET',
    processorEnvPrefix = 'WEBHOOK_SECRET_',
    toleranceSeconds = 300,
    requireTimestamp = true
  } = options;

  return (req, res, next) => {
    try {
      const signature = req.get('x-webhook-signature') || 
                       req.get('x-hub-signature-256') ||
                       req.get('x-signature-256');
      
      const timestamp = req.get('x-webhook-timestamp') ||
                       req.get('x-timestamp');

      // Get processor ID from route params or headers
      const processorId = req.params.processorId || 
                         req.get('x-processor-id') ||
                         req.get('x-source');

      if (!signature) {
        logger.warn('Webhook received without signature', {
          processorId,
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
        return res.status(401).json({
          success: false,
          error: 'Webhook signature required'
        });
      }

      if (requireTimestamp && !timestamp) {
        logger.warn('Webhook received without timestamp', {
          processorId,
          ip: req.ip
        });
        return res.status(401).json({
          success: false,
          error: 'Webhook timestamp required'
        });
      }

      // Get webhook secret (processor-specific or general)
      let secret = process.env.WEBHOOK_SECRET;
      if (processorId) {
        const processorSecretVar = `${processorEnvPrefix}${processorId.toUpperCase()}`;
        secret = process.env[processorSecretVar] || secret;
      }

      if (!secret) {
        logger.error('Webhook secret not configured', {
          processorId,
          secretEnvVar,
          processorEnvPrefix
        });
        return res.status(500).json({
          success: false,
          error: 'Server configuration error'
        });
      }

      // Validate signature
      const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      
      const validation = verifyWebhookSignature({
        payload,
        signature,
        secret,
        timestamp,
        tolerance: toleranceSeconds,
        processor: processorId
      });

      if (!validation.valid) {
        logger.warn('Webhook signature validation failed', {
          processorId,
          error: validation.error,
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook signature'
        });
      }

      // Add validation info to request
      req.webhookValidation = validation;
      
      logger.info('Webhook signature validated', {
        processorId,
        timestamp: validation.timestamp,
        method: validation.signatureMethod,
        ip: req.ip
      });

      next();
    } catch (error) {
      logger.error('Webhook validation middleware error', {
        error: error.message,
        processorId: req.params.processorId,
        ip: req.ip
      });
      
      return res.status(500).json({
        success: false,
        error: 'Webhook validation failed'
      });
    }
  };
}

/**
 * Validate webhook configuration on startup
 */
export function validateWebhookConfig(processors = []) {
  const issues = [];
  
  // Check general webhook secret
  const generalSecret = process.env.WEBHOOK_SECRET;
  if (!generalSecret) {
    issues.push('WEBHOOK_SECRET environment variable not set');
  } else if (generalSecret.length < 32) {
    issues.push('WEBHOOK_SECRET should be at least 32 characters for security');
  }

  // Check processor-specific secrets
  for (const processor of processors) {
    const secretVar = `WEBHOOK_SECRET_${processor.toUpperCase()}`;
    const processorSecret = process.env[secretVar];
    
    if (!processorSecret) {
      logger.warn(`No specific webhook secret for ${processor}, using general secret`);
    } else if (processorSecret.length < 32) {
      issues.push(`${secretVar} should be at least 32 characters for security`);
    }
  }

  if (issues.length > 0) {
    logger.warn('Webhook configuration issues detected', { issues });
  } else {
    logger.info('Webhook configuration validated successfully');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export default {
  verifyWebhookSignature,
  generateWebhookSignature,
  createWebhookValidator,
  validateWebhookConfig
};