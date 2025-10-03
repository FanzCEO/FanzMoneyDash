# 🚀 FanzMoneyDash Deployment Guide

This guide covers the complete deployment process for FanzMoneyDash from development to production.

## 📋 Prerequisites

### Required Tools
- **Docker** 20.10+ & Docker Compose
- **Kubernetes** 1.21+ (EKS, GKE, AKS)
- **kubectl** configured with cluster access
- **Helm** 3.0+ (optional but recommended)
- **Node.js** 18+ for local development
- **PostgreSQL** 14+ and **Redis** 6+

### Required Services
- **Container Registry** (GitHub Container Registry, ECR, GCR)
- **SSL Certificates** (cert-manager with Let's Encrypt)
- **Load Balancer** (AWS ALB, GCP LB, Azure LB)
- **Monitoring** (Prometheus, Grafana, DataDog)
- **Secret Management** (Kubernetes Secrets, AWS Secrets Manager, etc.)

## 🏗️ Architecture Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Internet  │    │ Load Balancer│   │   WAF/CDN   │
│   Traffic   │───▶│   (HTTPS)   │──▶│  (Cloudflare)│
└─────────────┘    └─────────────┘    └─────────────┘
                           │
       ┌───────────────────▼───────────────────┐
       │          Kubernetes Cluster          │
       │  ┌─────────────────────────────────┐  │
       │  │         Ingress NGINX          │  │
       │  └─────────────────────────────────┘  │
       │                   │                  │
       │  ┌─────────────────▼───────────────┐  │
       │  │     FanzMoneyDash Pods        │  │
       │  │    (3-20 replicas with HPA)   │  │
       │  └─────────────────────────────────┘  │
       │           │              │           │
       │  ┌────────▼──────┐  ┌───▼──────┐   │
       │  │  PostgreSQL   │  │   Redis  │   │
       │  │   (Primary)   │  │ (Cache)  │   │
       │  └───────────────┘  └──────────┘   │
       └───────────────────────────────────────┘
```

## 🔧 Environment Setup

### 1. Create Kubernetes Namespace

```bash
kubectl create namespace fanz-production
kubectl label namespace fanz-production name=fanz-production
```

### 2. Configure Secrets

First, generate secure secrets:

```bash
# Generate JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# Generate API Key Secret
API_KEY_SECRET=$(openssl rand -base64 32)

# Generate Encryption Key (32 bytes)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# Generate HMAC Secret
HMAC_SECRET=$(openssl rand -base64 32)

echo "Generated secrets:"
echo "JWT_SECRET: $JWT_SECRET"
echo "API_KEY_SECRET: $API_KEY_SECRET" 
echo "ENCRYPTION_KEY: $ENCRYPTION_KEY"
echo "HMAC_SECRET: $HMAC_SECRET"
```

Update `k8s/secrets.yml` with actual values:

```bash
# Create a copy for production
cp k8s/secrets.yml k8s/secrets-production.yml

# Edit with your actual secrets
nano k8s/secrets-production.yml
```

### 3. Configure Database

Set up PostgreSQL and Redis (managed services recommended):

**AWS RDS PostgreSQL:**
```bash
aws rds create-db-instance \
  --db-instance-identifier fanzmoneydash-prod \
  --db-instance-class db.r5.large \
  --engine postgres \
  --engine-version 14.9 \
  --allocated-storage 100 \
  --storage-type gp2 \
  --master-username fanzmoneydash \
  --master-user-password $(openssl rand -base64 32) \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name fanz-db-subnet-group \
  --backup-retention-period 7 \
  --multi-az \
  --storage-encrypted
```

**AWS ElastiCache Redis:**
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id fanzmoneydash-redis-prod \
  --cache-node-type cache.r6g.large \
  --engine redis \
  --engine-version 6.2 \
  --num-cache-nodes 1 \
  --security-group-ids sg-xxxxxxxx \
  --subnet-group-name fanz-cache-subnet-group
```

## 🚢 Deployment Steps

### 1. Deploy Infrastructure

```bash
# Apply namespace and RBAC
kubectl apply -f k8s/secrets-production.yml

# Deploy the application
kubectl apply -f k8s/deployment.yml

# Verify deployment
kubectl get pods -n fanz-production
kubectl get services -n fanz-production
kubectl get ingress -n fanz-production
```

### 2. Configure Ingress & SSL

Ensure cert-manager is installed:

```bash
# Install cert-manager (if not already installed)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml

# Create Let's Encrypt issuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@fanz.network
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 3. Database Migration

Run database migrations:

```bash
# Create a migration job
kubectl create job --from=cronjob/fanzmoneydash-migration migration-$(date +%s) -n fanz-production

# Or run migration directly
kubectl run migration-temp --image=ghcr.io/fanzceo/fanzmoneydash:latest \
  --env="DATABASE_URL=postgresql://user:pass@host:5432/fanzmoneydash" \
  --command -- npm run migrate
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -n fanz-production -w

# Check application logs
kubectl logs -f deployment/fanzmoneydash-api -n fanz-production

# Test health endpoint
curl -k https://api.fanz.network/health

# Test authentication
curl -X POST https://api.fanz.network/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fanz.network","password":"your-password"}'
```

## 📊 Monitoring Setup

### 1. Prometheus & Grafana

Deploy monitoring stack:

```bash
# Add Prometheus Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword=admin123 \
  --set grafana.service.type=LoadBalancer
```

### 2. Configure Dashboards

Import pre-built dashboards for:
- Application metrics (response time, error rate, throughput)
- Infrastructure metrics (CPU, memory, network)
- Business metrics (transactions, revenue, user activity)
- Security metrics (failed logins, suspicious activity)

### 3. Set Up Alerting

Configure alerts for:

```yaml
# Critical Alerts
- High error rate (>5%)
- High response time (>1s p95)
- Pod crashes or restarts
- Database connection issues
- Payment processor failures

# Warning Alerts  
- High memory usage (>80%)
- High CPU usage (>80%)
- Slow database queries (>500ms)
- Failed login attempts spike
```

## 🔒 Security Hardening

### 1. Network Policies

Ensure network policies are applied:

```bash
kubectl apply -f k8s/secrets.yml  # Contains NetworkPolicy
```

### 2. Pod Security Standards

Configure pod security:

```bash
kubectl label namespace fanz-production \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
```

### 3. Enable Audit Logging

Configure Kubernetes audit logging:

```yaml
# /etc/kubernetes/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Namespace
  namespaces: ["fanz-production"]
  resources:
  - group: ""
    resources: ["pods", "services", "secrets", "configmaps"]
  - group: "apps"
    resources: ["deployments", "replicasets"]
```

## 🔄 CI/CD Pipeline

### 1. GitHub Actions Setup

The repository includes a comprehensive CI/CD pipeline that:

1. **Quality Checks**: Linting, formatting, security audit
2. **Testing**: Unit, integration, e2e, and performance tests  
3. **Building**: Multi-arch Docker images with caching
4. **Security**: CodeQL analysis and vulnerability scanning
5. **Deployment**: Automated deployment to staging and production

### 2. Required Secrets

Configure these secrets in GitHub repository settings:

```bash
# AWS Deployment
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Container Registry
GITHUB_TOKEN=ghp_...  # Automatically provided

# Monitoring
SONAR_TOKEN=...
SENTRY_DSN=...

# Communication
SLACK_WEBHOOK=https://hooks.slack.com/...
```

### 3. Branch Protection

Configure branch protection rules:

```bash
# Main branch protection
- Require pull request reviews (2 reviewers)
- Require status checks (all CI jobs must pass)
- Require up-to-date branches
- Include administrators in restrictions
- Allow force pushes: false
- Allow deletions: false
```

## 📈 Scaling & Performance

### 1. Horizontal Pod Autoscaling

The HPA is configured to scale between 3-20 pods based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)

### 2. Database Scaling

For high traffic, consider:

```bash
# Read replicas
aws rds create-db-instance-read-replica \
  --db-instance-identifier fanzmoneydash-replica \
  --source-db-instance-identifier fanzmoneydash-prod \
  --db-instance-class db.r5.large

# Connection pooling
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: pgbouncer
  template:
    metadata:
      labels:
        app: pgbouncer
    spec:
      containers:
      - name: pgbouncer
        image: pgbouncer/pgbouncer:latest
        env:
        - name: DATABASES_HOST
          value: "fanzmoneydash-prod.cluster-xxx.region.rds.amazonaws.com"
        - name: DATABASES_PORT
          value: "5432"
        - name: POOL_MODE
          value: "transaction"
        - name: MAX_CLIENT_CONN
          value: "1000"
EOF
```

### 3. Redis Optimization

```bash
# Redis cluster for high availability
aws elasticache create-replication-group \
  --replication-group-id fanzmoneydash-redis-cluster \
  --description "FanzMoneyDash Redis Cluster" \
  --num-cache-clusters 3 \
  --cache-node-type cache.r6g.large \
  --engine redis \
  --cache-parameter-group-name default.redis6.x.cluster.on
```

## 🚨 Disaster Recovery

### 1. Database Backups

```bash
# Automated backups (AWS RDS)
aws rds modify-db-instance \
  --db-instance-identifier fanzmoneydash-prod \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00" \
  --apply-immediately

# Manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier fanzmoneydash-prod \
  --db-snapshot-identifier fanzmoneydash-manual-$(date +%Y%m%d-%H%M%S)
```

### 2. Application State Backup

```bash
# Backup Kubernetes resources
kubectl get all,secrets,configmaps -n fanz-production -o yaml > backup-$(date +%Y%m%d).yaml

# Backup Redis data
kubectl run redis-backup --image=redis:7 -- redis-cli --rdb /backup/dump.rdb
```

### 3. Recovery Procedures

Document recovery procedures:

1. **Database Recovery**: Point-in-time recovery from RDS snapshots
2. **Application Recovery**: Redeploy from last known good image
3. **Configuration Recovery**: Restore from version-controlled configs
4. **Data Recovery**: Restore from encrypted backups

## 🔍 Troubleshooting

### Common Issues

**1. Pods not starting:**
```bash
kubectl describe pod <pod-name> -n fanz-production
kubectl logs <pod-name> -n fanz-production --previous
```

**2. Database connection issues:**
```bash
# Test database connectivity
kubectl run db-test --image=postgres:14 --rm -i --tty -- \
  psql postgresql://user:pass@host:5432/fanzmoneydash
```

**3. SSL/TLS certificate issues:**
```bash
kubectl describe certificate fanzmoneydash-api-tls -n fanz-production
kubectl describe clusterissuer letsencrypt-prod
```

**4. High response times:**
```bash
# Check resource usage
kubectl top pods -n fanz-production
kubectl top nodes

# Check database performance
# Connect to database and run:
# SELECT * FROM pg_stat_activity;
# SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

### Performance Optimization

**Database Query Optimization:**
```sql
-- Add indexes for frequent queries
CREATE INDEX CONCURRENTLY idx_transactions_created_at ON transactions(created_at);
CREATE INDEX CONCURRENTLY idx_transactions_status ON transactions(status);
CREATE INDEX CONCURRENTLY idx_audit_logs_user_id ON audit_logs(user_id);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM transactions WHERE status = 'pending';
```

**Application Optimization:**
```bash
# Enable connection pooling
# Increase Node.js memory limit
kubectl patch deployment fanzmoneydash-api -n fanz-production -p \
  '{"spec":{"template":{"spec":{"containers":[{"name":"fanzmoneydash-api","env":[{"name":"NODE_OPTIONS","value":"--max-old-space-size=2048"}]}]}}}}'
```

## 📞 Support & Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor application health and performance
- Check error logs and alerts
- Verify backup completion

**Weekly:**
- Review security scan results
- Update dependencies if needed
- Performance analysis and optimization

**Monthly:**
- Security audit and penetration testing
- Capacity planning review
- Disaster recovery testing

### Support Contacts

- **Technical Support**: support@fanz.network  
- **Emergency Hotline**: +1-800-FANZ-HELP
- **DevOps Team**: devops@fanz.network
- **Security Team**: security@fanz.network

---

## 🎯 Deployment Checklist

- [ ] Environment variables configured
- [ ] Secrets created and applied
- [ ] Database migrations completed
- [ ] SSL certificates issued
- [ ] Ingress controller configured
- [ ] Monitoring stack deployed
- [ ] Alerting rules configured
- [ ] Network policies applied
- [ ] RBAC permissions set
- [ ] Backup procedures configured
- [ ] CI/CD pipeline tested
- [ ] Security scan passed
- [ ] Performance testing completed
- [ ] Documentation updated
- [ ] Team training completed

---

**🚀 Ready for Production!**

Your FanzMoneyDash deployment is now ready for production traffic. Monitor the system closely during the initial rollout and be prepared to scale resources as needed.

For additional support or custom deployment scenarios, contact the FANZ technical team.