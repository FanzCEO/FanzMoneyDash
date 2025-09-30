/**
 * Application Configuration
 * Centralized configuration management for FanzMoneyDash
 */
/**
 * Environment types
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';
/**
 * Application configuration interface
 */
export interface AppConfig {
    env: Environment;
    port: number;
    host: string;
    nodeEnv: string;
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
    redis: {
        url?: string;
        host: string;
        port: number;
        password?: string;
        db: number;
        prefix: string;
        ttl: number;
    };
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
export declare function getConfig(): AppConfig;
/**
 * Check if feature is enabled
 */
export declare function isFeatureEnabled(feature: keyof AppConfig['features']): boolean;
/**
 * Check if environment is production
 */
export declare function isProduction(): boolean;
/**
 * Check if environment is development
 */
export declare function isDevelopment(): boolean;
/**
 * Check if environment is test
 */
export declare function isTest(): boolean;
/**
 * Get database configuration
 */
export declare function getDatabaseConfig(): {
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
/**
 * Get Redis configuration
 */
export declare function getRedisConfig(): {
    url?: string;
    host: string;
    port: number;
    password?: string;
    db: number;
    prefix: string;
    ttl: number;
};
/**
 * Get security configuration
 */
export declare function getSecurityConfig(): {
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
/**
 * Get fraud detection configuration
 */
export declare function getFraudConfig(): {
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
/**
 * Get payment processor configuration
 */
export declare function getPaymentProcessorConfig(processor: keyof AppConfig['services']['paymentProcessors']): {
    merchantId: string;
    merchantPassword: string;
    apiUrl: string;
    testMode: boolean;
} | {
    packageId: string;
    merchantId: string;
    apiKey: string;
    apiUrl: string;
    testMode: boolean;
} | {
    accountNumber: string;
    subAccountNumber: string;
    flexformsId: string;
    saltKey: string;
    apiUrl: string;
    testMode: boolean;
} | {
    memberId: string;
    classId: string;
    keyId: string;
    key: string;
    apiUrl: string;
    testMode: boolean;
} | {
    apiKey: string;
    apiSecret: string;
    apiUrl: string;
    testMode: boolean;
} | {
    apiKey: string;
    webhookSecret: string;
    apiUrl: string;
    testMode: boolean;
};
/**
 * Get payout provider configuration
 */
export declare function getPayoutProviderConfig(provider: keyof AppConfig['services']['payoutProviders']): {
    apiKey: string;
    apiSecret: string;
    apiUrl: string;
    testMode: boolean;
} | {
    apiKey: string;
    profileId: string;
    apiUrl: string;
    testMode: boolean;
} | {
    username: string;
    password: string;
    partnerId: string;
    apiUrl: string;
    testMode: boolean;
} | {
    enabled: boolean;
    btcAddress?: string;
    ethAddress?: string;
    usdtAddress?: string;
    testMode: boolean;
};
export declare const config: AppConfig;
//# sourceMappingURL=app.d.ts.map