/**
 * FANZ Webhook Handler
 * Processes incoming webhooks from other FANZ platforms and services
 */

import crypto from 'crypto';
import { logAudit, logError, logSecurityEvent } from '../config/logger.js';
import { notifyAllPlatforms } from './fanz-ecosystem.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

/**
 * Verify webhook signature for security
 */
export function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const receivedSignature = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  );
}

/**
 * Process webhook from FanzDash
 */
export async function processFanzDashWebhook(req, res) {
  try {
    const signature = req.headers['x-fanz-signature'];
    const secret = process.env.WEBHOOK_SECRET || 'fanz-money-dash-webhook-secret';
    
    // Verify signature
    if (!verifyWebhookSignature(JSON.stringify(req.body), signature, secret)) {
      logSecurityEvent('invalid_webhook_signature', {
        source: 'fanzdash',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, data, timestamp, source } = req.body;

    logAudit('webhook_received', {
      event,
      source: source || 'fanzdash',
      timestamp
    });

    // Process based on event type
    switch (event) {
      case 'user_created':
        await handleUserCreated(data);
        break;
        
      case 'user_updated':
        await handleUserUpdated(data);
        break;
        
      case 'user_suspended':
        await handleUserSuspended(data);
        break;
        
      case 'security_alert':
        await handleSecurityAlert(data);
        break;
        
      case 'platform_config_updated':
        await handleConfigUpdate(data);
        break;
        
      case 'mass_payout_initiated':
        await handleMassPayoutInitiated(data);
        break;
        
      default:
        logAudit('unhandled_webhook_event', {
          event,
          source: source || 'fanzdash'
        });
    }

    res.status(200).json({ status: 'processed' });
  } catch (error) {
    logError(error, { context: 'fanzdash_webhook_processing' });
    res.status(500).json({ error: 'Processing failed' });
  }
}

/**
 * Process webhook from platform (BoyFanz, GirlFanz, etc.)
 */
export async function processPlatformWebhook(req, res) {
  try {
    const signature = req.headers['x-fanz-signature'];
    const platform = req.headers['x-fanz-platform'] || req.params.platform;
    const secret = process.env.WEBHOOK_SECRET || 'fanz-money-dash-webhook-secret';
    
    // Verify signature
    if (!verifyWebhookSignature(JSON.stringify(req.body), signature, secret)) {
      logSecurityEvent('invalid_webhook_signature', {
        source: platform,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, data, timestamp } = req.body;

    logAudit('webhook_received', {
      event,
      source: platform,
      timestamp
    });

    // Process based on event type
    switch (event) {
      case 'subscription_created':
        await handleSubscriptionCreated(data, platform);
        break;
        
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(data, platform);
        break;
        
      case 'tip_sent':
        await handleTipSent(data, platform);
        break;
        
      case 'content_purchased':
        await handleContentPurchased(data, platform);
        break;
        
      case 'creator_earnings_updated':
        await handleCreatorEarningsUpdated(data, platform);
        break;
        
      case 'chargeback_received':
        await handleChargeback(data, platform);
        break;
        
      case 'fraud_detected':
        await handleFraudDetected(data, platform);
        break;
        
      default:
        logAudit('unhandled_webhook_event', {
          event,
          source: platform
        });
    }

    res.status(200).json({ status: 'processed' });
  } catch (error) {
    logError(error, { context: 'platform_webhook_processing' });
    res.status(500).json({ error: 'Processing failed' });
  }
}

/**
 * Handle user created event
 */
async function handleUserCreated(data) {
  try {
    const { userId, username, email, role, platforms } = data;
    
    // Check if user already exists
    let user = await User.findOne({ userId });
    
    if (!user) {
      user = new User({
        userId,
        username,
        email,
        role,
        status: 'active',
        platforms: platforms || [],
        createdAt: new Date(),
        lastActive: new Date()
      });
      
      await user.save();
      
      logAudit('user_created_from_webhook', {
        userId,
        username,
        role
      });
    }
  } catch (error) {
    logError(error, { context: 'handle_user_created' });
  }
}

/**
 * Handle user updated event
 */
async function handleUserUpdated(data) {
  try {
    const { userId } = data;
    
    const user = await User.findOne({ userId });
    if (user) {
      // Update user fields
      Object.keys(data).forEach(key => {
        if (key !== 'userId' && user[key] !== undefined) {
          user[key] = data[key];
        }
      });
      
      user.updatedAt = new Date();
      await user.save();
      
      logAudit('user_updated_from_webhook', {
        userId,
        updatedFields: Object.keys(data)
      });
    }
  } catch (error) {
    logError(error, { context: 'handle_user_updated' });
  }
}

/**
 * Handle user suspended event
 */
async function handleUserSuspended(data) {
  try {
    const { userId, reason, suspendedUntil } = data;
    
    const user = await User.findOne({ userId });
    if (user) {
      user.status = 'suspended';
      user.suspensionReason = reason;
      user.suspendedUntil = suspendedUntil ? new Date(suspendedUntil) : null;
      user.updatedAt = new Date();
      
      await user.save();
      
      logSecurityEvent('user_suspended', {
        userId,
        reason,
        suspendedUntil
      });
    }
  } catch (error) {
    logError(error, { context: 'handle_user_suspended' });
  }
}

/**
 * Handle security alert
 */
async function handleSecurityAlert(data) {
  try {
    const { userId, alertType, severity, details } = data;
    
    logSecurityEvent('security_alert_received', {
      userId,
      alertType,
      severity,
      details
    });
    
    // Take action based on alert type
    switch (alertType) {
      case 'multiple_failed_logins':
        await handleMultipleFailedLogins(userId, details);
        break;
        
      case 'suspicious_transaction':
        await handleSuspiciousTransaction(userId, details);
        break;
        
      case 'account_compromise':
        await handleAccountCompromise(userId, details);
        break;
    }
  } catch (error) {
    logError(error, { context: 'handle_security_alert' });
  }
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(data, platform) {
  try {
    const { userId, creatorId, amount, currency, subscriptionId } = data;
    
    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: 'subscription',
      amount: parseFloat(amount),
      currency: currency || 'USD',
      processor: platform,
      status: 'completed',
      metadata: {
        creatorId,
        subscriptionId,
        platform,
        type: 'monthly_subscription'
      },
      createdAt: new Date()
    });
    
    await transaction.save();
    
    logAudit('subscription_created', {
      userId,
      creatorId,
      amount,
      platform,
      subscriptionId
    });
    
    // Notify other platforms
    await notifyAllPlatforms({
      id: transaction._id,
      userId,
      amount,
      type: 'subscription',
      processor: platform,
      platformOrigin: platform
    });
  } catch (error) {
    logError(error, { context: 'handle_subscription_created' });
  }
}

/**
 * Handle tip sent
 */
async function handleTipSent(data, platform) {
  try {
    const { userId, creatorId, amount, currency, message } = data;
    
    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: 'tip',
      amount: parseFloat(amount),
      currency: currency || 'USD',
      processor: platform,
      status: 'completed',
      metadata: {
        creatorId,
        platform,
        message: message || '',
        type: 'creator_tip'
      },
      createdAt: new Date()
    });
    
    await transaction.save();
    
    logAudit('tip_sent', {
      userId,
      creatorId,
      amount,
      platform
    });
    
    // Notify other platforms
    await notifyAllPlatforms({
      id: transaction._id,
      userId,
      amount,
      type: 'tip',
      processor: platform,
      platformOrigin: platform
    });
  } catch (error) {
    logError(error, { context: 'handle_tip_sent' });
  }
}

/**
 * Handle content purchased
 */
async function handleContentPurchased(data, platform) {
  try {
    const { userId, creatorId, contentId, amount, currency, contentType } = data;
    
    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: 'purchase',
      amount: parseFloat(amount),
      currency: currency || 'USD',
      processor: platform,
      status: 'completed',
      metadata: {
        creatorId,
        contentId,
        contentType: contentType || 'content',
        platform,
        type: 'content_purchase'
      },
      createdAt: new Date()
    });
    
    await transaction.save();
    
    logAudit('content_purchased', {
      userId,
      creatorId,
      contentId,
      amount,
      platform,
      contentType
    });
    
    // Notify other platforms
    await notifyAllPlatforms({
      id: transaction._id,
      userId,
      amount,
      type: 'purchase',
      processor: platform,
      platformOrigin: platform
    });
  } catch (error) {
    logError(error, { context: 'handle_content_purchased' });
  }
}

/**
 * Handle chargeback
 */
async function handleChargeback(data, platform) {
  try {
    const { transactionId, amount, reason, currency } = data;
    
    // Find original transaction
    const transaction = await Transaction.findOne({
      $or: [
        { _id: transactionId },
        { 'metadata.originalTransactionId': transactionId }
      ]
    });
    
    if (transaction) {
      // Create chargeback transaction
      const chargeback = new Transaction({
        userId: transaction.userId,
        type: 'chargeback',
        amount: -Math.abs(parseFloat(amount)),
        currency: currency || transaction.currency,
        processor: platform,
        status: 'completed',
        metadata: {
          originalTransactionId: transaction._id,
          reason: reason || 'chargeback',
          platform,
          type: 'chargeback'
        },
        createdAt: new Date()
      });
      
      await chargeback.save();
      
      logSecurityEvent('chargeback_received', {
        userId: transaction.userId,
        originalTransactionId: transaction._id,
        amount,
        reason,
        platform
      });
      
      // Notify other platforms
      await notifyAllPlatforms({
        id: chargeback._id,
        userId: transaction.userId,
        amount: chargeback.amount,
        type: 'chargeback',
        processor: platform,
        platformOrigin: platform
      });
    }
  } catch (error) {
    logError(error, { context: 'handle_chargeback' });
  }
}

/**
 * Handle fraud detected
 */
async function handleFraudDetected(data, platform) {
  try {
    const { userId, transactionId, fraudType, riskScore, details } = data;
    
    logSecurityEvent('fraud_detected', {
      userId,
      transactionId,
      fraudType,
      riskScore,
      platform,
      details
    });
    
    // Mark transaction as fraudulent if it exists
    if (transactionId) {
      await Transaction.findByIdAndUpdate(transactionId, {
        status: 'fraud',
        'metadata.fraudType': fraudType,
        'metadata.riskScore': riskScore,
        'metadata.fraudDetails': details
      });
    }
    
    // Suspend user if fraud score is high
    if (riskScore && riskScore > 0.8) {
      await User.findOneAndUpdate(
        { userId },
        {
          status: 'suspended',
          suspensionReason: `High fraud risk score: ${riskScore}`,
          updatedAt: new Date()
        }
      );
    }
  } catch (error) {
    logError(error, { context: 'handle_fraud_detected' });
  }
}

/**
 * Handle config update
 */
async function handleConfigUpdate(data) {
  try {
    const { platform, config, updatedBy } = data;
    
    logAudit('platform_config_updated', {
      platform,
      updatedBy,
      configKeys: Object.keys(config || {})
    });
    
    // Potentially restart services or refresh configuration
    // Implementation depends on your configuration management strategy
  } catch (error) {
    logError(error, { context: 'handle_config_update' });
  }
}

/**
 * Handle mass payout initiated
 */
async function handleMassPayoutInitiated(data) {
  try {
    const { payoutId, totalAmount, creatorCount, scheduledFor } = data;
    
    logAudit('mass_payout_initiated', {
      payoutId,
      totalAmount,
      creatorCount,
      scheduledFor
    });
    
    // Potentially prepare financial systems for mass payout
    // Implementation depends on your payout infrastructure
  } catch (error) {
    logError(error, { context: 'handle_mass_payout' });
  }
}

/**
 * Handle multiple failed logins
 */
async function handleMultipleFailedLogins(userId, details) {
  try {
    // Temporarily lock user account
    await User.findOneAndUpdate(
      { userId },
      {
        status: 'locked',
        lockReason: 'Multiple failed login attempts',
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        updatedAt: new Date()
      }
    );
    
    logSecurityEvent('account_locked', {
      userId,
      reason: 'multiple_failed_logins',
      details
    });
  } catch (error) {
    logError(error, { context: 'handle_multiple_failed_logins' });
  }
}

/**
 * Handle suspicious transaction
 */
async function handleSuspiciousTransaction(userId, details) {
  try {
    // Flag for manual review
    logSecurityEvent('transaction_flagged', {
      userId,
      reason: 'suspicious_activity',
      details
    });
    
    // Potentially limit transaction amounts temporarily
    // Implementation depends on your business rules
  } catch (error) {
    logError(error, { context: 'handle_suspicious_transaction' });
  }
}

/**
 * Handle account compromise
 */
async function handleAccountCompromise(userId, details) {
  try {
    // Immediately suspend account
    await User.findOneAndUpdate(
      { userId },
      {
        status: 'suspended',
        suspensionReason: 'Account compromise suspected',
        updatedAt: new Date()
      }
    );
    
    logSecurityEvent('account_compromised', {
      userId,
      details
    });
    
    // Force logout on all devices
    // Implementation depends on your session management
  } catch (error) {
    logError(error, { context: 'handle_account_compromise' });
  }
}