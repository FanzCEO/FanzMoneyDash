import swaggerJsdoc from 'swagger-jsdoc';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FanzMoneyDash API',
      version: '1.0.0',
      description: 'Comprehensive Financial Management Platform for FANZ Ecosystem',
      contact: {
        name: 'FANZ Technical Team',
        email: 'support@fanz.network',
        url: 'https://docs.fanz.network'
      },
      license: {
        name: 'Proprietary',
        url: 'https://fanz.network/license'
      }
    },
    servers: [
      {
        url: 'https://api.fanz.network',
        description: 'Production server'
      },
      {
        url: 'https://staging-api.fanz.network',
        description: 'Staging server'
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['id', 'email', 'role'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique user identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            role: {
              type: 'string',
              enum: ['admin', 'creator', 'fan', 'moderator'],
              description: 'User role in the system'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp'
            }
          }
        },
        Transaction: {
          type: 'object',
          required: ['id', 'amount', 'currency', 'status', 'type'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique transaction identifier'
            },
            amount: {
              type: 'string',
              pattern: '^\\d+\\.\\d{2}$',
              description: 'Transaction amount in decimal format'
            },
            currency: {
              type: 'string',
              enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
              description: 'Currency code (ISO 4217)'
            },
            status: {
              type: 'string',
              enum: ['pending', 'completed', 'failed', 'refunded', 'disputed'],
              description: 'Current transaction status'
            },
            type: {
              type: 'string',
              enum: ['payment', 'payout', 'refund', 'fee', 'adjustment'],
              description: 'Transaction type'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction creation timestamp'
            },
            processedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction processing timestamp'
            },
            metadata: {
              type: 'object',
              description: 'Additional transaction metadata'
            }
          }
        },
        FinancialReport: {
          type: 'object',
          properties: {
            reportType: {
              type: 'string',
              enum: ['profit-loss', 'balance-sheet', 'cash-flow', 'revenue'],
              description: 'Type of financial report'
            },
            period: {
              type: 'object',
              properties: {
                startDate: {
                  type: 'string',
                  format: 'date',
                  description: 'Report period start date'
                },
                endDate: {
                  type: 'string',
                  format: 'date',
                  description: 'Report period end date'
                }
              }
            },
            data: {
              type: 'object',
              description: 'Report data based on report type'
            },
            generatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Report generation timestamp'
            }
          }
        },
        SecurityEvent: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            eventType: {
              type: 'string',
              enum: ['login', 'logout', 'failed_login', 'mfa_enabled', 'mfa_disabled', 'password_change']
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            ipAddress: {
              type: 'string',
              format: 'ipv4'
            },
            userAgent: {
              type: 'string'
            },
            riskScore: {
              type: 'number',
              minimum: 0,
              maximum: 100
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the request was successful'
            },
            data: {
              type: 'object',
              description: 'Response data'
            },
            message: {
              type: 'string',
              description: 'Human-readable message'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Response timestamp'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code'
                },
                message: {
                  type: 'string',
                  description: 'Error message'
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'Additional error details'
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './src/controllers/*.ts',
    './src/routes/*.ts'
  ]
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  // Swagger page
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customSiteTitle: 'FanzMoneyDash API Documentation',
    customCss: `
      .topbar-wrapper { display: none; }
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 50px 0; }
      .swagger-ui .info .title { color: #7C4DFF; }
    `,
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true
    }
  }));

  // Swagger spec
  app.get('/api/docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

export default specs;