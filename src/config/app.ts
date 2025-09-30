/**
 * Application Configuration
 * Centralized configuration management for FanzMoneyDash
 */

import { Logger } from '../utils/logger';

const logger = new Logger('AppConfig');

/**
 * Environment types
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Application configuration interface
 */
export interface AppConfig {
  // Environment
  env: Environment;
  port: number;
  host: string;
  nodeEnv: string;

  // Security
  security: {
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtRefreshExpiresIn: string;
    bcryptRounds: number;
    corsOrigins: string[];
    rateLimitMax: number;
    rateLimitWindowMs: number;
    csrfEnabled: boolean;
    helmetEnabled: boolean;
  };

  // Database
  database: {
    url?: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    poolSize: number;
    connectionTimeout: number;
    queryTimeout: number;
  };

  // Redis
  redis: {
    url?: string;
    host: string;
    port: number;
    password?: string;
    db: number;
    prefix: string;
    ttl: number;
  };

  // External Services
  services: {
    fanzDash: {
      baseUrl: string;
      apiKey: string;
      timeout: number;
    };
    paymentProcessors: {
      rocketgate: {
        merchantId: string;
        merchantPassword: string;
        apiUrl: string;
        testMode: boolean;
      };
      segpay: {
        packageId: string;
        merchantId: string;
        apiKey: string;
        apiUrl: string;
        testMode: boolean;
      };
      ccbill: {
        accountNumber: string;
        subAccountNumber: string;
        flexformsId: string;
        saltKey: string;
        apiUrl: string;
        testMode: boolean;
      };
      epoch: {
        memberId: string;
        classId: string;
        keyId: string;
        key: string;
        apiUrl: string;
        testMode: boolean;
      };
      bitpay: {
        apiKey: string;
        apiSecret: string;
        apiUrl: string;
        testMode: boolean;
      };
      coinbase: {
        apiKey: string;
        webhookSecret: string;
        apiUrl: string;
        testMode: boolean;
      };
    };
    payoutProviders: {
      paxum: {
        apiKey: string;
        apiSecret: string;
        apiUrl: string;
        testMode: boolean;
      };
      wise: {
        apiKey: string;
        profileId: string;
        apiUrl: string;
        testMode: boolean;
      };
      payoneer: {
        username: string;
        password: string;
        partnerId: string;
        apiUrl: string;
        testMode: boolean;
      };
      cryptoPayouts: {
        enabled: boolean;
        btcAddress?: string;
        ethAddress?: string;
        usdtAddress?: string;
        testMode: boolean;
      };
    };
  };

  // Features
  features: {
    autoRefunds: boolean;
    manualReview: boolean;
    cryptoPayments: boolean;
    multiCurrencySupport: boolean;
    fraudDetection: boolean;
    realTimeNotifications: boolean;
    auditLogging: boolean;
    performanceMonitoring: boolean;
  };

  // Fraud Detection
  fraud: {
    enabled: boolean;
    riskThresholds: {
      low: number;
      medium: number;
      high: number;
    };
    autoRejectThreshold: number;
    autoApproveThreshold: number;
    velocityLimits: {
      transactions: number;
      amount: number;
      timeWindow: number;
    };
    geoBlocking: {
      enabled: boolean;
      blockedCountries: string[];
      allowedCountries: string[];
    };
    ipFiltering: {
      enabled: boolean;
      blacklist: string[];
      whitelist: string[];
    };
  };

  // Notification Services
  notifications: {
    email: {
      enabled: boolean;
      provider: 'sendgrid' | 'ses' | 'smtp';
      apiKey?: string;
      fromEmail: string;
      fromName: string;
    };
    sms: {
      enabled: boolean;
      provider: 'twilio' | 'nexmo';
      apiKey?: string;
      apiSecret?: string;
      fromNumber?: string;
    };
    webhook: {
      enabled: boolean;
      endpoints: string[];
      retryAttempts: number;
      retryDelay: number;
    };
  };

  // Logging
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    enableConsole: boolean;
    enableFile: boolean;
    fileConfig: {
      filename: string;
      maxsize: number;
      maxFiles: number;
    };
    enableElasticsearch: boolean;
    elasticsearchConfig?: {
      node: string;
      index: string;
    };
  };

  // Monitoring
  monitoring: {
    healthCheck: {
      enabled: boolean;
      interval: number;
      timeout: number;
    };
    metrics: {
      enabled: boolean;
      prometheus: {
        enabled: boolean;
        port: number;
      };
    };
    tracing: {
      enabled: boolean;
      jaegerEndpoint?: string;
    };
  };
}

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): AppConfig {
  const env = (process.env.NODE_ENV as Environment) || 'development';
  
  return {
    // Environment
    env,
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',

    // Security
    security: {
      jwtSecret: getRequiredEnv('JWT_SECRET'),
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      csrfEnabled: process.env.CSRF_ENABLED === 'true',
      helmetEnabled: process.env.HELMET_ENABLED !== 'false',
    },

    // Database
    database: {
      url: process.env.DATABASE_URL,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      name: process.env.DB_NAME || 'fanzmoney',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DATABASE_SSL === 'true' || env === 'production',
      poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
      connectionTimeout: parseInt(process.env.DATABASE_TIMEOUT || '30000'),
      queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '60000'),
    },

    // Redis
    redis: {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      prefix: process.env.REDIS_PREFIX || 'fanzmoney:',
      ttl: parseInt(process.env.REDIS_TTL || '3600'), // 1 hour default
    },

    // External Services
    services: {
      fanzDash: {
        baseUrl: getRequiredEnv('FANZDASH_BASE_URL'),
        apiKey: getRequiredEnv('FANZDASH_API_KEY'),
        timeout: parseInt(process.env.FANZDASH_TIMEOUT || '30000'),
      },
      paymentProcessors: {
        rocketgate: {
          merchantId: getRequiredEnv('ROCKETGATE_MERCHANT_ID'),
          merchantPassword: getRequiredEnv('ROCKETGATE_MERCHANT_PASSWORD'),
          apiUrl: process.env.ROCKETGATE_API_URL || 'https://gateway.rocketgate.com',
          testMode: process.env.ROCKETGATE_TEST_MODE === 'true',
        },
        segpay: {
          packageId: getRequiredEnv('SEGPAY_PACKAGE_ID'),
          merchantId: getRequiredEnv('SEGPAY_MERCHANT_ID'),
          apiKey: getRequiredEnv('SEGPAY_API_KEY'),
          apiUrl: process.env.SEGPAY_API_URL || 'https://api.segpay.com',
          testMode: process.env.SEGPAY_TEST_MODE === 'true',
        },
        ccbill: {
          accountNumber: getRequiredEnv('CCBILL_ACCOUNT_NUMBER'),
          subAccountNumber: getRequiredEnv('CCBILL_SUBACCOUNT_NUMBER'),
          flexformsId: getRequiredEnv('CCBILL_FLEXFORMS_ID'),
          saltKey: getRequiredEnv('CCBILL_SALT_KEY'),
          apiUrl: process.env.CCBILL_API_URL || 'https://api.ccbill.com',
          testMode: process.env.CCBILL_TEST_MODE === 'true',
        },
        epoch: {
          memberId: getRequiredEnv('EPOCH_MEMBER_ID'),
          classId: getRequiredEnv('EPOCH_CLASS_ID'),
          keyId: getRequiredEnv('EPOCH_KEY_ID'),
          key: getRequiredEnv('EPOCH_KEY'),
          apiUrl: process.env.EPOCH_API_URL || 'https://epoch.com',
          testMode: process.env.EPOCH_TEST_MODE === 'true',
        },
        bitpay: {
          apiKey: getRequiredEnv('BITPAY_API_KEY'),
          apiSecret: getRequiredEnv('BITPAY_API_SECRET'),
          apiUrl: process.env.BITPAY_API_URL || 'https://bitpay.com/api',
          testMode: process.env.BITPAY_TEST_MODE === 'true',
        },
        coinbase: {
          apiKey: getRequiredEnv('COINBASE_API_KEY'),
          webhookSecret: getRequiredEnv('COINBASE_WEBHOOK_SECRET'),
          apiUrl: process.env.COINBASE_API_URL || 'https://api.commerce.coinbase.com',
          testMode: process.env.COINBASE_TEST_MODE === 'true',
        },
      },
      payoutProviders: {
        paxum: {
          apiKey: getRequiredEnv('PAXUM_API_KEY'),
          apiSecret: getRequiredEnv('PAXUM_API_SECRET'),
          apiUrl: process.env.PAXUM_API_URL || 'https://www.paxum.com/payment/api',
          testMode: process.env.PAXUM_TEST_MODE === 'true',
        },
        wise: {
          apiKey: getRequiredEnv('WISE_API_KEY'),
          profileId: getRequiredEnv('WISE_PROFILE_ID'),
          apiUrl: process.env.WISE_API_URL || 'https://api.wise.com',
          testMode: process.env.WISE_TEST_MODE === 'true',
        },
        payoneer: {
          username: getRequiredEnv('PAYONEER_USERNAME'),
          password: getRequiredEnv('PAYONEER_PASSWORD'),
          partnerId: getRequiredEnv('PAYONEER_PARTNER_ID'),
          apiUrl: process.env.PAYONEER_API_URL || 'https://api.sandbox.payoneer.com',
          testMode: process.env.PAYONEER_TEST_MODE === 'true',
        },
        cryptoPayouts: {
          enabled: process.env.CRYPTO_PAYOUTS_ENABLED === 'true',
          btcAddress: process.env.CRYPTO_BTC_ADDRESS,
          ethAddress: process.env.CRYPTO_ETH_ADDRESS,
          usdtAddress: process.env.CRYPTO_USDT_ADDRESS,
          testMode: process.env.CRYPTO_TEST_MODE === 'true',
        },
      },
    },

    // Features
    features: {
      autoRefunds: process.env.FEATURE_AUTO_REFUNDS !== 'false',
      manualReview: process.env.FEATURE_MANUAL_REVIEW !== 'false',
      cryptoPayments: process.env.FEATURE_CRYPTO_PAYMENTS === 'true',
      multiCurrencySupport: process.env.FEATURE_MULTI_CURRENCY === 'true',
      fraudDetection: process.env.FEATURE_FRAUD_DETECTION !== 'false',
      realTimeNotifications: process.env.FEATURE_REALTIME_NOTIFICATIONS !== 'false',
      auditLogging: process.env.FEATURE_AUDIT_LOGGING !== 'false',
      performanceMonitoring: process.env.FEATURE_PERFORMANCE_MONITORING !== 'false',
    },

    // Fraud Detection
    fraud: {
      enabled: process.env.FRAUD_DETECTION_ENABLED !== 'false',
      riskThresholds: {
        low: parseFloat(process.env.FRAUD_THRESHOLD_LOW || '0.3'),
        medium: parseFloat(process.env.FRAUD_THRESHOLD_MEDIUM || '0.6'),
        high: parseFloat(process.env.FRAUD_THRESHOLD_HIGH || '0.8'),
      },
      autoRejectThreshold: parseFloat(process.env.FRAUD_AUTO_REJECT_THRESHOLD || '0.9'),
      autoApproveThreshold: parseFloat(process.env.FRAUD_AUTO_APPROVE_THRESHOLD || '0.2'),
      velocityLimits: {
        transactions: parseInt(process.env.FRAUD_VELOCITY_TRANSACTIONS || '10'),
        amount: parseFloat(process.env.FRAUD_VELOCITY_AMOUNT || '1000'),
        timeWindow: parseInt(process.env.FRAUD_VELOCITY_WINDOW || '3600'), // 1 hour
      },
      geoBlocking: {
        enabled: process.env.FRAUD_GEO_BLOCKING_ENABLED === 'true',
        blockedCountries: process.env.FRAUD_BLOCKED_COUNTRIES?.split(',') || [],
        allowedCountries: process.env.FRAUD_ALLOWED_COUNTRIES?.split(',') || [],
      },
      ipFiltering: {
        enabled: process.env.FRAUD_IP_FILTERING_ENABLED === 'true',
        blacklist: process.env.FRAUD_IP_BLACKLIST?.split(',') || [],
        whitelist: process.env.FRAUD_IP_WHITELIST?.split(',') || [],
      },
    },

    // Notification Services
    notifications: {
      email: {
        enabled: process.env.EMAIL_ENABLED === 'true',
        provider: (process.env.EMAIL_PROVIDER as any) || 'sendgrid',
        apiKey: process.env.EMAIL_API_KEY,
        fromEmail: process.env.EMAIL_FROM || 'noreply@fanzmoney.com',
        fromName: process.env.EMAIL_FROM_NAME || 'FanzMoneyDash',
      },
      sms: {
        enabled: process.env.SMS_ENABLED === 'true',
        provider: (process.env.SMS_PROVIDER as any) || 'twilio',
        apiKey: process.env.SMS_API_KEY,
        apiSecret: process.env.SMS_API_SECRET,
        fromNumber: process.env.SMS_FROM_NUMBER,
      },
      webhook: {
        enabled: process.env.WEBHOOK_ENABLED !== 'false',
        endpoints: process.env.WEBHOOK_ENDPOINTS?.split(',') || [],
        retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '5000'),
      },
    },

    // Logging
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      enableConsole: process.env.LOG_CONSOLE !== 'false',
      enableFile: process.env.LOG_FILE === 'true',
      fileConfig: {
        filename: process.env.LOG_FILENAME || 'fanzmoney.log',
        maxsize: parseInt(process.env.LOG_MAX_SIZE || '10485760'), // 10MB
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
      },
      enableElasticsearch: process.env.LOG_ELASTICSEARCH === 'true',
      elasticsearchConfig: process.env.LOG_ELASTICSEARCH === 'true' ? {
        node: getRequiredEnv('ELASTICSEARCH_NODE'),
        index: process.env.ELASTICSEARCH_INDEX || 'fanzmoney-logs',
      } : undefined,
    },

    // Monitoring
    monitoring: {
      healthCheck: {
        enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
        interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
        timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
      },
      metrics: {
        enabled: process.env.METRICS_ENABLED !== 'false',
        prometheus: {
          enabled: process.env.PROMETHEUS_ENABLED === 'true',
          port: parseInt(process.env.PROMETHEUS_PORT || '9090'),
        },
      },
      tracing: {
        enabled: process.env.TRACING_ENABLED === 'true',
        jaegerEndpoint: process.env.JAEGER_ENDPOINT,
      },
    },
  };
}

/**
 * Get required environment variable
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Validate configuration
 */
function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    errors.push('Port must be between 1 and 65535');
  }

  // Validate JWT secret
  if (config.security.jwtSecret.length < 32) {
    errors.push('JWT secret must be at least 32 characters long');
  }

  // Validate fraud thresholds
  if (config.fraud.riskThresholds.low >= config.fraud.riskThresholds.medium) {
    errors.push('Low fraud threshold must be less than medium threshold');
  }
  if (config.fraud.riskThresholds.medium >= config.fraud.riskThresholds.high) {
    errors.push('Medium fraud threshold must be less than high threshold');
  }

  // Validate database configuration
  if (!config.database.url && (!config.database.host || !config.database.name)) {
    errors.push('Either DATABASE_URL or DB_HOST and DB_NAME must be provided');
  }

  // Validate Redis configuration
  if (!config.redis.url && !config.redis.host) {
    errors.push('Either REDIS_URL or REDIS_HOST must be provided');
  }

  if (errors.length > 0) {
    logger.error('Configuration validation failed:', { errors });
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }
}

/**
 * Load and cache configuration
 */
let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    logger.info('Loading application configuration...');
    cachedConfig = loadConfig();
    validateConfig(cachedConfig);
    logger.info('✅ Configuration loaded successfully', {
      env: cachedConfig.env,
      port: cachedConfig.port,
      features: Object.keys(cachedConfig.features).filter(key => 
        cachedConfig!.features[key as keyof typeof cachedConfig.features]
      ),
    });
  }
  return cachedConfig;
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
  return getConfig().features[feature];
}

/**
 * Check if environment is production
 */
export function isProduction(): boolean {
  return getConfig().env === 'production';
}

/**
 * Check if environment is development
 */
export function isDevelopment(): boolean {
  return getConfig().env === 'development';
}

/**
 * Check if environment is test
 */
export function isTest(): boolean {
  return getConfig().env === 'test';
}

/**
 * Get database configuration
 */
export function getDatabaseConfig() {
  return getConfig().database;
}

/**
 * Get Redis configuration
 */
export function getRedisConfig() {
  return getConfig().redis;
}

/**
 * Get security configuration
 */
export function getSecurityConfig() {
  return getConfig().security;
}

/**
 * Get fraud detection configuration
 */
export function getFraudConfig() {
  return getConfig().fraud;
}

/**
 * Get payment processor configuration
 */
export function getPaymentProcessorConfig(processor: keyof AppConfig['services']['paymentProcessors']) {
  return getConfig().services.paymentProcessors[processor];
}

/**
 * Get payout provider configuration
 */
export function getPayoutProviderConfig(provider: keyof AppConfig['services']['payoutProviders']) {
  return getConfig().services.payoutProviders[provider];
}

// Export the configuration
export const config = getConfig();