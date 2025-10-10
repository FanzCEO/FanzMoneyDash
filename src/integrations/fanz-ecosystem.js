/**
 * FANZ Ecosystem Integration Hub
 * Centralized integration with all FANZ platforms and services
 */

import axios from 'axios';
import { logAudit, logError, logTransaction, logSecurityEvent } from '../config/logger.js';

/**
 * FANZ Ecosystem Integration Class
 * Handles communication with all FANZ platforms and services
 */
export class FanzEcosystemIntegration {
  constructor() {
    this.config = {
      fanzdash: {
        baseUrl: process.env.FANZDASH_API_URL || 'https://dash.fanz.network/api',
        apiKey: process.env.FANZDASH_API_KEY,
        timeout: 10000
      },
      sso: {
        providerUrl: process.env.SSO_PROVIDER_URL || 'https://sso.fanz.network',
        clientId: process.env.SSO_CLIENT_ID || 'fanz-money-dash',
        clientSecret: process.env.SSO_CLIENT_SECRET
      },
      platforms: {
        boyfanz: process.env.WEBHOOK_BOYFANZ || 'https://api.boyfanz.com/webhooks/money-dash',
        girlfanz: process.env.WEBHOOK_GIRLFANZ || 'https://api.girlfanz.com/webhooks/money-dash',
        pupfanz: process.env.WEBHOOK_PUPFANZ || 'https://api.pupfanz.com/webhooks/money-dash',
        daddiesfanz: process.env.WEBHOOK_DADDIESFANZ || 'https://api.daddiesfanz.com/webhooks/money-dash',
        cougarfanz: process.env.WEBHOOK_COUGARFANZ || 'https://api.cougarfanz.com/webhooks/money-dash',
        taboofanz: process.env.WEBHOOK_TABOOFANZ || 'https://api.taboofanz.com/webhooks/money-dash'
      }
    };

    // Initialize HTTP client with common configuration
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'FANZ-MoneyDash/1.0.0',
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        logAudit('api_request_sent', {
          url: config.url,
          method: config.method.toUpperCase(),
          service: this.getServiceFromUrl(config.url)
        });
        return config;
      },
      (error) => {
        logError(error, { context: 'http_request_interceptor' });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.httpClient.interceptors.response.use(
      (response) => {
        logAudit('api_response_received', {
          url: response.config.url,
          status: response.status,
          service: this.getServiceFromUrl(response.config.url)
        });
        return response;
      },
      (error) => {
        const service = this.getServiceFromUrl(error.config?.url);
        logError(error, {
          context: 'http_response_interceptor',
          service,
          status: error.response?.status
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Extract service name from URL for logging
   */
  getServiceFromUrl(url) {
    if (!url) return 'unknown';
    if (url.includes('dash.fanz.network')) return 'fanzdash';
    if (url.includes('sso.fanz.network')) return 'sso';
    if (url.includes('boyfanz.com')) return 'boyfanz';
    if (url.includes('girlfanz.com')) return 'girlfanz';
    if (url.includes('pupfanz.com')) return 'pupfanz';
    if (url.includes('daddiesfanz.com')) return 'daddiesfanz';
    if (url.includes('cougarfanz.com')) return 'cougarfanz';
    if (url.includes('taboofanz.com')) return 'taboofanz';
    return 'external';
  }

  /**
   * Authenticate with FanzDash and get access token
   */
  async authenticateWithFanzDash() {
    try {
      const response = await this.httpClient.post(`${this.config.fanzdash.baseUrl}/auth/service`, {
        clientId: 'fanz-money-dash',
        apiKey: this.config.fanzdash.apiKey,
        service: 'money-dash'
      });

      logAudit('fanzdash_authentication_success', {
        service: 'fanzdash'
      });

      return response.data.token;
    } catch (error) {
      logError(error, { context: 'fanzdash_authentication' });
      throw new Error('Failed to authenticate with FanzDash');
    }
  }

  /**
   * Sync user data with FanzDash
   */
  async syncUserWithFanzDash(userData) {
    try {
      const token = await this.authenticateWithFanzDash();
      
      const response = await this.httpClient.post(
        `${this.config.fanzdash.baseUrl}/users/sync`,
        {
          userId: userData.id,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          status: userData.status,
          lastActive: new Date().toISOString(),
          source: 'money-dash'
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      logAudit('user_sync_success', {
        userId: userData.id,
        service: 'fanzdash'
      });

      return response.data;
    } catch (error) {
      logError(error, { context: 'user_sync', userId: userData.id });
      throw error;
    }
  }

  /**
   * Send transaction notification to all platforms
   */
  async notifyPlatforms(transactionData) {
    const { userId, amount, type, processor, platformOrigin } = transactionData;
    
    const notification = {
      timestamp: new Date().toISOString(),
      source: 'fanz-money-dash',
      event: 'transaction_processed',
      data: {
        userId,
        amount,
        type,
        processor,
        transactionId: transactionData.id
      }
    };

    const promises = [];
    
    // Send to all platforms except the origin platform
    Object.entries(this.config.platforms).forEach(([platform, webhookUrl]) => {
      if (platform !== platformOrigin) {
        promises.push(this.sendWebhook(platform, webhookUrl, notification));
      }
    });

    // Also notify FanzDash
    promises.push(this.notifyFanzDash('transaction_processed', notification.data));

    try {
      const results = await Promise.allSettled(promises);
      
      // Log results
      results.forEach((result, index) => {
        const platformName = Object.keys(this.config.platforms)[index] || 'fanzdash';
        if (result.status === 'fulfilled') {
          logAudit('platform_notification_success', {
            platform: platformName,
            transactionId: transactionData.id
          });
        } else {
          logError(result.reason, {
            context: 'platform_notification',
            platform: platformName,
            transactionId: transactionData.id
          });
        }
      });

      return results;
    } catch (error) {
      logError(error, { context: 'notify_platforms', transactionId: transactionData.id });
      throw error;
    }
  }

  /**
   * Send webhook to a specific platform
   */
  async sendWebhook(platform, url, payload) {
    try {
      const response = await this.httpClient.post(url, payload, {
        headers: {
          'X-FANZ-Source': 'money-dash',
          'X-FANZ-Platform': platform,
          'X-FANZ-Signature': this.generateWebhookSignature(payload)
        }
      });

      return response.data;
    } catch (error) {
      logError(error, { context: 'webhook_send', platform, url });
      throw error;
    }
  }

  /**
   * Generate webhook signature for verification
   */
  generateWebhookSignature(payload) {
    const crypto = require('crypto');
    const secret = process.env.WEBHOOK_SECRET || 'fanz-money-dash-webhook-secret';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Send notification to FanzDash
   */
  async notifyFanzDash(event, data) {
    try {
      const token = await this.authenticateWithFanzDash();
      
      const response = await this.httpClient.post(
        `${this.config.fanzdash.baseUrl}/notifications`,
        {
          event,
          source: 'money-dash',
          timestamp: new Date().toISOString(),
          data
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      return response.data;
    } catch (error) {
      logError(error, { context: 'fanzdash_notification', event });
      throw error;
    }
  }

  /**
   * Get user permissions from FanzDash
   */
  async getUserPermissions(userId) {
    try {
      const token = await this.authenticateWithFanzDash();
      
      const response = await this.httpClient.get(
        `${this.config.fanzdash.baseUrl}/users/${userId}/permissions`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      logAudit('permissions_retrieved', {
        userId,
        service: 'fanzdash'
      });

      return response.data.permissions;
    } catch (error) {
      logError(error, { context: 'get_user_permissions', userId });
      throw error;
    }
  }

  /**
   * Validate user session with SSO
   */
  async validateUserSession(sessionToken) {
    try {
      const response = await this.httpClient.post(
        `${this.config.sso.providerUrl}/validate`,
        {
          token: sessionToken,
          clientId: this.config.sso.clientId
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.sso.clientSecret}`
          }
        }
      );

      if (response.data.valid) {
        logAudit('session_validation_success', {
          userId: response.data.userId,
          service: 'sso'
        });
        return response.data.user;
      } else {
        logSecurityEvent('invalid_session_token', {
          token: sessionToken.substring(0, 10) + '...',
          service: 'sso'
        });
        return null;
      }
    } catch (error) {
      logError(error, { context: 'session_validation' });
      throw error;
    }
  }

  /**
   * Report suspicious activity to FanzDash security
   */
  async reportSuspiciousActivity(activity) {
    try {
      const token = await this.authenticateWithFanzDash();
      
      const response = await this.httpClient.post(
        `${this.config.fanzdash.baseUrl}/security/incidents`,
        {
          source: 'money-dash',
          timestamp: new Date().toISOString(),
          severity: activity.severity || 'medium',
          type: activity.type || 'suspicious_activity',
          description: activity.description,
          userId: activity.userId,
          ip: activity.ip,
          userAgent: activity.userAgent,
          details: activity.details || {}
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      logSecurityEvent('security_incident_reported', {
        incidentId: response.data.id,
        type: activity.type,
        userId: activity.userId
      });

      return response.data;
    } catch (error) {
      logError(error, { context: 'report_suspicious_activity' });
      throw error;
    }
  }

  /**
   * Get platform-specific configuration
   */
  async getPlatformConfig(platform) {
    try {
      const token = await this.authenticateWithFanzDash();
      
      const response = await this.httpClient.get(
        `${this.config.fanzdash.baseUrl}/platforms/${platform}/config`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      return response.data;
    } catch (error) {
      logError(error, { context: 'get_platform_config', platform });
      throw error;
    }
  }

  /**
   * Health check for all integrated services
   */
  async performHealthCheck() {
    const services = ['fanzdash', 'sso'];
    const platforms = Object.keys(this.config.platforms);
    const results = {};

    // Check core services
    for (const service of services) {
      try {
        const url = service === 'fanzdash' 
          ? `${this.config.fanzdash.baseUrl}/health`
          : `${this.config.sso.providerUrl}/health`;
          
        const response = await this.httpClient.get(url, { timeout: 5000 });
        results[service] = {
          status: 'healthy',
          responseTime: response.headers['x-response-time'] || 'unknown',
          statusCode: response.status
        };
      } catch (error) {
        results[service] = {
          status: 'unhealthy',
          error: error.message,
          statusCode: error.response?.status || 'timeout'
        };
      }
    }

    // Check platform webhooks (simplified ping)
    for (const platform of platforms) {
      try {
        const url = this.config.platforms[platform].replace('/webhooks/money-dash', '/health');
        const response = await this.httpClient.get(url, { timeout: 3000 });
        results[platform] = {
          status: 'healthy',
          statusCode: response.status
        };
      } catch (error) {
        results[platform] = {
          status: 'unhealthy',
          error: error.message,
          statusCode: error.response?.status || 'timeout'
        };
      }
    }

    return results;
  }

  /**
   * Sync creator earnings across platforms
   */
  async syncCreatorEarnings(creatorId, earnings) {
    try {
      const token = await this.authenticateWithFanzDash();
      
      const response = await this.httpClient.post(
        `${this.config.fanzdash.baseUrl}/creators/${creatorId}/earnings`,
        {
          source: 'money-dash',
          timestamp: new Date().toISOString(),
          earnings: {
            total: earnings.total,
            thisMonth: earnings.thisMonth,
            lastPayout: earnings.lastPayout,
            pendingPayout: earnings.pendingPayout,
            platforms: earnings.platforms || {}
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      logAudit('earnings_sync_success', {
        creatorId,
        totalEarnings: earnings.total
      });

      return response.data;
    } catch (error) {
      logError(error, { context: 'sync_creator_earnings', creatorId });
      throw error;
    }
  }
}

// Create singleton instance
const fanzIntegration = new FanzEcosystemIntegration();

// Export convenience functions
export const syncUserWithEcosystem = (userData) => fanzIntegration.syncUserWithFanzDash(userData);
export const notifyAllPlatforms = (transactionData) => fanzIntegration.notifyPlatforms(transactionData);
export const validateSession = (sessionToken) => fanzIntegration.validateUserSession(sessionToken);
export const reportSecurity = (activity) => fanzIntegration.reportSuspiciousActivity(activity);
export const checkEcosystemHealth = () => fanzIntegration.performHealthCheck();
export const syncEarnings = (creatorId, earnings) => fanzIntegration.syncCreatorEarnings(creatorId, earnings);
export const getUserPermissions = (userId) => fanzIntegration.getUserPermissions(userId);

export default fanzIntegration;