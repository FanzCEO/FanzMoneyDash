import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import Redis from 'ioredis';
import { Logger } from 'winston';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

export interface NotificationPayload {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  channels: NotificationChannel[];
  scheduledAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export enum NotificationType {
  TRANSACTION_COMPLETED = 'transaction_completed',
  TRANSACTION_FAILED = 'transaction_failed',
  PAYOUT_PROCESSED = 'payout_processed',
  PAYOUT_FAILED = 'payout_failed',
  SECURITY_ALERT = 'security_alert',
  LOGIN_ATTEMPT = 'login_attempt',
  MFA_ENABLED = 'mfa_enabled',
  PASSWORD_CHANGED = 'password_changed',
  ACCOUNT_SUSPENDED = 'account_suspended',
  NEW_MESSAGE = 'new_message',
  SYSTEM_MAINTENANCE = 'system_maintenance',
  REVENUE_MILESTONE = 'revenue_milestone',
  SUBSCRIPTION_RENEWAL = 'subscription_renewal',
  REFUND_PROCESSED = 'refund_processed',
  KYC_APPROVED = 'kyc_approved',
  KYC_REJECTED = 'kyc_rejected'
}

export enum NotificationChannel {
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  IN_APP = 'in_app'
}

export interface UserPreferences {
  userId: string;
  channels: {
    [key in NotificationChannel]?: boolean;
  };
  types: {
    [key in NotificationType]?: {
      enabled: boolean;
      channels: NotificationChannel[];
    };
  };
  quietHours?: {
    start: string; // HH:mm format
    end: string;   // HH:mm format
    timezone: string;
  };
}

export interface NotificationTemplate {
  type: NotificationType;
  channel: NotificationChannel;
  subject?: string;
  title: string;
  message: string;
  htmlTemplate?: string;
}

export class NotificationService {
  private io: SocketIOServer;
  private redis: Redis;
  private db: Pool;
  private logger: Logger;
  private emailTransporter: nodemailer.Transporter;
  private twilioClient: twilio.Twilio;
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor(
    httpServer: HTTPServer,
    redis: Redis,
    db: Pool,
    logger: Logger
  ) {
    this.redis = redis;
    this.db = db;
    this.logger = logger;

    // Initialize Socket.IO
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Initialize Twilio
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }

    this.setupSocketHandlers();
    this.loadTemplates();
    this.startNotificationWorker();
  }

  /**
   * Send a notification through specified channels
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      this.logger.info('Sending notification:', { 
        id: payload.id, 
        userId: payload.userId, 
        type: payload.type 
      });

      // Get user preferences
      const preferences = await this.getUserPreferences(payload.userId);
      
      // Filter channels based on user preferences
      const enabledChannels = payload.channels.filter(channel => 
        preferences.channels[channel] !== false
      );

      // Check if notification type is enabled
      const typePrefs = preferences.types[payload.type];
      if (typePrefs && !typePrefs.enabled) {
        this.logger.info('Notification type disabled for user:', { 
          userId: payload.userId, 
          type: payload.type 
        });
        return;
      }

      // Check quiet hours
      if (this.isInQuietHours(preferences)) {
        if (payload.priority !== 'critical') {
          await this.scheduleNotification(payload, this.getNextActiveTime(preferences));
          return;
        }
      }

      // Store notification in database
      await this.storeNotification(payload);

      // Send through each enabled channel
      const sendPromises = enabledChannels.map(async (channel) => {
        try {
          switch (channel) {
            case NotificationChannel.IN_APP:
              await this.sendInAppNotification(payload);
              break;
            case NotificationChannel.PUSH:
              await this.sendPushNotification(payload);
              break;
            case NotificationChannel.EMAIL:
              await this.sendEmailNotification(payload);
              break;
            case NotificationChannel.SMS:
              await this.sendSMSNotification(payload);
              break;
            case NotificationChannel.WEBHOOK:
              await this.sendWebhookNotification(payload);
              break;
          }
        } catch (error) {
          this.logger.error(`Failed to send ${channel} notification:`, error);
        }
      });

      await Promise.allSettled(sendPromises);

      // Update notification status
      await this.updateNotificationStatus(payload.id, 'sent');

    } catch (error) {
      this.logger.error('Failed to send notification:', error);
      await this.updateNotificationStatus(payload.id, 'failed');
      throw error;
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotification(
    userIds: string[],
    template: Partial<NotificationPayload>
  ): Promise<void> {
    try {
      const notifications = userIds.map(userId => ({
        ...template,
        id: this.generateNotificationId(),
        userId,
        channels: template.channels || [NotificationChannel.IN_APP],
        priority: template.priority || 'medium'
      } as NotificationPayload));

      // Process in batches to avoid overwhelming the system
      const batchSize = 100;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const sendPromises = batch.map(notification => 
          this.sendNotification(notification).catch(error => {
            this.logger.error('Failed to send bulk notification:', { 
              notificationId: notification.id, 
              error 
            });
          })
        );
        await Promise.allSettled(sendPromises);
      }

    } catch (error) {
      this.logger.error('Failed to send bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Get user's notification preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const cacheKey = `user_prefs:${userId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const query = `
        SELECT preferences 
        FROM user_notification_preferences 
        WHERE user_id = $1
      `;
      
      const result = await this.db.query(query, [userId]);
      
      const defaultPreferences: UserPreferences = {
        userId,
        channels: {
          [NotificationChannel.IN_APP]: true,
          [NotificationChannel.EMAIL]: true,
          [NotificationChannel.PUSH]: false,
          [NotificationChannel.SMS]: false,
          [NotificationChannel.WEBHOOK]: false
        },
        types: Object.values(NotificationType).reduce((acc, type) => {
          acc[type] = {
            enabled: true,
            channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
          };
          return acc;
        }, {} as any)
      };

      const preferences = result.rows[0]?.preferences 
        ? { ...defaultPreferences, ...result.rows[0].preferences }
        : defaultPreferences;

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(preferences));

      return preferences;
    } catch (error) {
      this.logger.error('Failed to get user preferences:', error);
      throw error;
    }
  }

  /**
   * Update user's notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<void> {
    try {
      const currentPrefs = await this.getUserPreferences(userId);
      const updatedPrefs = { ...currentPrefs, ...preferences };

      const query = `
        INSERT INTO user_notification_preferences (user_id, preferences, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET preferences = $2, updated_at = NOW()
      `;

      await this.db.query(query, [userId, JSON.stringify(updatedPrefs)]);

      // Update cache
      const cacheKey = `user_prefs:${userId}`;
      await this.redis.setex(cacheKey, 3600, JSON.stringify(updatedPrefs));

      this.logger.info('Updated user notification preferences:', { userId });

    } catch (error) {
      this.logger.error('Failed to update user preferences:', error);
      throw error;
    }
  }

  /**
   * Get notification history for a user
   */
  async getNotificationHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationPayload[]> {
    try {
      const query = `
        SELECT id, user_id, type, title, message, data, priority, channels, 
               created_at, read_at, status
        FROM notifications 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;

      const result = await this.db.query(query, [userId, limit, offset]);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        title: row.title,
        message: row.message,
        data: row.data,
        priority: row.priority,
        channels: row.channels,
        metadata: {
          createdAt: row.created_at,
          readAt: row.read_at,
          status: row.status
        }
      }));

    } catch (error) {
      this.logger.error('Failed to get notification history:', error);
      throw error;
    }
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    try {
      const query = `
        UPDATE notifications 
        SET read_at = NOW() 
        WHERE user_id = $1 AND id = ANY($2) AND read_at IS NULL
      `;

      await this.db.query(query, [userId, notificationIds]);

      // Emit update to connected clients
      this.io.to(`user:${userId}`).emit('notifications:read', { ids: notificationIds });

    } catch (error) {
      this.logger.error('Failed to mark notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const cacheKey = `unread_count:${userId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached !== null) {
        return parseInt(cached);
      }

      const query = `
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE user_id = $1 AND read_at IS NULL
      `;

      const result = await this.db.query(query, [userId]);
      const count = parseInt(result.rows[0].count);

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, count.toString());

      return count;
    } catch (error) {
      this.logger.error('Failed to get unread count:', error);
      return 0;
    }
  }

  // Private methods
  private setupSocketHandlers(): void {
    this.io.use(async (socket, next) => {
      try {
        // Authentication middleware
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token and extract user ID
        // Implementation depends on your auth system
        const userId = await this.verifyToken(token);
        socket.userId = userId;
        
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      const userId = socket.userId;
      
      // Join user-specific room
      socket.join(`user:${userId}`);
      
      this.logger.info('Client connected to notifications:', { userId, socketId: socket.id });

      // Send unread count on connection
      this.getUnreadCount(userId).then(count => {
        socket.emit('notifications:unread_count', count);
      });

      socket.on('notifications:mark_read', async (data) => {
        try {
          await this.markAsRead(userId, data.ids);
        } catch (error) {
          socket.emit('error', { message: 'Failed to mark notifications as read' });
        }
      });

      socket.on('disconnect', () => {
        this.logger.info('Client disconnected from notifications:', { userId, socketId: socket.id });
      });
    });
  }

  private async verifyToken(token: string): Promise<string> {
    // JWT verification implementation
    // This should match your existing auth system
    return 'user-id'; // Placeholder
  }

  private async sendInAppNotification(payload: NotificationPayload): Promise<void> {
    // Send real-time notification via WebSocket
    this.io.to(`user:${payload.userId}`).emit('notification', {
      id: payload.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data,
      priority: payload.priority,
      timestamp: new Date()
    });

    // Update unread count
    const count = await this.getUnreadCount(payload.userId);
    this.io.to(`user:${payload.userId}`).emit('notifications:unread_count', count + 1);

    // Invalidate unread count cache
    await this.redis.del(`unread_count:${payload.userId}`);
  }

  private async sendPushNotification(payload: NotificationPayload): Promise<void> {
    // Implementation for push notifications
    // This would integrate with services like FCM, APNS, etc.
    this.logger.info('Push notification sent (mock):', { id: payload.id });
  }

  private async sendEmailNotification(payload: NotificationPayload): Promise<void> {
    try {
      const template = this.getTemplate(payload.type, NotificationChannel.EMAIL);
      const user = await this.getUser(payload.userId);

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@fanz.network',
        to: user.email,
        subject: template?.subject || payload.title,
        text: payload.message,
        html: template?.htmlTemplate || `<p>${payload.message}</p>`
      };

      await this.emailTransporter.sendMail(mailOptions);
      this.logger.info('Email notification sent:', { id: payload.id, email: user.email });

    } catch (error) {
      this.logger.error('Failed to send email notification:', error);
      throw error;
    }
  }

  private async sendSMSNotification(payload: NotificationPayload): Promise<void> {
    if (!this.twilioClient) {
      throw new Error('Twilio not configured');
    }

    try {
      const user = await this.getUser(payload.userId);
      if (!user.phone) {
        throw new Error('User phone number not available');
      }

      await this.twilioClient.messages.create({
        body: `${payload.title}: ${payload.message}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: user.phone
      });

      this.logger.info('SMS notification sent:', { id: payload.id, phone: user.phone });

    } catch (error) {
      this.logger.error('Failed to send SMS notification:', error);
      throw error;
    }
  }

  private async sendWebhookNotification(payload: NotificationPayload): Promise<void> {
    try {
      const user = await this.getUser(payload.userId);
      if (!user.webhookUrl) {
        return; // User hasn't configured webhook
      }

      const webhookPayload = {
        id: payload.id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data,
        priority: payload.priority,
        timestamp: new Date(),
        userId: payload.userId
      };

      const response = await fetch(user.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FANZ-Webhook-Signature': await this.generateWebhookSignature(webhookPayload)
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      this.logger.info('Webhook notification sent:', { id: payload.id, url: user.webhookUrl });

    } catch (error) {
      this.logger.error('Failed to send webhook notification:', error);
      throw error;
    }
  }

  private async storeNotification(payload: NotificationPayload): Promise<void> {
    const query = `
      INSERT INTO notifications (
        id, user_id, type, title, message, data, priority, channels, 
        created_at, expires_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, 'pending')
    `;

    await this.db.query(query, [
      payload.id,
      payload.userId,
      payload.type,
      payload.title,
      payload.message,
      JSON.stringify(payload.data || {}),
      payload.priority,
      JSON.stringify(payload.channels),
      payload.expiresAt
    ]);
  }

  private async updateNotificationStatus(id: string, status: string): Promise<void> {
    const query = `UPDATE notifications SET status = $1 WHERE id = $2`;
    await this.db.query(query, [status, id]);
  }

  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async getUser(userId: string): Promise<any> {
    const query = `SELECT email, phone, webhook_url FROM users WHERE id = $1`;
    const result = await this.db.query(query, [userId]);
    return result.rows[0];
  }

  private getTemplate(type: NotificationType, channel: NotificationChannel): NotificationTemplate | undefined {
    return this.templates.get(`${type}_${channel}`);
  }

  private loadTemplates(): void {
    // Load notification templates
    // This could be from database or configuration files
    this.templates.set(`${NotificationType.TRANSACTION_COMPLETED}_${NotificationChannel.EMAIL}`, {
      type: NotificationType.TRANSACTION_COMPLETED,
      channel: NotificationChannel.EMAIL,
      subject: 'Transaction Completed Successfully',
      title: 'Transaction Completed',
      message: 'Your transaction has been completed successfully.',
      htmlTemplate: '<h1>Transaction Completed</h1><p>Your transaction has been completed successfully.</p>'
    });

    // Add more templates as needed
  }

  private isInQuietHours(preferences: UserPreferences): boolean {
    if (!preferences.quietHours) return false;
    
    // Implementation for quiet hours check
    // Would compare current time in user's timezone with quiet hours
    return false; // Placeholder
  }

  private getNextActiveTime(preferences: UserPreferences): Date {
    // Calculate next active time after quiet hours
    return new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours from now (placeholder)
  }

  private async scheduleNotification(payload: NotificationPayload, scheduledAt: Date): Promise<void> {
    // Schedule notification for later delivery
    await this.redis.zadd(
      'scheduled_notifications',
      scheduledAt.getTime(),
      JSON.stringify(payload)
    );
  }

  private async generateWebhookSignature(payload: any): Promise<string> {
    // Generate HMAC signature for webhook security
    const crypto = require('crypto');
    const secret = process.env.WEBHOOK_SECRET || 'default-secret';
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private startNotificationWorker(): void {
    // Worker to process scheduled notifications
    setInterval(async () => {
      try {
        const now = Date.now();
        const scheduled = await this.redis.zrangebyscore('scheduled_notifications', '-inf', now, 'LIMIT', 0, 10);
        
        for (const item of scheduled) {
          const payload = JSON.parse(item);
          await this.sendNotification(payload);
          await this.redis.zrem('scheduled_notifications', item);
        }
      } catch (error) {
        this.logger.error('Error in notification worker:', error);
      }
    }, 60000); // Run every minute
  }
}

export default NotificationService;