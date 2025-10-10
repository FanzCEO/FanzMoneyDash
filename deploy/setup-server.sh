#!/bin/bash

# FANZ MoneyDash Server Setup Script for Ubuntu 22.04 LTS
# This script sets up a DigitalOcean droplet for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (use sudo)"
fi

log "Starting FANZ MoneyDash server setup on Ubuntu 22.04 LTS..."

# Update system packages
log "Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
log "Installing essential packages..."
apt install -y \
    curl \
    wget \
    git \
    unzip \
    vim \
    htop \
    fail2ban \
    ufw \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    jq \
    certbot \
    nginx \
    logrotate

# Install Docker
log "Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Install Docker Compose (standalone)
log "Installing Docker Compose..."
DOCKER_COMPOSE_VERSION="2.24.0"
curl -L "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify Docker installation
systemctl start docker
systemctl enable docker
docker --version
docker-compose --version

# Install DigitalOcean CLI (doctl)
log "Installing DigitalOcean CLI..."
cd /tmp
wget https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
tar xf doctl-1.104.0-linux-amd64.tar.gz
mv doctl /usr/local/bin
doctl version

# Create deployment user
log "Creating deployment user..."
useradd -m -s /bin/bash -G docker fanz-deploy
mkdir -p /home/fanz-deploy/.ssh
chmod 700 /home/fanz-deploy/.ssh

# Set up SSH key for deployment user (you'll need to add your public key)
log "Setting up SSH access..."
echo "# Add your deployment SSH public key here" > /home/fanz-deploy/.ssh/authorized_keys
chmod 600 /home/fanz-deploy/.ssh/authorized_keys
chown -R fanz-deploy:fanz-deploy /home/fanz-deploy/.ssh

# Configure firewall
log "Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp  # Traefik dashboard
echo "y" | ufw enable

# Configure fail2ban
log "Configuring fail2ban..."
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

cat > /etc/fail2ban/jail.d/ssh.conf << EOF
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
EOF

systemctl enable fail2ban
systemctl start fail2ban

# Create application directory
log "Creating application directories..."
mkdir -p /opt/fanz-money-dash
mkdir -p /opt/fanz-money-dash/logs
mkdir -p /opt/fanz-money-dash/backup
mkdir -p /opt/fanz-money-dash/ssl
chown -R fanz-deploy:fanz-deploy /opt/fanz-money-dash

# Install Node.js (for any Node.js specific tasks)
log "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Set up log rotation
log "Configuring log rotation..."
cat > /etc/logrotate.d/fanz-money-dash << EOF
/opt/fanz-money-dash/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Configure sysctl for better performance
log "Optimizing system parameters..."
cat >> /etc/sysctl.conf << EOF

# FANZ MoneyDash optimizations
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 60
net.ipv4.tcp_keepalive_probes = 10
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 65536 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
fs.file-max = 2097152
vm.swappiness = 10
EOF

sysctl -p

# Set up monitoring with basic scripts
log "Setting up monitoring scripts..."
mkdir -p /opt/monitoring

cat > /opt/monitoring/health-check.sh << 'EOF'
#!/bin/bash

# Simple health check script for FANZ MoneyDash
LOG_FILE="/var/log/fanz-health-check.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Check if application is responding
if curl -f -s http://localhost:3001/health > /dev/null; then
    echo "[$TIMESTAMP] Health check: OK" >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] Health check: FAILED" >> "$LOG_FILE"
    # Restart application if health check fails
    cd /opt/fanz-money-dash && docker-compose -f docker-compose.production.yml restart app
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "[$TIMESTAMP] Disk usage warning: ${DISK_USAGE}%" >> "$LOG_FILE"
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ "$MEM_USAGE" -gt 85 ]; then
    echo "[$TIMESTAMP] Memory usage warning: ${MEM_USAGE}%" >> "$LOG_FILE"
fi
EOF

chmod +x /opt/monitoring/health-check.sh

# Set up cron jobs
log "Setting up cron jobs..."
cat > /etc/cron.d/fanz-money-dash << EOF
# FANZ MoneyDash cron jobs
PATH=/usr/local/bin:/usr/bin:/bin

# Health check every 5 minutes
*/5 * * * * root /opt/monitoring/health-check.sh

# Database backup daily at 2 AM
0 2 * * * fanz-deploy cd /opt/fanz-money-dash && docker-compose -f docker-compose.production.yml exec -T mongodb mongodump --out /backup/\$(date +\%Y\%m\%d_\%H\%M\%S) && find /opt/fanz-money-dash/backup -name "*.bson" -mtime +7 -delete

# Clean up old Docker images weekly
0 3 * * 0 fanz-deploy docker system prune -f

# Renew SSL certificates
0 4 1 * * root certbot renew --quiet --post-hook "systemctl reload nginx"
EOF

# Configure timezone
log "Setting timezone to UTC..."
timedatectl set-timezone UTC

# Create deployment script
log "Creating deployment script..."
cat > /opt/fanz-money-dash/deploy.sh << 'EOF'
#!/bin/bash

# FANZ MoneyDash deployment script
set -e

cd /opt/fanz-money-dash

echo "Starting deployment..."

# Pull latest Docker images
doctl registry login
docker-compose -f docker-compose.production.yml pull

# Backup database
docker-compose -f docker-compose.production.yml exec -T mongodb mongodump --out /backup/pre-deploy-$(date +%Y%m%d_%H%M%S) || echo "Backup failed, continuing..."

# Deploy with zero downtime
docker-compose -f docker-compose.production.yml up -d --remove-orphans

# Health check
echo "Waiting for application to start..."
sleep 30

if curl -f http://localhost:3001/health; then
    echo "✅ Deployment successful!"
    echo "Deployment completed at $(date)" >> deployment.log
else
    echo "❌ Health check failed!"
    exit 1
fi

# Cleanup
docker system prune -f
echo "Cleanup completed."
EOF

chmod +x /opt/fanz-money-dash/deploy.sh
chown fanz-deploy:fanz-deploy /opt/fanz-money-dash/deploy.sh

# Set up SSL certificate preparation
log "Preparing SSL certificate setup..."
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# Create basic nginx configuration for SSL setup
cat > /etc/nginx/sites-available/fanz-money-dash << EOF
server {
    listen 80;
    server_name money.fanz.network;
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/fanz-money-dash /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

# Install system monitoring tools
log "Installing monitoring tools..."
apt install -y htop iotop nethogs

# Create system info script
cat > /opt/monitoring/system-info.sh << 'EOF'
#!/bin/bash

echo "=== FANZ MoneyDash System Information ==="
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo "Disk Usage:"
df -h
echo -e "\nMemory Usage:"
free -h
echo -e "\nDocker Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo -e "\nDocker Images:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
EOF

chmod +x /opt/monitoring/system-info.sh

# Final setup steps
log "Finalizing setup..."

# Add helpful aliases for the deployment user
cat >> /home/fanz-deploy/.bashrc << EOF

# FANZ MoneyDash aliases
alias fanz-logs='cd /opt/fanz-money-dash && docker-compose -f docker-compose.production.yml logs -f'
alias fanz-status='cd /opt/fanz-money-dash && docker-compose -f docker-compose.production.yml ps'
alias fanz-deploy='/opt/fanz-money-dash/deploy.sh'
alias fanz-info='/opt/monitoring/system-info.sh'
EOF

# Create a welcome message
cat > /etc/motd << 'EOF'

   ███████╗ █████╗ ███╗   ██╗███████╗    ███╗   ███╗ ██████╗ ███╗   ██╗███████╗██╗   ██╗
   ██╔════╝██╔══██╗████╗  ██║╚══███╔╝    ████╗ ████║██╔═══██╗████╗  ██║██╔════╝╚██╗ ██╔╝
   █████╗  ███████║██╔██╗ ██║  ███╔╝     ██╔████╔██║██║   ██║██╔██╗ ██║█████╗   ╚████╔╝ 
   ██╔══╝  ██╔══██║██║╚██╗██║ ███╔╝      ██║╚██╔╝██║██║   ██║██║╚██╗██║██╔══╝    ╚██╔╝  
   ██║     ██║  ██║██║ ╚████║███████╗    ██║ ╚═╝ ██║╚██████╔╝██║ ╚████║███████╗   ██║   
   ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝    ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝   
                                                                                          
                                    💰 MONEY DASHBOARD 💰
   
   Welcome to the FANZ MoneyDash production server!
   
   Useful commands:
   - fanz-status    : Check application status
   - fanz-logs      : View application logs
   - fanz-deploy    : Deploy latest version
   - fanz-info      : System information
   
   Deployment directory: /opt/fanz-money-dash
   
EOF

log "✅ Server setup completed successfully!"
log ""
log "Next steps:"
log "1. Add your SSH public key to /home/fanz-deploy/.ssh/authorized_keys"
log "2. Set up your domain DNS to point to this server"
log "3. Configure SSL certificates with: certbot --nginx -d money.fanz.network"
log "4. Copy your application files to /opt/fanz-money-dash/"
log "5. Create .env.production file with your environment variables"
log "6. Run the first deployment with: /opt/fanz-money-dash/deploy.sh"
log ""
log "Server is now ready for FANZ MoneyDash deployment! 🚀"