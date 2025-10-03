/**
 * FanzMoneyDash - Advanced Financial Platform for Creator Economy
 * Main Application Entry Point
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Core configuration and utilities
import { getConfig } from './config/app';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { Logger } from './utils/logger';

// Middleware
import { authMiddleware } from './middleware/auth';
import { securityMiddleware } from './middleware/security';

// Core services
import { RevenueOptimizationService } from './services/revenue-optimization';
import { RealTimeAnalytics } from './services/realtime-analytics';
import { FraudDetectionService } from './services/fraud-detection';
import { NFTMarketplaceService } from './services/nft-marketplace';
import { ComplianceEngine } from './services/compliance-engine';
import { MobileSDK } from './services/mobile-sdk';
import { AdvancedSecurityService } from './services/advanced-security';

class FanzMoneyDashApp {
  private app: express.Application;
  private server: any;
  private logger: Logger;
  private config = getConfig();
  
  // Database connections
  private database: any;
  private redis: any;
  
  // Advanced services
  private revenueOptimization: RevenueOptimizationService;
  private realTimeAnalytics: RealTimeAnalytics;
  private fraudDetection: FraudDetectionService;
  private nftMarketplace: NFTMarketplaceService;
  private complianceEngine: ComplianceEngine;
  private mobileSDK: MobileSDK;
  private advancedSecurity: AdvancedSecurityService;

  constructor() {
    this.app = express();
    this.logger = new Logger('FanzMoneyDash');
    this.setupMiddleware();
  }

  /**
   * Initialize application with all services and connections
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('🚀 Initializing FanzMoneyDash...');

      // Initialize database connections
      await this.initializeDatabases();

      // Initialize advanced services
      await this.initializeServices();

      // Setup API routes
      this.setupRoutes();

      // Create HTTP server
      this.server = createServer(this.app);

      // Initialize real-time analytics with WebSocket support
      this.realTimeAnalytics = new RealTimeAnalytics(
        this.server,
        this.database,
        this.redis
      );

      this.logger.info('✅ FanzMoneyDash initialized successfully');

    } catch (error) {
      this.logger.error('❌ Failed to initialize FanzMoneyDash', { error: error.message });
      throw error;
    }
  }

  /**
   * Start the application server
   */
  async start(): Promise<void> {
    try {
      const port = this.config.server.port;
      
      this.server.listen(port, () => {
        this.logger.info(`🌟 FanzMoneyDash running on port ${port}`, {
          environment: this.config.environment,
          version: process.env.npm_package_version || '1.0.0',
          services: {
            revenueOptimization: 'active',
            realTimeAnalytics: 'active',
            fraudDetection: 'active',
            nftMarketplace: 'active'
          }
        });
      });

      // Handle graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('❌ Failed to start server', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup Express middleware stack
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "wss:", "ws:"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.security.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));

    // Rate limiting
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Custom middleware
    this.app.use(securityMiddleware);

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info('📤 Request received', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  /**
   * Initialize database connections
   */
  private async initializeDatabases(): Promise<void> {
    try {
      this.logger.info('🔗 Connecting to databases...');

      // Connect to primary database
      this.database = await connectDatabase();
      this.logger.info('✅ Database connected');

      // Connect to Redis
      this.redis = await connectRedis();
      this.logger.info('✅ Redis connected');

    } catch (error) {
      this.logger.error('❌ Database connection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize all advanced services
   */
  private async initializeServices(): Promise<void> {
    try {
      this.logger.info('⚙️ Initializing advanced services...');

      // Initialize AI-powered revenue optimization
      this.revenueOptimization = new RevenueOptimizationService(
        this.database,
        this.redis
      );
      this.logger.info('✅ Revenue Optimization Service initialized');

      // Initialize fraud detection with ML and computer vision
      this.fraudDetection = new FraudDetectionService(
        this.database,
        this.redis
      );
      this.logger.info('✅ Fraud Detection Service initialized');

      // Initialize NFT marketplace with blockchain integration
      this.nftMarketplace = new NFTMarketplaceService(
        this.database,
        this.redis
      );
      this.logger.info('✅ NFT Marketplace Service initialized');

      // Initialize compliance engine for regulatory operations
      this.complianceEngine = new ComplianceEngine(
        this.database,
        this.redis
      );
      this.logger.info('✅ Compliance Engine initialized');

      // Initialize mobile SDK for cross-platform integration
      this.mobileSDK = new MobileSDK(
        this.database,
        this.redis
      );
      this.logger.info('✅ Mobile SDK initialized');

      // Initialize advanced security service
      this.advancedSecurity = new AdvancedSecurityService(
        this.database,
        this.redis
      );
      this.logger.info('✅ Advanced Security Service initialized');

      this.logger.info('🎉 All advanced services initialized successfully');

    } catch (error) {
      this.logger.error('❌ Service initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup API routes and endpoints
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          database: this.database ? 'connected' : 'disconnected',
          redis: this.redis ? 'connected' : 'disconnected',
          revenueOptimization: 'active',
          fraudDetection: 'active',
          nftMarketplace: 'active',
          realTimeAnalytics: 'active',
          complianceEngine: 'active',
          mobileSDK: 'active',
          advancedSecurity: 'active'
        }
      });
    });

    // API version info
    this.app.get('/api/v1/info', (req, res) => {
      res.json({
        name: 'FanzMoneyDash',
        version: '1.0.0',
        description: 'Advanced Financial Platform for Creator Economy',
        features: [
          'AI-Powered Revenue Optimization',
          'Real-time Financial Analytics',
          'Advanced Fraud Detection with Computer Vision',
          'Blockchain NFT Marketplace',
          'Cross-platform Payment Processing',
          'Creator Financial Assistant',
          'Automated Compliance Engine',
          'Cross-platform Mobile SDK',
          'Real-time Creator Collaboration',
          'Zero-trust Security Architecture',
          'Quantum-resistant Encryption'
        ],
        platforms: ['BoyFanz', 'GirlFanz', 'PupFanz'],
        documentation: '/docs'
      });
    });

    // Revenue Optimization API
    this.app.use('/api/v1/revenue', authMiddleware, this.createRevenueRoutes());

    // Real-time Analytics API
    this.app.use('/api/v1/analytics', authMiddleware, this.createAnalyticsRoutes());

    // Fraud Detection API
    this.app.use('/api/v1/fraud', authMiddleware, this.createFraudRoutes());

    // NFT Marketplace API
    this.app.use('/api/v1/nft', authMiddleware, this.createNFTRoutes());

    // Compliance Engine API
    this.app.use('/api/v1/compliance', authMiddleware, this.createComplianceRoutes());

    // Mobile SDK API
    this.app.use('/api/v1/mobile', authMiddleware, this.createMobileRoutes());

    // Advanced Security API
    this.app.use('/api/v1/security', authMiddleware, this.createSecurityRoutes());

    // WebSocket endpoint info
    this.app.get('/api/v1/websocket', (req, res) => {
      res.json({
        endpoint: '/socket.io',
        events: [
          'financial_metrics',
          'user_activity',
          'transactions',
          'predictions',
          'alerts',
          'nft_updates'
        ],
        authentication: 'required'
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        message: `${req.method} ${req.originalUrl} is not a valid endpoint`,
        availableEndpoints: [
          'GET /health',
          'GET /api/v1/info',
          'POST /api/v1/revenue/*',
          'GET /api/v1/analytics/*',
          'POST /api/v1/fraud/*',
          'POST /api/v1/nft/*',
          'POST /api/v1/compliance/*',
          'POST /api/v1/mobile/*',
          'POST /api/v1/security/*'
        ]
      });
    });

    // Global error handler
    this.app.use(this.errorHandler.bind(this));
  }

  /**
   * Create revenue optimization routes
   */
  private createRevenueRoutes(): express.Router {
    const router = express.Router();

    router.post('/optimize', async (req, res) => {
      try {
        const { creatorId, platform, contentType, currentMetrics } = req.body;
        const optimization = await this.revenueOptimization.optimizeRevenue(
          creatorId,
          { platform, contentType, ...currentMetrics }
        );
        res.json(optimization);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.get('/predictions/:creatorId', async (req, res) => {
      try {
        const predictions = await this.revenueOptimization.generateEarningsPrediction(
          req.params.creatorId,
          parseInt(req.query.days as string) || 30
        );
        res.json(predictions);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    return router;
  }

  /**
   * Create analytics routes
   */
  private createAnalyticsRoutes(): express.Router {
    const router = express.Router();

    router.get('/dashboard/:userId', async (req, res) => {
      try {
        // This would integrate with real-time analytics service
        const dashboardData = {
          totalRevenue: 125000,
          activeTransactions: 450,
          conversionRate: 0.127,
          timestamp: new Date()
        };
        res.json(dashboardData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    return router;
  }

  /**
   * Create fraud detection routes
   */
  private createFraudRoutes(): express.Router {
    const router = express.Router();

    router.post('/analyze', async (req, res) => {
      try {
        const fraudScore = await this.fraudDetection.analyzeTransaction(req.body);
        res.json(fraudScore);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/verify-document', async (req, res) => {
      try {
        const verification = await this.fraudDetection.verifyDocument(req.body);
        res.json(verification);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    return router;
  }

  /**
   * Create NFT marketplace routes
   */
  private createNFTRoutes(): express.Router {
    const router = express.Router();

    router.post('/collections', async (req, res) => {
      try {
        const { creatorId } = req.user as any;
        const collection = await this.nftMarketplace.createCollection(creatorId, req.body);
        res.status(201).json(collection);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/mint', async (req, res) => {
      try {
        const { creatorId } = req.user as any;
        const nft = await this.nftMarketplace.mintNFT(creatorId, req.body);
        res.status(201).json(nft);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/list', async (req, res) => {
      try {
        const { userId } = req.user as any;
        const listing = await this.nftMarketplace.listNFTForSale(userId, req.body);
        res.status(201).json(listing);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.get('/stats', async (req, res) => {
      try {
        const stats = await this.nftMarketplace.getMarketplaceStats(req.query.timeframe as any);
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    return router;
  }

  /**
   * Create compliance engine routes
   */
  private createComplianceRoutes(): express.Router {
    const router = express.Router();

    router.post('/verify-age', async (req, res) => {
      try {
        const { userId, verificationData } = req.body;
        const result = await this.complianceEngine.verifyAge(userId, verificationData);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/screen-content', async (req, res) => {
      try {
        const { contentId, content } = req.body;
        const result = await this.complianceEngine.screenContent(contentId, content);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.get('/status/:entityId', async (req, res) => {
      try {
        const { entityId } = req.params;
        const { entityType } = req.query;
        const status = await this.complianceEngine.getComplianceStatus(entityId, entityType as string);
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    return router;
  }

  /**
   * Create mobile SDK routes
   */
  private createMobileRoutes(): express.Router {
    const router = express.Router();

    router.post('/initialize', async (req, res) => {
      try {
        const { appId, deviceInfo } = req.body;
        const result = await this.mobileSDK.initializeApp(appId, deviceInfo);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/authenticate', async (req, res) => {
      try {
        const { sessionId, userId, biometricData } = req.body;
        const result = await this.mobileSDK.authenticateUser(sessionId, userId, biometricData);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/payment', async (req, res) => {
      try {
        const { sessionId, paymentData } = req.body;
        const result = await this.mobileSDK.processPayment(sessionId, paymentData);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.get('/transactions/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const result = await this.mobileSDK.getTransactionHistory(sessionId, req.query as any);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    return router;
  }

  /**
   * Create advanced security routes
   */
  private createSecurityRoutes(): express.Router {
    const router = express.Router();

    router.post('/verify-access', async (req, res) => {
      try {
        const result = await this.advancedSecurity.verifyZeroTrustAccess(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/encrypt', async (req, res) => {
      try {
        const { data, keyId } = req.body;
        const result = await this.advancedSecurity.encryptSensitiveData(data, keyId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/decrypt', async (req, res) => {
      try {
        const { encryptedData, keyId } = req.body;
        const result = await this.advancedSecurity.decryptSensitiveData(encryptedData, keyId);
        res.json({ data: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/analyze-threat', async (req, res) => {
      try {
        const result = await this.advancedSecurity.analyzeSecurityThreat(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/fingerprint', async (req, res) => {
      try {
        const result = await this.advancedSecurity.generateDeviceFingerprint(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.get('/dashboard', async (req, res) => {
      try {
        const timeframe = req.query.timeframe as any || '24h';
        const result = await this.advancedSecurity.getSecurityDashboard(timeframe);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    return router;
  }

  /**
   * Global error handler
   */
  private errorHandler(error: Error, req: express.Request, res: express.Response, next: express.NextFunction): void {
    this.logger.error('🚨 Unhandled error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method
    });

    res.status(500).json({
      error: 'Internal server error',
      message: this.config.environment === 'development' ? error.message : 'Something went wrong',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Setup graceful shutdown handling
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT'];

    signals.forEach(signal => {
      process.on(signal, async () => {
        this.logger.info(`📡 Received ${signal}, starting graceful shutdown...`);

        try {
          // Close server
          if (this.server) {
            this.server.close(() => {
              this.logger.info('🔌 HTTP server closed');
            });
          }

          // Shutdown services
          if (this.realTimeAnalytics) {
            await this.realTimeAnalytics.shutdown();
          }

          if (this.fraudDetection) {
            await this.fraudDetection.shutdown();
          }

          if (this.nftMarketplace) {
            await this.nftMarketplace.shutdown();
          }

          if (this.complianceEngine) {
            await this.complianceEngine.shutdown();
          }

          if (this.mobileSDK) {
            await this.mobileSDK.shutdown();
          }

          if (this.advancedSecurity) {
            await this.advancedSecurity.shutdown();
          }

          // Close database connections
          if (this.database) {
            await this.database.close();
            this.logger.info('🗄️ Database connection closed');
          }

          if (this.redis) {
            await this.redis.quit();
            this.logger.info('🗄️ Redis connection closed');
          }

          this.logger.info('✅ Graceful shutdown completed');
          process.exit(0);

        } catch (error) {
          this.logger.error('❌ Error during shutdown', { error: error.message });
          process.exit(1);
        }
      });
    });
  }
}

// Create and start application
async function main(): Promise<void> {
  const app = new FanzMoneyDashApp();

  try {
    await app.initialize();
    await app.start();
  } catch (error) {
    console.error('Failed to start FanzMoneyDash:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { FanzMoneyDashApp };