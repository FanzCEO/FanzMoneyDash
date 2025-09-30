/**
 * Health Check Utility
 * System health monitoring and status checks
 */

import { Logger } from './logger';
import { DatabaseConnection } from '../config/database';
import { RedisConnection } from '../config/redis';

const logger = new Logger('HealthCheck');

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
export class HealthChecker {
  private static instance: HealthChecker;
  private healthChecks: Map<string, () => Promise<HealthStatus>> = new Map();
  private lastCheck: SystemHealth | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.registerDefaultChecks();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
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
  public registerCheck(name: string, checkFunction: () => Promise<HealthStatus>): void {
    this.healthChecks.set(name, checkFunction);
    logger.debug(`Registered health check: ${name}`);
  }

  /**
   * Remove a health check
   */
  public removeCheck(name: string): void {
    this.healthChecks.delete(name);
    logger.debug(`Removed health check: ${name}`);
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const dbConnection = DatabaseConnection.getInstance();
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
    } catch (error) {
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
  private async checkRedis(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const redisConnection = RedisConnection.getInstance();
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
    } catch (error) {
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
  private async checkMemory(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal;
      const usedMem = memUsage.heapUsed;
      const freeMem = totalMem - usedMem;
      const memoryUsagePercent = (usedMem / totalMem) * 100;

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      
      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
      } else if (memoryUsagePercent > 80) {
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
    } catch (error) {
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
  private async checkDisk(): Promise<HealthStatus> {
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
    } catch (error) {
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
  private async checkCPU(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();
      
      // Calculate CPU usage as a percentage
      const userCPU = cpuUsage.user / 1000000; // Convert to seconds
      const systemCPU = cpuUsage.system / 1000000; // Convert to seconds
      const totalCPU = userCPU + systemCPU;
      const cpuPercent = (totalCPU / uptime) * 100;

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      
      if (cpuPercent > 90) {
        status = 'unhealthy';
      } else if (cpuPercent > 80) {
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
    } catch (error) {
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
  private async checkProcess(): Promise<HealthStatus> {
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
    } catch (error) {
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
  public async runHealthChecks(): Promise<SystemHealth> {
    const checkStart = Date.now();
    
    try {
      // Run all registered health checks in parallel
      const checkPromises = Array.from(this.healthChecks.entries()).map(async ([name, checkFunction]) => {
        try {
          return await checkFunction();
        } catch (error) {
          logger.error(`Health check failed for ${name}:`, error);
          return {
            service: name,
            status: 'unhealthy' as const,
            error: error instanceof Error ? error.message : 'Check failed',
            timestamp: new Date().toISOString()
          };
        }
      });

      const serviceResults = await Promise.all(checkPromises);

      // Determine overall health status
      const unhealthyServices = serviceResults.filter(result => result.status === 'unhealthy');
      const degradedServices = serviceResults.filter(result => result.status === 'degraded');

      let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
      
      if (unhealthyServices.length > 0) {
        overallStatus = 'unhealthy';
      } else if (degradedServices.length > 0) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'healthy';
      }

      const systemHealth: SystemHealth = {
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
      
    } catch (error) {
      logger.error('Failed to run health checks:', error);
      
      const errorHealth: SystemHealth = {
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
  public getLastHealthCheck(): SystemHealth | null {
    return this.lastCheck;
  }

  /**
   * Check if a specific service is healthy
   */
  public async checkService(serviceName: string): Promise<HealthStatus | null> {
    const checkFunction = this.healthChecks.get(serviceName);
    if (!checkFunction) {
      logger.warn(`No health check registered for service: ${serviceName}`);
      return null;
    }

    try {
      return await checkFunction();
    } catch (error) {
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
  public startMonitoring(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      this.stopMonitoring();
    }

    logger.info(`Starting health monitoring with ${intervalMs}ms interval`);
    
    this.checkInterval = setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
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
  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Stopped health monitoring');
    }
  }

  /**
   * Get health summary for quick status
   */
  public getHealthSummary(): {
    status: string;
    uptime: number;
    lastCheck?: string;
  } {
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
  public static async checkHealth(): Promise<SystemHealth> {
    const instance = HealthChecker.getInstance();
    return instance.runHealthChecks();
  }

  /**
   * Static method to start monitoring
   */
  public static startMonitoring(intervalMs?: number): void {
    const instance = HealthChecker.getInstance();
    instance.startMonitoring(intervalMs);
  }

  /**
   * Static method to stop monitoring
   */
  public static stopMonitoring(): void {
    const instance = HealthChecker.getInstance();
    instance.stopMonitoring();
  }
}

// Export convenience functions
export const checkHealth = () => HealthChecker.checkHealth();
export const startHealthMonitoring = (intervalMs?: number) => HealthChecker.startMonitoring(intervalMs);
export const stopHealthMonitoring = () => HealthChecker.stopMonitoring();
export const getHealthSummary = () => HealthChecker.getInstance().getHealthSummary();