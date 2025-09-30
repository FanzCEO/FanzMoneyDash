/**
 * Health Check Utility
 * System health monitoring and status checks
 */
export interface HealthStatus {
    service: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    latency?: number;
    error?: string;
    details?: Record<string, any>;
    timestamp: string;
}
export interface SystemHealth {
    overall: 'healthy' | 'unhealthy' | 'degraded';
    services: HealthStatus[];
    uptime: number;
    timestamp: string;
    environment: string;
    version: string;
}
/**
 * Health Check Manager
 */
export declare class HealthChecker {
    private static instance;
    private healthChecks;
    private lastCheck;
    private checkInterval;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): HealthChecker;
    /**
     * Register default health checks
     */
    private registerDefaultChecks;
    /**
     * Register a custom health check
     */
    registerCheck(name: string, checkFunction: () => Promise<HealthStatus>): void;
    /**
     * Remove a health check
     */
    removeCheck(name: string): void;
    /**
     * Check database health
     */
    private checkDatabase;
    /**
     * Check Redis health
     */
    private checkRedis;
    /**
     * Check memory health
     */
    private checkMemory;
    /**
     * Check disk health (basic check)
     */
    private checkDisk;
    /**
     * Check CPU health
     */
    private checkCPU;
    /**
     * Check process health
     */
    private checkProcess;
    /**
     * Run all health checks
     */
    runHealthChecks(): Promise<SystemHealth>;
    /**
     * Get the last health check result
     */
    getLastHealthCheck(): SystemHealth | null;
    /**
     * Check if a specific service is healthy
     */
    checkService(serviceName: string): Promise<HealthStatus | null>;
    /**
     * Start continuous health monitoring
     */
    startMonitoring(intervalMs?: number): void;
    /**
     * Stop continuous health monitoring
     */
    stopMonitoring(): void;
    /**
     * Get health summary for quick status
     */
    getHealthSummary(): {
        status: string;
        uptime: number;
        lastCheck?: string;
    };
    /**
     * Static method for easy access
     */
    static checkHealth(): Promise<SystemHealth>;
    /**
     * Static method to start monitoring
     */
    static startMonitoring(intervalMs?: number): void;
    /**
     * Static method to stop monitoring
     */
    static stopMonitoring(): void;
}
export declare const checkHealth: () => Promise<SystemHealth>;
export declare const startHealthMonitoring: (intervalMs?: number) => void;
export declare const stopHealthMonitoring: () => void;
export declare const getHealthSummary: () => {
    status: string;
    uptime: number;
    lastCheck?: string;
};
//# sourceMappingURL=health.d.ts.map