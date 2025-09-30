/**
 * Redis Configuration
 * Connection management for caching, sessions, and real-time features
 */
import Redis from 'ioredis';
/**
 * Redis connection class
 */
export declare class RedisConnection {
    private static instance;
    private redis;
    private subscriber;
    private publisher;
    private config;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): RedisConnection;
    /**
     * Initialize Redis connections
     */
    initialize(): Promise<void>;
    /**
     * Set up Redis event listeners
     */
    private setupEventListeners;
    /**
     * Connect to Redis
     */
    private connect;
    /**
     * Test Redis connections
     */
    private testConnections;
    /**
     * Get main Redis instance
     */
    getRedis(): Redis;
    /**
     * Get subscriber Redis instance
     */
    getSubscriber(): Redis;
    /**
     * Get publisher Redis instance
     */
    getPublisher(): Redis;
    /**
     * Cache operations
     */
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttl?: number): Promise<boolean>;
    del(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    /**
     * JSON operations
     */
    getJSON<T>(key: string): Promise<T | null>;
    setJSON<T>(key: string, value: T, ttl?: number): Promise<boolean>;
    /**
     * Hash operations
     */
    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string): Promise<boolean>;
    hgetall(key: string): Promise<Record<string, string>>;
    /**
     * List operations
     */
    lpush(key: string, ...values: string[]): Promise<number>;
    rpop(key: string): Promise<string | null>;
    /**
     * Set operations
     */
    sadd(key: string, ...members: string[]): Promise<number>;
    smembers(key: string): Promise<string[]>;
    /**
     * Pub/Sub operations
     */
    publish(channel: string, message: string): Promise<boolean>;
    subscribe(channel: string, callback: (message: string) => void): Promise<boolean>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        connections?: {
            main: boolean;
            subscriber: boolean;
            publisher: boolean;
        };
        error?: string;
    }>;
    /**
     * Close Redis connections
     */
    close(): Promise<void>;
    /**
     * Static methods for easy access
     */
    static initialize(): Promise<void>;
    static getRedis(): Redis;
    static getSubscriber(): Redis;
    static getPublisher(): Redis;
    static close(): Promise<void>;
}
export declare const redis: () => Redis;
export declare const subscriber: () => Redis;
export declare const publisher: () => Redis;
//# sourceMappingURL=redis.d.ts.map