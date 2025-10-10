// MongoDB initialization script for FANZ MoneyDash production environment
// This script creates the database, collections, and indexes

// Switch to the FANZ MoneyDash database
db = db.getSiblingDB('fanz_money_dash');

// Create application user with read/write permissions
db.createUser({
  user: 'fanz_user',
  pwd: process.env.MONGODB_ROOT_PASSWORD, // This will be replaced by the actual password
  roles: [
    {
      role: 'readWrite',
      db: 'fanz_money_dash'
    }
  ]
});

// Create collections with validation schemas
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'username', 'createdAt'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        },
        username: {
          bsonType: 'string',
          minLength: 3,
          maxLength: 30
        },
        role: {
          enum: ['creator', 'fan', 'admin', 'moderator']
        },
        status: {
          enum: ['active', 'suspended', 'pending_verification', 'banned']
        }
      }
    }
  }
});

db.createCollection('transactions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'amount', 'type', 'status', 'createdAt'],
      properties: {
        amount: {
          bsonType: 'number',
          minimum: 0
        },
        type: {
          enum: ['deposit', 'withdrawal', 'payment', 'refund', 'chargeback', 'tip']
        },
        status: {
          enum: ['pending', 'completed', 'failed', 'cancelled']
        },
        processor: {
          enum: ['ccbill', 'segpay', 'verotel', 'epoch', 'crypto', 'internal']
        }
      }
    }
  }
});

db.createCollection('payouts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['creatorId', 'amount', 'status', 'createdAt'],
      properties: {
        amount: {
          bsonType: 'number',
          minimum: 0.01
        },
        status: {
          enum: ['pending', 'processing', 'completed', 'failed', 'cancelled']
        },
        method: {
          enum: ['bank_transfer', 'paypal', 'crypto', 'paxum', 'epayscience']
        }
      }
    }
  }
});

// Create indexes for performance optimization
print('Creating indexes for users collection...');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ status: 1 });
db.users.createIndex({ createdAt: 1 });

print('Creating indexes for transactions collection...');
db.transactions.createIndex({ userId: 1 });
db.transactions.createIndex({ type: 1 });
db.transactions.createIndex({ status: 1 });
db.transactions.createIndex({ processor: 1 });
db.transactions.createIndex({ createdAt: 1 });
db.transactions.createIndex({ userId: 1, createdAt: -1 });
db.transactions.createIndex({ 'metadata.externalId': 1 }, { sparse: true });

print('Creating indexes for payouts collection...');
db.payouts.createIndex({ creatorId: 1 });
db.payouts.createIndex({ status: 1 });
db.payouts.createIndex({ method: 1 });
db.payouts.createIndex({ createdAt: 1 });
db.payouts.createIndex({ creatorId: 1, createdAt: -1 });
db.payouts.createIndex({ scheduledDate: 1 }, { sparse: true });

// Create compound indexes for complex queries
db.transactions.createIndex({ userId: 1, type: 1, status: 1 });
db.payouts.createIndex({ creatorId: 1, status: 1, method: 1 });

print('Creating additional collections...');

// Analytics and reporting collections
db.createCollection('analytics_daily', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['date', 'metrics'],
      properties: {
        date: {
          bsonType: 'date'
        },
        metrics: {
          bsonType: 'object'
        }
      }
    }
  }
});

db.analytics_daily.createIndex({ date: 1 }, { unique: true });

// Audit logs
db.createCollection('audit_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['action', 'userId', 'timestamp'],
      properties: {
        action: {
          bsonType: 'string'
        },
        userId: {
          bsonType: 'string'
        },
        timestamp: {
          bsonType: 'date'
        }
      }
    }
  }
});

db.audit_logs.createIndex({ userId: 1, timestamp: -1 });
db.audit_logs.createIndex({ action: 1 });
db.audit_logs.createIndex({ timestamp: 1 });

// System configuration
db.createCollection('system_config', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['key', 'value'],
      properties: {
        key: {
          bsonType: 'string'
        }
      }
    }
  }
});

db.system_config.createIndex({ key: 1 }, { unique: true });

// Insert default system configuration
db.system_config.insertMany([
  {
    key: 'payout_minimum',
    value: 50.00,
    description: 'Minimum payout amount in USD'
  },
  {
    key: 'commission_rate',
    value: 0.05,
    description: 'Platform commission rate (5%)'
  },
  {
    key: 'auto_payout_enabled',
    value: true,
    description: 'Whether automatic payouts are enabled'
  },
  {
    key: 'maintenance_mode',
    value: false,
    description: 'System maintenance mode flag'
  }
]);

// Create webhook events collection
db.createCollection('webhook_events', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['processor', 'event_type', 'status', 'createdAt'],
      properties: {
        processor: {
          enum: ['ccbill', 'segpay', 'verotel', 'epoch', 'stripe']
        },
        status: {
          enum: ['pending', 'processed', 'failed', 'ignored']
        }
      }
    }
  }
});

db.webhook_events.createIndex({ processor: 1, event_type: 1 });
db.webhook_events.createIndex({ status: 1 });
db.webhook_events.createIndex({ createdAt: 1 });

print('Database initialization completed successfully!');
print('Collections created: users, transactions, payouts, analytics_daily, audit_logs, system_config, webhook_events');
print('Indexes created for optimal query performance');
print('Validation schemas applied for data integrity');