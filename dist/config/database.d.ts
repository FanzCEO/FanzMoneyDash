/**
 * Database Configuration
 * PostgreSQL connection management with Drizzle ORM
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
/**
 * Database connection class
 */
export declare class DatabaseConnection {
    private static instance;
    private sql;
    private db;
    private config;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): DatabaseConnection;
    /**
     * Initialize database connection
     */
    initialize(): Promise<void>;
    /**
     * Test database connection
     */
    private testConnection;
    /**
     * Get Drizzle database instance
     */
    getDb(): ReturnType<typeof drizzle>;
    /**
     * Get raw SQL connection
     */
    getSql(): postgres.Sql;
    /**
     * Execute raw SQL query
     */
    query(sql: string, params?: any[]): Promise<any[]>;
    /**
     * Insert record
     */
    insert(table: string, data: Record<string, any>): Promise<any>;
    /**
     * Update record
     */
    update(table: string, id: string, data: Record<string, any>): Promise<any>;
    /**
     * Delete record
     */
    delete(table: string, id: string): Promise<boolean>;
    /**
     * Check database health
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        connections?: number;
        error?: string;
    }>;
    /**
     * Close database connection
     */
    close(): Promise<void>;
    /**
     * Static method for easy access
     */
    static initialize(): Promise<void>;
    /**
     * Static method for easy access to database
     */
    static getDatabase(): ReturnType<typeof drizzle>;
    /**
     * Static method for easy access to SQL
     */
    static getSQL(): postgres.Sql;
    /**
     * Static method for closing connection
     */
    static close(): Promise<void>;
}
export declare const db: () => import("drizzle-orm/postgres-js").PostgresJsDatabase<Record<string, unknown>>;
export declare const sql: () => postgres.Sql<{}>;
//# sourceMappingURL=database.d.ts.map