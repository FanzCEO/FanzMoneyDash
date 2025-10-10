# FANZ MoneyDash - DigitalOcean Deployment Guide

This guide covers deploying FANZ MoneyDash to DigitalOcean using Docker containers with production-ready security, monitoring, and CI/CD.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│    Traefik      │────│  FANZ MoneyDash │
│   (DigitalOcean)│    │  (SSL/Routing)  │    │   Application   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐    ┌─────────────────┐
                       │    MongoDB      │    │     Redis       │
                       │   (Database)    │    │    (Cache)      │
                       └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Create DigitalOcean Droplet

```bash
# Create a new Ubuntu 22.04 LTS droplet
doctl compute droplet create fanz-money-dash \
  --region nyc1 \
  --image ubuntu-22-04-x64 \
  --size s-2vcpu-4gb \
  --enable-monitoring \
  --enable-backups \
  --ssh-keys YOUR_SSH_KEY_ID
```

### 2. Initial Server Setup

```bash
# Copy setup script to server
scp deploy/setup-server.sh root@YOUR_SERVER_IP:/tmp/

# SSH to server and run setup
ssh root@YOUR_SERVER_IP
chmod +x /tmp/setup-server.sh
./tmp/setup-server.sh
```

### 3. Configure Environment Variables

```bash
# Copy environment template
cp deploy/.env.production.example /opt/fanz-money-dash/.env.production

# Edit with your actual values
nano /opt/fanz-money-dash/.env.production
```

### 4. Deploy Application

```bash
# Copy deployment files
scp -r deploy/* fanz-deploy@YOUR_SERVER_IP:/opt/fanz-money-dash/

# SSH and deploy
ssh fanz-deploy@YOUR_SERVER_IP
cd /opt/fanz-money-dash
./deploy.sh
```

## 📋 Prerequisites

- DigitalOcean account with API token
- Domain name pointing to your server
- SSH key pair for secure access
- Docker and Docker Compose
- SSL certificate (Let's Encrypt)

## 🔧 Configuration

### Environment Variables

Key environment variables that must be configured:

```bash
# Database
MONGODB_URI=mongodb://fanz_user:PASSWORD@mongodb:27017/fanz_money_dash
REDIS_URL=redis://:PASSWORD@redis:6379

# Security
JWT_SECRET=your_jwt_secret_64_chars_minimum
ENCRYPTION_KEY=your_32_byte_hex_string

# Payment Processors (Adult-friendly)
CCBILL_CLIENT_ID=your_ccbill_id
SEGPAY_CLIENT_ID=your_segpay_id
VEROTEL_MERCHANT_ID=your_verotel_id
EPOCH_PRODUCT_ID=your_epoch_id

# AI Services
OPENAI_API_KEY=your_openai_key

# Storage & CDN
CLOUDFLARE_R2_ACCESS_KEY=your_r2_key
BUNNY_CDN_API_KEY=your_bunny_key
```

### SSL Setup

```bash
# Install SSL certificate
sudo certbot --nginx -d money.fanz.network

# Verify auto-renewal
sudo certbot renew --dry-run
```

## 🐳 Docker Services

The deployment includes these services:

### Application (`app`)
- Node.js 20 Alpine Linux
- Production-optimized build
- Health checks enabled
- Auto-restart on failure

### Database (`mongodb`)
- MongoDB 7.0
- Authentication enabled
- Data persistence
- Automated backups

### Cache (`redis`)
- Redis 7.2 Alpine
- Password protected
- Data persistence
- Memory optimization

### Reverse Proxy (`traefik`)
- Automatic SSL certificates
- Load balancing
- Dashboard monitoring
- Container discovery

### Monitoring (`watchtower`)
- Automatic container updates
- Health monitoring
- Cleanup old images

## 🔒 Security Features

### Firewall Configuration
```bash
# Only essential ports open
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny incoming
```

### Fail2ban Protection
- SSH brute force protection
- Auto-ban after 3 failed attempts
- 1-hour ban duration

### Docker Security
- Non-root user in containers
- Read-only root filesystem
- Security updates enabled
- Minimal base images

### SSL/TLS
- TLS 1.3 encryption
- HSTS headers
- Secure cipher suites
- Auto-renewal

## 📊 Monitoring & Logging

### Health Checks
- Application health endpoint
- Database connection status
- Memory and disk usage
- Automated restart on failure

### Log Management
- Structured JSON logging
- Log rotation (14 days)
- Error tracking
- Performance monitoring

### System Monitoring
```bash
# Check system status
fanz-info

# View application logs
fanz-logs

# Check container status
fanz-status
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The deployment includes automated CI/CD with:

1. **Test Stage**
   - Unit tests
   - Security audit
   - Build verification

2. **Security Scanning**
   - Vulnerability scanning
   - Container security
   - Dependency audit

3. **Performance Testing**
   - Load testing with k6
   - Health check validation

4. **Deployment**
   - Docker image build
   - Container registry push
   - Zero-downtime deployment
   - Health verification

5. **Rollback**
   - Automatic rollback on failure
   - Previous version restoration

### Required Secrets

Set these in your GitHub repository:

```bash
DO_TOKEN=your_digitalocean_api_token
DO_HOST=your_server_ip
DO_USERNAME=fanz-deploy
DO_SSH_KEY=your_private_ssh_key
```

## 💰 Adult Industry Payment Processing

FANZ MoneyDash supports adult-friendly payment processors:

### Integrated Processors
- **CCBill** - Industry leader for adult transactions
- **SegPay** - High-risk payment processing
- **Verotel** - European adult payment solutions
- **Epoch** - Adult content billing solutions

### Crypto Support
- Ethereum payments
- Bitcoin support
- Stablecoin transactions
- DeFi integration

### Compliance Features
- 2257 record keeping
- Age verification
- Chargeback protection
- Fraud detection

## 🛠️ Maintenance

### Database Backups
```bash
# Manual backup
docker-compose -f docker-compose.production.yml exec mongodb mongodump --out /backup/manual_$(date +%Y%m%d)

# Restore backup
docker-compose -f docker-compose.production.yml exec mongodb mongorestore /backup/backup_name
```

### Updates
```bash
# Update application
./deploy.sh

# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.production.yml pull
```

### Scaling
```bash
# Scale application containers
docker-compose -f docker-compose.production.yml up -d --scale app=3

# Add load balancer
doctl compute load-balancer create \
  --name fanz-money-dash-lb \
  --forwarding-rules entry_protocol:https,entry_port:443,target_protocol:http,target_port:3001
```

## 🚨 Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs app

# Verify environment variables
docker-compose -f docker-compose.production.yml config

# Check health endpoint
curl http://localhost:3001/health
```

**Database connection issues:**
```bash
# Check MongoDB status
docker-compose -f docker-compose.production.yml logs mongodb

# Test connection
docker-compose -f docker-compose.production.yml exec mongodb mongosh
```

**SSL certificate problems:**
```bash
# Renew certificates
sudo certbot renew

# Check certificate status
sudo certbot certificates

# Test SSL configuration
openssl s_client -connect money.fanz.network:443
```

### Performance Optimization

**Database optimization:**
```bash
# Check database performance
docker-compose -f docker-compose.production.yml exec mongodb mongostat

# Analyze queries
docker-compose -f docker-compose.production.yml exec mongodb mongotop
```

**Application optimization:**
```bash
# Monitor resource usage
htop

# Check Docker stats
docker stats

# Analyze performance
docker-compose -f docker-compose.production.yml exec app node --inspect src/server.js
```

## 🔗 Integration with FANZ Ecosystem

### SSO Integration
- FanzDash authentication
- Cross-platform user sessions
- Role-based access control

### Platform Webhooks
- BoyFanz transaction events
- GirlFanz payout notifications
- PupFanz user updates

### Data Synchronization
- Real-time payment updates
- Creator earnings sync
- Analytics aggregation

## 📞 Support

For deployment issues or questions:

1. Check the troubleshooting section above
2. Review application logs: `docker-compose logs`
3. Monitor system resources: `fanz-info`
4. Check GitHub Actions for CI/CD issues

## 🎯 Next Steps

After successful deployment:

1. Configure payment processor webhooks
2. Set up monitoring dashboards
3. Configure backup strategies
4. Test disaster recovery procedures
5. Set up alerting for critical issues

---

**FANZ MoneyDash** - Empowering creators with transparent, secure financial management. 💰✨