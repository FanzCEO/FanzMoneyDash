/**
 * FANZ MoneyDash Health Check Endpoints
 * Comprehensive health monitoring for production deployment
 */

import express from 'express';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { performance } from 'perf_hooks';

const router = express.Router();

// Redis client for health checks
let redisClient;
try {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
} catch (error) {
  console.warn('Redis client initialization failed:', error.message);
}

/**
 * Basic health check endpoint
 * Used by Docker health checks and load balancers
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'fanz-money-dash',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    }
  });
});

/**
 * Detailed health check with dependency status
 * Used for monitoring and alerting systems
 */
router.get('/health/detailed', async (req, res) => {
  const startTime = performance.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'fanz-money-dash',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    checks: {},
    performance: {},
    system: {}
  };

  try {
    // Database connectivity check
    health.checks.database = await checkDatabase();
    
    // Redis connectivity check
    health.checks.redis = await checkRedis();
    
    // File system check
    health.checks.filesystem = await checkFileSystem();
    
    // External services check
    health.checks.external = await checkExternalServices();

    // Performance metrics
    health.performance = {
      responseTime: Math.round(performance.now() - startTime),
      cpuUsage: process.cpuUsage(),
      eventLoopDelay: await getEventLoopDelay()
    };

    // System information
    health.system = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
      memory: process.memoryUsage(),
      loadAverage: process.platform !== 'win32' ? process.loadavg() : null
    };

    // Determine overall health status
    const allChecksHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
    health.status = allChecksHealthy ? 'healthy' : 'degraded';

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    console.error('Health check failed:', error);
    health.status = 'unhealthy';
    health.error = error.message;
    res.status(503).json(health);
  }
});

/**
 * Readiness probe for Kubernetes/Docker
 * Checks if the application is ready to receive traffic
 */
router.get('/ready', async (req, res) => {
  try {
    // Check critical dependencies
    const dbCheck = await checkDatabase();
    const redisCheck = await checkRedis();

    if (dbCheck.status === 'healthy' && redisCheck.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        message: 'Service is ready to receive traffic'
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        message: 'Service is not ready - dependencies unavailable',
        checks: { database: dbCheck, redis: redisCheck }
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Liveness probe for Kubernetes/Docker
 * Checks if the application is alive and functioning
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    service: 'fanz-money-dash',
    pid: process.pid,
    uptime: Math.floor(process.uptime())
  });
});

/**
 * Database connectivity check
 */
async function checkDatabase() {
  try {
    const startTime = performance.now();
    
    if (mongoose.connection.readyState !== 1) {
      return {
        status: 'unhealthy',
        message: 'Database connection not established',
        responseTime: null
      };
    }

    // Perform a simple query to test connectivity
    await mongoose.connection.db.admin().ping();
    
    return {
      status: 'healthy',
      message: 'Database connection successful',
      responseTime: Math.round(performance.now() - startTime),
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database check failed: ${error.message}`,
      responseTime: null
    };
  }
}

/**
 * Redis connectivity check
 */
async function checkRedis() {
  try {
    if (!redisClient) {
      return {
        status: 'unhealthy',
        message: 'Redis client not initialized',
        responseTime: null
      };
    }

    const startTime = performance.now();
    
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    // Perform a simple ping to test connectivity
    await redisClient.ping();
    
    return {
      status: 'healthy',
      message: 'Redis connection successful',
      responseTime: Math.round(performance.now() - startTime),
      connected: redisClient.isOpen
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Redis check failed: ${error.message}`,
      responseTime: null
    };
  }
}

/**
 * File system accessibility check
 */
async function checkFileSystem() {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const startTime = performance.now();

    // Check if we can read/write to the logs directory
    const logDir = path.join(process.cwd(), 'logs');
    const testFile = path.join(logDir, 'health-check.tmp');
    
    // Ensure logs directory exists
    await fs.mkdir(logDir, { recursive: true });
    
    // Write test file
    await fs.writeFile(testFile, 'health-check', 'utf8');
    
    // Read test file
    await fs.readFile(testFile, 'utf8');
    
    // Clean up
    await fs.unlink(testFile);

    return {
      status: 'healthy',
      message: 'File system access successful',
      responseTime: Math.round(performance.now() - startTime)
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `File system check failed: ${error.message}`,
      responseTime: null
    };
  }
}

/**
 * External services connectivity check
 */
async function checkExternalServices() {
  const services = {};
  
  try {
    // Check OpenAI API if configured
    if (process.env.OPENAI_API_KEY) {
      services.openai = await checkHttpService('https://api.openai.com/v1/models', {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      });
    }

    // Check payment processors if configured
    if (process.env.STRIPE_SECRET_KEY) {
      services.stripe = await checkHttpService('https://api.stripe.com/v1/account', {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
      });
    }

    return {
      status: Object.values(services).every(s => s.status === 'healthy') ? 'healthy' : 'degraded',
      services
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `External services check failed: ${error.message}`,
      services
    };
  }
}

/**
 * HTTP service connectivity check
 */
async function checkHttpService(url, headers = {}) {
  try {
    const startTime = performance.now();
    const response = await fetch(url, {
      method: 'GET',
      headers,
      timeout: 5000
    });

    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      responseTime: Math.round(performance.now() - startTime),
      statusCode: response.status,
      url: url.replace(/\/\/.*@/, '//***:***@') // Hide credentials
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
      responseTime: null,
      url: url.replace(/\/\/.*@/, '//***:***@')
    };
  }
}

/**
 * Get event loop delay
 */
async function getEventLoopDelay() {
  return new Promise((resolve) => {
    const start = performance.now();
    setImmediate(() => {
      resolve(Math.round(performance.now() - start));
    });
  });
}

/**
 * Metrics endpoint for monitoring systems
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      service: 'fanz-money-dash',
      
      // Process metrics
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        ppid: process.ppid,
        platform: process.platform,
        arch: process.arch,
        version: process.version
      },
      
      // Memory metrics
      memory: process.memoryUsage(),
      
      // CPU metrics
      cpu: process.cpuUsage(),
      
      // Event loop metrics
      eventLoop: {
        delay: await getEventLoopDelay()
      },
      
      // System metrics (if available)
      system: process.platform !== 'win32' ? {
        loadAverage: process.loadavg()
      } : null
    };

    res.set('Content-Type', 'application/json');
    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;