"use strict";
/**
 * Health Check Utility
 * System health monitoring and status checks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealthSummary = exports.stopHealthMonitoring = exports.startHealthMonitoring = exports.checkHealth = exports.HealthChecker = void 0;
const logger_1 = require("./logger");
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const logger = new logger_1.Logger('HealthCheck');
/**
 * Health Check Manager
 */
class HealthChecker {
    static instance;
    healthChecks = new Map();
    lastCheck = null;
    checkInterval = null;
    constructor() {
        this.registerDefaultChecks();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!HealthChecker.instance) {
            HealthChecker.instance = new HealthChecker();
        }
        return HealthChecker.instance;
    }
    /**
     * Register default health checks
     */
    registerDefaultChecks() {
        // Database health check
        this.registerCheck('database', this.checkDatabase.bind(this));
        // Redis health check
        this.registerCheck('redis', this.checkRedis.bind(this));
        // Memory health check
        this.registerCheck('memory', this.checkMemory.bind(this));
        // Disk health check
        this.registerCheck('disk', this.checkDisk.bind(this));
        // CPU health check
        this.registerCheck('cpu', this.checkCPU.bind(this));
        // Process health check
        this.registerCheck('process', this.checkProcess.bind(this));
    }
    /**
     * Register a custom health check
     */
    registerCheck(name, checkFunction) {
        this.healthChecks.set(name, checkFunction);
        logger.debug(`Registered health check: ${name}`);
    }
    /**
     * Remove a health check
     */
    removeCheck(name) {
        this.healthChecks.delete(name);
        logger.debug(`Removed health check: ${name}`);
    }
    /**
     * Check database health
     */
    async checkDatabase() {
        const startTime = Date.now();
        try {
            const dbConnection = database_1.DatabaseConnection.getInstance();
            const result = await dbConnection.healthCheck();
            return {
                service: 'database',
                status: result.healthy ? 'healthy' : 'unhealthy',
                latency: result.latency,
                error: result.error,
                details: {
                    connections: result.connections
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                service: 'database',
                status: 'unhealthy',
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown database error',
                timestamp: new Date().toISOString()
            };
        }
    }
    /**
     * Check Redis health
     */
    async checkRedis() {
        const startTime = Date.now();
        try {
            const redisConnection = redis_1.RedisConnection.getInstance();
            const result = await redisConnection.healthCheck();
            return {
                service: 'redis',
                status: result.healthy ? 'healthy' : 'unhealthy',
                latency: result.latency,
                error: result.error,
                details: {
                    connections: result.connections
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                service: 'redis',
                status: 'unhealthy',
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown Redis error',
                timestamp: new Date().toISOString()
            };
        }
    }
    /**
     * Check memory health
     */
    async checkMemory() {
        const startTime = Date.now();
        try {
            const memUsage = process.memoryUsage();
            const totalMem = memUsage.heapTotal;
            const usedMem = memUsage.heapUsed;
            const freeMem = totalMem - usedMem;
            const memoryUsagePercent = (usedMem / totalMem) * 100;
            let status = 'healthy';
            if (memoryUsagePercent > 90) {
                status = 'unhealthy';
            }
            else if (memoryUsagePercent > 80) {
                status = 'degraded';
            }
            return {
                service: 'memory',
                status,
                latency: Date.now() - startTime,
                details: {
                    heapUsed: Math.round(usedMem / 1024 / 1024), // MB
                    heapTotal: Math.round(totalMem / 1024 / 1024), // MB
                    heapFree: Math.round(freeMem / 1024 / 1024), // MB
                    usagePercent: Math.round(memoryUsagePercent * 100) / 100,
                    external: Math.round(memUsage.external / 1024 / 1024), // MB
                    rss: Math.round(memUsage.rss / 1024 / 1024) // MB
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                service: 'memory',
                status: 'unhealthy',
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Memory check failed',
                timestamp: new Date().toISOString()
            };
        }
    }
    /**
     * Check disk health (basic check)
     */
    async checkDisk() {
        const startTime = Date.now();
        try {
            const fs = require('fs').promises;
            const stats = await fs.statSync('.');
            // Basic disk check - just verify we can access the filesystem
            return {
                service: 'disk',
                status: 'healthy',
                latency: Date.now() - startTime,
                details: {
                    accessible: true
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                service: 'disk',
                status: 'unhealthy',
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Disk check failed',
                timestamp: new Date().toISOString()
            };
        }
    }
    /**
     * Check CPU health
     */
    async checkCPU() {
        const startTime = Date.now();
        try {
            const cpuUsage = process.cpuUsage();
            const uptime = process.uptime();
            // Calculate CPU usage as a percentage
            const userCPU = cpuUsage.user / 1000000; // Convert to seconds
            const systemCPU = cpuUsage.system / 1000000; // Convert to seconds
            const totalCPU = userCPU + systemCPU;
            const cpuPercent = (totalCPU / uptime) * 100;
            let status = 'healthy';
            if (cpuPercent > 90) {
                status = 'unhealthy';
            }
            else if (cpuPercent > 80) {
                status = 'degraded';
            }
            return {
                service: 'cpu',
                status,
                latency: Date.now() - startTime,
                details: {
                    usagePercent: Math.round(cpuPercent * 100) / 100,
                    userTime: Math.round(userCPU * 1000) / 1000,
                    systemTime: Math.round(systemCPU * 1000) / 1000,
                    uptime: Math.round(uptime)
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                service: 'cpu',
                status: 'unhealthy',
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'CPU check failed',
                timestamp: new Date().toISOString()
            };
        }
    }
    /**
     * Check process health
     */
    async checkProcess() {
        const startTime = Date.now();
        try {
            const uptime = process.uptime();
            const version = process.version;
            const pid = process.pid;
            const platform = process.platform;
            const arch = process.arch;
            return {
                service: 'process',
                status: 'healthy',
                latency: Date.now() - startTime,
                details: {
                    pid,
                    uptime: Math.round(uptime),
                    version,
                    platform,
                    arch,
                    nodeEnv: process.env.NODE_ENV
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                service: 'process',
                status: 'unhealthy',
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Process check failed',
                timestamp: new Date().toISOString()
            };
        }
    }
    /**
     * Run all health checks
     */
    async runHealthChecks() {
        const checkStart = Date.now();
        try {
            // Run all registered health checks in parallel
            const checkPromises = Array.from(this.healthChecks.entries()).map(async ([name, checkFunction]) => {
                try {
                    return await checkFunction();
                }
                catch (error) {
                    logger.error(`Health check failed for ${name}:`, error);
                    return {
                        service: name,
                        status: 'unhealthy',
                        error: error instanceof Error ? error.message : 'Check failed',
                        timestamp: new Date().toISOString()
                    };
                }
            });
            const serviceResults = await Promise.all(checkPromises);
            // Determine overall health status
            const unhealthyServices = serviceResults.filter(result => result.status === 'unhealthy');
            const degradedServices = serviceResults.filter(result => result.status === 'degraded');
            let overallStatus;
            if (unhealthyServices.length > 0) {
                overallStatus = 'unhealthy';
            }
            else if (degradedServices.length > 0) {
                overallStatus = 'degraded';
            }
            else {
                overallStatus = 'healthy';
            }
            const systemHealth = {
                overall: overallStatus,
                services: serviceResults,
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development',
                version: process.env.npm_package_version || '1.0.0'
            };
            this.lastCheck = systemHealth;
            // Log health status
            const checkDuration = Date.now() - checkStart;
            logger.health('System health check completed', {
                overall: overallStatus,
                duration: checkDuration,
                services: serviceResults.length,
                unhealthy: unhealthyServices.length,
                degraded: degradedServices.length
            });
            return systemHealth;
        }
        catch (error) {
            logger.error('Failed to run health checks:', error);
            const errorHealth = {
                overall: 'unhealthy',
                services: [{
                        service: 'health-checker',
                        status: 'unhealthy',
                        error: error instanceof Error ? error.message : 'Health check system failed',
                        timestamp: new Date().toISOString()
                    }],
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development',
                version: process.env.npm_package_version || '1.0.0'
            };
            this.lastCheck = errorHealth;
            return errorHealth;
        }
    }
    /**
     * Get the last health check result
     */
    getLastHealthCheck() {
        return this.lastCheck;
    }
    /**
     * Check if a specific service is healthy
     */
    async checkService(serviceName) {
        const checkFunction = this.healthChecks.get(serviceName);
        if (!checkFunction) {
            logger.warn(`No health check registered for service: ${serviceName}`);
            return null;
        }
        try {
            return await checkFunction();
        }
        catch (error) {
            logger.error(`Health check failed for ${serviceName}:`, error);
            return {
                service: serviceName,
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Check failed',
                timestamp: new Date().toISOString()
            };
        }
    }
    /**
     * Start continuous health monitoring
     */
    startMonitoring(intervalMs = 30000) {
        if (this.checkInterval) {
            this.stopMonitoring();
        }
        logger.info(`Starting health monitoring with ${intervalMs}ms interval`);
        this.checkInterval = setInterval(async () => {
            try {
                await this.runHealthChecks();
            }
            catch (error) {
                logger.error('Error during scheduled health check:', error);
            }
        }, intervalMs);
        // Run initial health check
        this.runHealthChecks().catch(error => {
            logger.error('Error during initial health check:', error);
        });
    }
    /**
     * Stop continuous health monitoring
     */
    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.info('Stopped health monitoring');
        }
    }
    /**
     * Get health summary for quick status
     */
    getHealthSummary() {
        const lastCheck = this.getLastHealthCheck();
        return {
            status: lastCheck?.overall || 'unknown',
            uptime: process.uptime(),
            lastCheck: lastCheck?.timestamp
        };
    }
    /**
     * Static method for easy access
     */
    static async checkHealth() {
        const instance = HealthChecker.getInstance();
        return instance.runHealthChecks();
    }
    /**
     * Static method to start monitoring
     */
    static startMonitoring(intervalMs) {
        const instance = HealthChecker.getInstance();
        instance.startMonitoring(intervalMs);
    }
    /**
     * Static method to stop monitoring
     */
    static stopMonitoring() {
        const instance = HealthChecker.getInstance();
        instance.stopMonitoring();
    }
}
exports.HealthChecker = HealthChecker;
// Export convenience functions
const checkHealth = () => HealthChecker.checkHealth();
exports.checkHealth = checkHealth;
const startHealthMonitoring = (intervalMs) => HealthChecker.startMonitoring(intervalMs);
exports.startHealthMonitoring = startHealthMonitoring;
const stopHealthMonitoring = () => HealthChecker.stopMonitoring();
exports.stopHealthMonitoring = stopHealthMonitoring;
const getHealthSummary = () => HealthChecker.getInstance().getHealthSummary();
exports.getHealthSummary = getHealthSummary;
//# sourceMappingURL=health.js.map