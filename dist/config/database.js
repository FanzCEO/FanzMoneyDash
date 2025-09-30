"use strict";
/**
 * Database Configuration
 * PostgreSQL connection management with Drizzle ORM
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = exports.db = exports.DatabaseConnection = void 0;
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const logger_1 = require("../utils/logger");
// Import schema for type safety
const schema = __importStar(require("../shared/financial-schema"));
const logger = new logger_1.Logger('Database');
/**
 * Parse database URL or use individual environment variables
 */
function getDatabaseConfig() {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
        // Parse DATABASE_URL
        const url = new URL(databaseUrl);
        return {
            host: url.hostname,
            port: parseInt(url.port) || 5432,
            database: url.pathname.slice(1), // Remove leading slash
            username: url.username,
            password: url.password,
            ssl: process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production',
            poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
            connectionTimeout: parseInt(process.env.DATABASE_TIMEOUT || '30'),
            idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '600'),
            maxLifetime: parseInt(process.env.DATABASE_MAX_LIFETIME || '3600')
        };
    }
    // Use individual environment variables
    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'fanzmoney',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production',
        poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
        connectionTimeout: parseInt(process.env.DATABASE_TIMEOUT || '30'),
        idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '600'),
        maxLifetime: parseInt(process.env.DATABASE_MAX_LIFETIME || '3600')
    };
}
/**
 * Database connection class
 */
class DatabaseConnection {
    static instance;
    sql = null;
    db = null;
    config;
    constructor() {
        this.config = getDatabaseConfig();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }
    /**
     * Initialize database connection
     */
    async initialize() {
        try {
            logger.info('Initializing database connection...', {
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                username: this.config.username,
                ssl: this.config.ssl
            });
            // Create postgres connection
            this.sql = (0, postgres_1.default)({
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                username: this.config.username,
                password: this.config.password,
                ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
                max: this.config.poolSize,
                idle_timeout: this.config.idleTimeout,
                max_lifetime: this.config.maxLifetime,
                connect_timeout: this.config.connectionTimeout,
                onnotice: (notice) => {
                    if (process.env.DEBUG_SQL === 'true') {
                        logger.debug('PostgreSQL notice:', { notice: notice.message });
                    }
                },
                onnotify: (relation, condition, row) => {
                    if (process.env.DEBUG_SQL === 'true') {
                        logger.debug('PostgreSQL notification:', { relation, condition, row });
                    }
                }
            });
            // Create Drizzle instance with schema
            this.db = (0, postgres_js_1.drizzle)(this.sql, { schema });
            // Test connection
            await this.testConnection();
            logger.info('✅ Database connection established');
        }
        catch (error) {
            logger.error('❌ Failed to initialize database connection', error);
            throw error;
        }
    }
    /**
     * Test database connection
     */
    async testConnection() {
        if (!this.sql) {
            throw new Error('Database not initialized');
        }
        try {
            const result = await this.sql `SELECT NOW() as current_time, version() as version`;
            logger.info('Database connection test successful', {
                timestamp: result[0]?.current_time,
                version: result[0]?.version?.split(' ')[0] // Just get PostgreSQL version number
            });
        }
        catch (error) {
            logger.error('Database connection test failed', error);
            throw error;
        }
    }
    /**
     * Get Drizzle database instance
     */
    getDb() {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }
    /**
     * Get raw SQL connection
     */
    getSql() {
        if (!this.sql) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.sql;
    }
    /**
     * Execute raw SQL query
     */
    async query(sql, params) {
        if (!this.sql) {
            throw new Error('Database not initialized');
        }
        try {
            const startTime = Date.now();
            const result = await this.sql.unsafe(sql, params);
            const duration = Date.now() - startTime;
            if (process.env.DEBUG_SQL === 'true') {
                logger.debug('SQL Query executed', {
                    sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
                    duration: `${duration}ms`,
                    rows: Array.isArray(result) ? result.length : 'N/A'
                });
            }
            logger.performance('database_query', {
                duration,
                query: sql.substring(0, 50) + (sql.length > 50 ? '...' : ''),
                rows: Array.isArray(result) ? result.length : 0
            });
            return result;
        }
        catch (error) {
            logger.error('SQL query failed', error, { sql, params });
            throw error;
        }
    }
    /**
     * Insert record
     */
    async insert(table, data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const result = await this.query(sql, values);
        return result[0];
    }
    /**
     * Update record
     */
    async update(table, id, data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');
        const sql = `UPDATE ${table} SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`;
        const result = await this.query(sql, [...values, id]);
        return result[0];
    }
    /**
     * Delete record
     */
    async delete(table, id) {
        const sql = `DELETE FROM ${table} WHERE id = $1`;
        const result = await this.query(sql, [id]);
        return result.length > 0;
    }
    /**
     * Check database health
     */
    async healthCheck() {
        try {
            const startTime = Date.now();
            // Test basic connectivity
            await this.query('SELECT 1');
            // Get connection stats
            const stats = await this.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
            const latency = Date.now() - startTime;
            return {
                healthy: true,
                latency,
                connections: stats[0]?.total_connections
            };
        }
        catch (error) {
            logger.error('Database health check failed', error);
            return {
                healthy: false,
                latency: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Close database connection
     */
    async close() {
        if (this.sql) {
            logger.info('Closing database connection...');
            await this.sql.end();
            this.sql = null;
            this.db = null;
            logger.info('✅ Database connection closed');
        }
    }
    /**
     * Static method for easy access
     */
    static async initialize() {
        const instance = DatabaseConnection.getInstance();
        await instance.initialize();
    }
    /**
     * Static method for easy access to database
     */
    static getDatabase() {
        const instance = DatabaseConnection.getInstance();
        return instance.getDb();
    }
    /**
     * Static method for easy access to SQL
     */
    static getSQL() {
        const instance = DatabaseConnection.getInstance();
        return instance.getSql();
    }
    /**
     * Static method for closing connection
     */
    static async close() {
        if (DatabaseConnection.instance) {
            await DatabaseConnection.instance.close();
        }
    }
}
exports.DatabaseConnection = DatabaseConnection;
// Export convenience functions
const db = () => DatabaseConnection.getDatabase();
exports.db = db;
const sql = () => DatabaseConnection.getSQL();
exports.sql = sql;
//# sourceMappingURL=database.js.map