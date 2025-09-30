/**
 * Redis Configuration
 * Connection management for caching, sessions, and real-time features
 */

import Redis, { RedisOptions } from 'ioredis';
import { Logger } from '../utils/logger';

const logger = new Logger('Redis');

/**
 * Redis connection configuration
 */
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  keepAlive: number;
  connectTimeout: number;
  commandTimeout: number;
  family: 4 | 6;
  tls?: {
    rejectUnauthorized: boolean;
  };
}

/**
 * Parse Redis URL or use individual environment variables
 */
function getRedisConfig(): RedisConfig {
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl) {
    // Parse REDIS_URL
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      db: parseInt(url.pathname.slice(1)) || 0,
      keyPrefix: process.env.REDIS_PREFIX || 'fanzmoney:',
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      lazyConnect: true,
      keepAlive: parseInt(process.env.REDIS_KEEPALIVE || '30000'),
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
      family: 4,
      tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined
    };
  }

  // Use individual environment variables
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_PREFIX || 'fanzmoney:',
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    lazyConnect: true,
    keepAlive: parseInt(process.env.REDIS_KEEPALIVE || '30000'),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
    family: 4,
    tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined
  };
}

/**
 * Redis connection class
 */
export class RedisConnection {
  private static instance: RedisConnection;
  private redis: Redis | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
  private config: RedisConfig;

  private constructor() {
    this.config = getRedisConfig();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  /**
   * Initialize Redis connections
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Redis connections...', {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix
      });

      const baseOptions: RedisOptions = {
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        retryDelayOnFailover: this.config.retryDelayOnFailover,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        lazyConnect: this.config.lazyConnect,
        keepAlive: this.config.keepAlive,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        family: this.config.family,
        tls: this.config.tls,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          logger.warn(`Redis retry attempt ${times}, delay: ${delay}ms`);
          return delay;
        }
      };

      // Create main Redis connection
      this.redis = new Redis({
        ...baseOptions,
        showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
      });

      // Create subscriber connection (for pub/sub)
      this.subscriber = new Redis({
        ...baseOptions,
        keyPrefix: '', // No prefix for pub/sub
        showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
      });

      // Create publisher connection (for pub/sub)
      this.publisher = new Redis({
        ...baseOptions,
        keyPrefix: '', // No prefix for pub/sub
        showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
      });

      // Set up event listeners
      this.setupEventListeners();

      // Connect to Redis
      await this.connect();

      logger.info('✅ Redis connections established');

    } catch (error) {
      logger.error('❌ Failed to initialize Redis connections', error);
      throw error;
    }
  }

  /**
   * Set up Redis event listeners
   */
  private setupEventListeners(): void {
    if (!this.redis || !this.subscriber || !this.publisher) return;

    // Main Redis connection events
    this.redis.on('connect', () => {
      logger.info('Redis main connection established');
    });

    this.redis.on('ready', () => {
      logger.info('Redis main connection ready');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis main connection error', error);
    });

    this.redis.on('close', () => {
      logger.warn('Redis main connection closed');
    });

    // Subscriber events
    this.subscriber.on('connect', () => {
      logger.info('Redis subscriber connection established');
    });

    this.subscriber.on('error', (error) => {
      logger.error('Redis subscriber connection error', error);
    });

    // Publisher events
    this.publisher.on('connect', () => {
      logger.info('Redis publisher connection established');
    });

    this.publisher.on('error', (error) => {
      logger.error('Redis publisher connection error', error);
    });
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    if (!this.redis || !this.subscriber || !this.publisher) {
      throw new Error('Redis instances not initialized');
    }

    try {
      await Promise.all([
        this.redis.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);

      // Test connections
      await this.testConnections();

    } catch (error) {
      logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  /**
   * Test Redis connections
   */
  private async testConnections(): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }

    try {
      // Test main connection
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        throw new Error('Redis ping failed');
      }

      // Test subscriber connection
      await this.subscriber?.ping();

      // Test publisher connection
      await this.publisher?.ping();

      logger.info('Redis connection tests successful');
    } catch (error) {
      logger.error('Redis connection tests failed', error);
      throw error;
    }
  }

  /**
   * Get main Redis instance
   */
  public getRedis(): Redis {
    if (!this.redis) {
      throw new Error('Redis not initialized. Call initialize() first.');
    }
    return this.redis;
  }

  /**
   * Get subscriber Redis instance
   */
  public getSubscriber(): Redis {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not initialized. Call initialize() first.');
    }
    return this.subscriber;
  }

  /**
   * Get publisher Redis instance
   */
  public getPublisher(): Redis {
    if (!this.publisher) {
      throw new Error('Redis publisher not initialized. Call initialize() first.');
    }
    return this.publisher;
  }

  /**
   * Cache operations
   */
  public async get(key: string): Promise<string | null> {
    try {
      return await this.redis?.get(key) || null;
    } catch (error) {
      logger.error('Redis GET failed', error, { key });
      return null;
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      if (ttl) {
        await this.redis?.setex(key, ttl, value);
      } else {
        await this.redis?.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET failed', error, { key, ttl });
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis?.del(key);
      return (result || 0) > 0;
    } catch (error) {
      logger.error('Redis DEL failed', error, { key });
      return false;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis?.exists(key);
      return (result || 0) > 0;
    } catch (error) {
      logger.error('Redis EXISTS failed', error, { key });
      return false;
    }
  }

  /**
   * JSON operations
   */
  public async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await this.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis JSON GET failed', error, { key });
      return null;
    }
  }

  public async setJSON<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const jsonValue = JSON.stringify(value);
      return await this.set(key, jsonValue, ttl);
    } catch (error) {
      logger.error('Redis JSON SET failed', error, { key, ttl });
      return false;
    }
  }

  /**
   * Hash operations
   */
  public async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.redis?.hget(key, field) || null;
    } catch (error) {
      logger.error('Redis HGET failed', error, { key, field });
      return null;
    }
  }

  public async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      await this.redis?.hset(key, field, value);
      return true;
    } catch (error) {
      logger.error('Redis HSET failed', error, { key, field });
      return false;
    }
  }

  public async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.redis?.hgetall(key) || {};
    } catch (error) {
      logger.error('Redis HGETALL failed', error, { key });
      return {};
    }
  }

  /**
   * List operations
   */
  public async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.redis?.lpush(key, ...values) || 0;
    } catch (error) {
      logger.error('Redis LPUSH failed', error, { key, values });
      return 0;
    }
  }

  public async rpop(key: string): Promise<string | null> {
    try {
      return await this.redis?.rpop(key) || null;
    } catch (error) {
      logger.error('Redis RPOP failed', error, { key });
      return null;
    }
  }

  /**
   * Set operations
   */
  public async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis?.sadd(key, ...members) || 0;
    } catch (error) {
      logger.error('Redis SADD failed', error, { key, members });
      return 0;
    }
  }

  public async smembers(key: string): Promise<string[]> {
    try {
      return await this.redis?.smembers(key) || [];
    } catch (error) {
      logger.error('Redis SMEMBERS failed', error, { key });
      return [];
    }
  }

  /**
   * Pub/Sub operations
   */
  public async publish(channel: string, message: string): Promise<boolean> {
    try {
      await this.publisher?.publish(channel, message);
      return true;
    } catch (error) {
      logger.error('Redis PUBLISH failed', error, { channel, message });
      return false;
    }
  }

  public async subscribe(channel: string, callback: (message: string) => void): Promise<boolean> {
    try {
      await this.subscriber?.subscribe(channel);
      this.subscriber?.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          callback(message);
        }
      });
      return true;
    } catch (error) {
      logger.error('Redis SUBSCRIBE failed', error, { channel });
      return false;
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    connections?: {
      main: boolean;
      subscriber: boolean;
      publisher: boolean;
    };
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      
      // Test main connection
      const mainPing = this.redis?.ping();
      const subPing = this.subscriber?.ping();
      const pubPing = this.publisher?.ping();

      const results = await Promise.allSettled([mainPing, subPing, pubPing]);
      
      const latency = Date.now() - startTime;

      return {
        healthy: results.every(result => result.status === 'fulfilled'),
        latency,
        connections: {
          main: results[0]?.status === 'fulfilled',
          subscriber: results[1]?.status === 'fulfilled',
          publisher: results[2]?.status === 'fulfilled'
        }
      };
    } catch (error) {
      logger.error('Redis health check failed', error);
      return {
        healthy: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Close Redis connections
   */
  public async close(): Promise<void> {
    logger.info('Closing Redis connections...');

    const closePromises = [];
    
    if (this.redis) {
      closePromises.push(this.redis.disconnect());
    }
    
    if (this.subscriber) {
      closePromises.push(this.subscriber.disconnect());
    }
    
    if (this.publisher) {
      closePromises.push(this.publisher.disconnect());
    }

    await Promise.all(closePromises);

    this.redis = null;
    this.subscriber = null;
    this.publisher = null;

    logger.info('✅ Redis connections closed');
  }

  /**
   * Static methods for easy access
   */
  public static async initialize(): Promise<void> {
    const instance = RedisConnection.getInstance();
    await instance.initialize();
  }

  public static getRedis(): Redis {
    const instance = RedisConnection.getInstance();
    return instance.getRedis();
  }

  public static getSubscriber(): Redis {
    const instance = RedisConnection.getInstance();
    return instance.getSubscriber();
  }

  public static getPublisher(): Redis {
    const instance = RedisConnection.getInstance();
    return instance.getPublisher();
  }

  public static async close(): Promise<void> {
    if (RedisConnection.instance) {
      await RedisConnection.instance.close();
    }
  }
}

// Export convenience functions
export const redis = () => RedisConnection.getRedis();
export const subscriber = () => RedisConnection.getSubscriber();
export const publisher = () => RedisConnection.getPublisher();