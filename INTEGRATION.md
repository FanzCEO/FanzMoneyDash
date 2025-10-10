# FANZ MoneyDash Ecosystem Integration

## Overview

FANZ MoneyDash is designed to seamlessly integrate with the entire FANZ ecosystem, providing centralized financial management across all platforms while maintaining individual platform autonomy.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    BoyFanz      │    │   GirlFanz      │    │   PupFanz       │
│                 │    │                 │    │                 │
└─────┬───────────┘    └─────┬───────────┘    └─────┬───────────┘
      │                      │                      │
      │                      │                      │
      └──────────────┬───────┼──────────────────────┘
                     │       │
              ┌──────▼───────▼──────┐
              │  FANZ MoneyDash     │
              │  Integration Hub    │
              └──────┬──────────────┘
                     │
              ┌──────▼──────────────┐
              │     FanzDash        │
              │ (Control Center)    │
              └─────────────────────┘
```

## Integration Components

### 1. FANZ Ecosystem Integration Hub

**File**: `src/integrations/fanz-ecosystem.js`

Central integration service that handles:
- Authentication with FanzDash
- User synchronization across platforms
- Transaction notifications
- Permission management
- Security incident reporting
- Creator earnings synchronization
- Health monitoring of all services

### 2. Webhook Handler

**File**: `src/integrations/webhook-handler.js`

Processes incoming webhooks from:
- **FanzDash**: User management, security alerts, configuration updates
- **Platform Events**: Subscriptions, tips, content purchases, chargebacks, fraud alerts

### 3. API Routes

**File**: `src/routes/integrations.js`

RESTful endpoints for:
- Webhook processing
- Health checks
- User synchronization
- Permissions management
- Earnings synchronization
- Integration status monitoring

## Supported Platforms

### Core Platforms
- **BoyFanz** (`boyfanz.com`)
- **GirlFanz** (`girlfanz.com`)  
- **PupFanz** (`pupfanz.com`)
- **DaddiesFanz** (`daddiesfanz.com`)
- **CougarFanz** (`cougarfanz.com`)
- **TabooFanz** (`taboofanz.com`)

### Control Services
- **FanzDash** (`dash.fanz.network`) - Super admin control panel
- **FANZ SSO** (`sso.fanz.network`) - Single sign-on provider

## API Endpoints

### Health Check
```http
GET /api/integrations/health
Authorization: Bearer <token>
```

Returns health status of all integrated services.

### User Synchronization
```http
POST /api/integrations/sync/user
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "user123",
  "username": "creator_username",
  "email": "user@example.com",
  "role": "creator",
  "status": "active"
}
```

### Earnings Synchronization
```http
POST /api/integrations/sync/earnings
Authorization: Bearer <token>
Content-Type: application/json

{
  "creatorId": "creator123",
  "earnings": {
    "total": 5000.00,
    "thisMonth": 1200.00,
    "lastPayout": 4500.00,
    "pendingPayout": 500.00,
    "platforms": {
      "boyfanz": 2000.00,
      "girlfanz": 1500.00,
      "pupfanz": 1500.00
    }
  }
}
```

### Get User Permissions
```http
GET /api/integrations/users/{userId}/permissions
Authorization: Bearer <token>
```

## Webhook Events

### FanzDash Webhooks

**URL**: `/api/integrations/webhooks/fanzdash`

Supported events:
- `user_created` - New user registered in ecosystem
- `user_updated` - User profile updated
- `user_suspended` - User account suspended
- `security_alert` - Security incident detected
- `platform_config_updated` - Configuration changed
- `mass_payout_initiated` - Batch payout started

### Platform Webhooks

**URL**: `/api/integrations/webhooks/{platform}`

Supported events:
- `subscription_created` - New subscription
- `subscription_cancelled` - Subscription ended
- `tip_sent` - Creator received tip
- `content_purchased` - Content unlock/purchase
- `creator_earnings_updated` - Earnings recalculated
- `chargeback_received` - Payment disputed
- `fraud_detected` - Suspicious activity

## Security

### Webhook Verification
All webhooks are verified using HMAC-SHA256 signatures:

```javascript
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

Expected header: `X-FANZ-Signature: sha256={signature}`

### Authentication
- **Service-to-Service**: API keys and JWT tokens
- **User Sessions**: SSO validation through FANZ SSO
- **Webhook Security**: HMAC signature verification

### Rate Limiting
- **Webhooks**: 100 requests/minute per IP
- **API Endpoints**: 1000 requests/15 minutes per IP
- **Authentication**: Configurable through environment variables

## Configuration

### Environment Variables

```bash
# FANZ Ecosystem Integration
FANZDASH_API_URL=https://dash.fanz.network/api
FANZDASH_API_KEY=your-fanzdash-api-key
SSO_PROVIDER_URL=https://sso.fanz.network
SSO_CLIENT_ID=fanz-money-dash
SSO_CLIENT_SECRET=your-sso-client-secret

# Platform Webhooks
WEBHOOK_SECRET=fanz-money-dash-webhook-secret
WEBHOOK_BOYFANZ=https://api.boyfanz.com/webhooks/money-dash
WEBHOOK_GIRLFANZ=https://api.girlfanz.com/webhooks/money-dash
WEBHOOK_PUPFANZ=https://api.pupfanz.com/webhooks/money-dash
WEBHOOK_DADDIESFANZ=https://api.daddiesfanz.com/webhooks/money-dash
WEBHOOK_COUGARFANZ=https://api.cougarfanz.com/webhooks/money-dash
WEBHOOK_TABOOFANZ=https://api.taboofanz.com/webhooks/money-dash
```

## Error Handling

The integration system includes comprehensive error handling:

1. **Retry Logic**: Failed API calls are retried with exponential backoff
2. **Circuit Breaker**: Unhealthy services are temporarily bypassed
3. **Graceful Degradation**: Core functionality continues if integrations fail
4. **Monitoring**: All errors are logged and can trigger alerts

## Monitoring & Logging

### Health Monitoring
Continuous health checks for all integrated services with configurable intervals and thresholds.

### Audit Logging
All integration events are logged with:
- Timestamp
- Source system
- Event type
- User context
- Success/failure status

### Security Logging
Security-specific events including:
- Failed webhook signatures
- Suspicious activity reports
- Authentication failures
- Permission violations

## Development & Testing

### Test Webhook Endpoint
```http
POST /api/integrations/test/webhook
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "platform": "boyfanz",
  "event": "subscription_created",
  "data": {
    "userId": "test123",
    "creatorId": "creator456",
    "amount": 19.99,
    "currency": "USD"
  }
}
```

**Note**: Only available in development environment for admin users.

### Local Development
1. Copy `.env.example` to `.env`
2. Configure integration endpoints (can point to localhost for testing)
3. Use mock webhook secret for testing
4. Enable debug logging: `DEBUG=fanz:*`

## Deployment Considerations

### Production Setup
1. **HTTPS Only**: All integration endpoints must use HTTPS
2. **API Key Rotation**: Implement regular rotation of API keys
3. **Network Security**: Use VPN or private networks when possible
4. **Monitoring**: Set up alerts for integration failures
5. **Backup Authentication**: Configure fallback authentication methods

### Scaling
- Integration services are stateless and can be horizontally scaled
- Use load balancers for webhook endpoints
- Consider message queues for high-volume webhook processing
- Implement caching for frequently accessed integration data

## Troubleshooting

### Common Issues

1. **Webhook Signature Failures**
   - Verify webhook secret matches across systems
   - Check request body encoding (UTF-8)
   - Ensure timestamp tolerance for signature validation

2. **API Authentication Failures**
   - Verify API keys are current and not expired
   - Check SSO provider connectivity
   - Validate JWT token format and expiration

3. **Service Unavailability**
   - Check service health endpoints
   - Verify network connectivity
   - Review rate limiting configuration

### Logging Examples

```bash
# View integration logs
tail -f logs/integrations.log

# Filter by platform
grep "boyfanz" logs/integrations.log

# View webhook processing
grep "webhook_received" logs/audit.log

# Monitor health checks
grep "health_check" logs/system.log
```

## Future Enhancements

### Planned Features
1. **Real-time Sync**: WebSocket connections for instant data updates
2. **Batch Operations**: Bulk user/transaction synchronization
3. **Analytics Integration**: Cross-platform reporting and insights
4. **Mobile SDKs**: Direct integration with mobile applications
5. **Blockchain Integration**: Transparent transaction logging across platforms

### API Evolution
- GraphQL endpoint for complex queries
- Webhook replay functionality
- Advanced filtering and pagination
- Streaming APIs for real-time data

## Support

For integration support:
- **Documentation**: Check this file and inline code comments
- **API Testing**: Use the provided test endpoints in development
- **Monitoring**: Review health check endpoints for service status
- **Logging**: Enable debug logging for detailed troubleshooting

## Security Best Practices

1. **Never log sensitive data** (API keys, tokens, personal information)
2. **Use environment variables** for all configuration
3. **Implement proper error handling** to avoid information leakage
4. **Regular security audits** of integration endpoints
5. **Monitor for suspicious patterns** in webhook traffic
6. **Implement proper CORS** policies for browser-based integrations