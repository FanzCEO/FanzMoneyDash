"use strict";
/**
 * Redis Configuration
 * Connection management for caching, sessions, and real-time features
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publisher = exports.subscriber = exports.redis = exports.RedisConnection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
const logger = new logger_1.Logger('Redis');
/**
 * Parse Redis URL or use individual environment variables
 */
function getRedisConfig() {
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
class RedisConnection {
    static instance;
    redis = null;
    subscriber = null;
    publisher = null;
    config;
    constructor() {
        this.config = getRedisConfig();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!RedisConnection.instance) {
            RedisConnection.instance = new RedisConnection();
        }
        return RedisConnection.instance;
    }
    /**
     * Initialize Redis connections
     */
    async initialize() {
        try {
            logger.info('Initializing Redis connections...', {
                host: this.config.host,
                port: this.config.port,
                db: this.config.db,
                keyPrefix: this.config.keyPrefix
            });
            const baseOptions = {
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
            this.redis = new ioredis_1.default({
                ...baseOptions,
                showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
            });
            // Create subscriber connection (for pub/sub)
            this.subscriber = new ioredis_1.default({
                ...baseOptions,
                keyPrefix: '', // No prefix for pub/sub
                showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
            });
            // Create publisher connection (for pub/sub)
            this.publisher = new ioredis_1.default({
                ...baseOptions,
                keyPrefix: '', // No prefix for pub/sub
                showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
            });
            // Set up event listeners
            this.setupEventListeners();
            // Connect to Redis
            await this.connect();
            logger.info('✅ Redis connections established');
        }
        catch (error) {
            logger.error('❌ Failed to initialize Redis connections', error);
            throw error;
        }
    }
    /**
     * Set up Redis event listeners
     */
    setupEventListeners() {
        if (!this.redis || !this.subscriber || !this.publisher)
            return;
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
    async connect() {
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
        }
        catch (error) {
            logger.error('Failed to connect to Redis', error);
            throw error;
        }
    }
    /**
     * Test Redis connections
     */
    async testConnections() {
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
        }
        catch (error) {
            logger.error('Redis connection tests failed', error);
            throw error;
        }
    }
    /**
     * Get main Redis instance
     */
    getRedis() {
        if (!this.redis) {
            throw new Error('Redis not initialized. Call initialize() first.');
        }
        return this.redis;
    }
    /**
     * Get subscriber Redis instance
     */
    getSubscriber() {
        if (!this.subscriber) {
            throw new Error('Redis subscriber not initialized. Call initialize() first.');
        }
        return this.subscriber;
    }
    /**
     * Get publisher Redis instance
     */
    getPublisher() {
        if (!this.publisher) {
            throw new Error('Redis publisher not initialized. Call initialize() first.');
        }
        return this.publisher;
    }
    /**
     * Cache operations
     */
    async get(key) {
        try {
            return await this.redis?.get(key) || null;
        }
        catch (error) {
            logger.error('Redis GET failed', error, { key });
            return null;
        }
    }
    async set(key, value, ttl) {
        try {
            if (ttl) {
                await this.redis?.setex(key, ttl, value);
            }
            else {
                await this.redis?.set(key, value);
            }
            return true;
        }
        catch (error) {
            logger.error('Redis SET failed', error, { key, ttl });
            return false;
        }
    }
    async del(key) {
        try {
            const result = await this.redis?.del(key);
            return (result || 0) > 0;
        }
        catch (error) {
            logger.error('Redis DEL failed', error, { key });
            return false;
        }
    }
    async exists(key) {
        try {
            const result = await this.redis?.exists(key);
            return (result || 0) > 0;
        }
        catch (error) {
            logger.error('Redis EXISTS failed', error, { key });
            return false;
        }
    }
    /**
     * JSON operations
     */
    async getJSON(key) {
        try {
            const value = await this.get(key);
            return value ? JSON.parse(value) : null;
        }
        catch (error) {
            logger.error('Redis JSON GET failed', error, { key });
            return null;
        }
    }
    async setJSON(key, value, ttl) {
        try {
            const jsonValue = JSON.stringify(value);
            return await this.set(key, jsonValue, ttl);
        }
        catch (error) {
            logger.error('Redis JSON SET failed', error, { key, ttl });
            return false;
        }
    }
    /**
     * Hash operations
     */
    async hget(key, field) {
        try {
            return await this.redis?.hget(key, field) || null;
        }
        catch (error) {
            logger.error('Redis HGET failed', error, { key, field });
            return null;
        }
    }
    async hset(key, field, value) {
        try {
            await this.redis?.hset(key, field, value);
            return true;
        }
        catch (error) {
            logger.error('Redis HSET failed', error, { key, field });
            return false;
        }
    }
    async hgetall(key) {
        try {
            return await this.redis?.hgetall(key) || {};
        }
        catch (error) {
            logger.error('Redis HGETALL failed', error, { key });
            return {};
        }
    }
    /**
     * List operations
     */
    async lpush(key, ...values) {
        try {
            return await this.redis?.lpush(key, ...values) || 0;
        }
        catch (error) {
            logger.error('Redis LPUSH failed', error, { key, values });
            return 0;
        }
    }
    async rpop(key) {
        try {
            return await this.redis?.rpop(key) || null;
        }
        catch (error) {
            logger.error('Redis RPOP failed', error, { key });
            return null;
        }
    }
    /**
     * Set operations
     */
    async sadd(key, ...members) {
        try {
            return await this.redis?.sadd(key, ...members) || 0;
        }
        catch (error) {
            logger.error('Redis SADD failed', error, { key, members });
            return 0;
        }
    }
    async smembers(key) {
        try {
            return await this.redis?.smembers(key) || [];
        }
        catch (error) {
            logger.error('Redis SMEMBERS failed', error, { key });
            return [];
        }
    }
    /**
     * Pub/Sub operations
     */
    async publish(channel, message) {
        try {
            await this.publisher?.publish(channel, message);
            return true;
        }
        catch (error) {
            logger.error('Redis PUBLISH failed', error, { channel, message });
            return false;
        }
    }
    async subscribe(channel, callback) {
        try {
            await this.subscriber?.subscribe(channel);
            this.subscriber?.on('message', (receivedChannel, message) => {
                if (receivedChannel === channel) {
                    callback(message);
                }
            });
            return true;
        }
        catch (error) {
            logger.error('Redis SUBSCRIBE failed', error, { channel });
            return false;
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
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
        }
        catch (error) {
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
    async close() {
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
    static async initialize() {
        const instance = RedisConnection.getInstance();
        await instance.initialize();
    }
    static getRedis() {
        const instance = RedisConnection.getInstance();
        return instance.getRedis();
    }
    static getSubscriber() {
        const instance = RedisConnection.getInstance();
        return instance.getSubscriber();
    }
    static getPublisher() {
        const instance = RedisConnection.getInstance();
        return instance.getPublisher();
    }
    static async close() {
        if (RedisConnection.instance) {
            await RedisConnection.instance.close();
        }
    }
}
exports.RedisConnection = RedisConnection;
// Export convenience functions
const redis = () => RedisConnection.getRedis();
exports.redis = redis;
const subscriber = () => RedisConnection.getSubscriber();
exports.subscriber = subscriber;
const publisher = () => RedisConnection.getPublisher();
exports.publisher = publisher;
//# sourceMappingURL=redis.js.map