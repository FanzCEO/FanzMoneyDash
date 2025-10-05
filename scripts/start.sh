#!/bin/bash

# FANZ Money Dash - Smart Start Script
# Advanced Financial Management Platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${PURPLE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════════════╗
║                        FANZ MONEY DASH                               ║
║              Advanced Financial Management Platform                   ║
║                    Creator Economy OS                                 ║
╚═══════════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Default values
MODE="development"
PORT=3001
HOST="localhost"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --production|-p)
            MODE="production"
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --help|-h)
            echo "FANZ Money Dash Start Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -p, --production    Start in production mode"
            echo "  --port PORT         Set server port (default: 3001)"
            echo "  --host HOST         Set server host (default: localhost)"
            echo "  -h, --help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                  # Start in development mode"
            echo "  $0 --production     # Start in production mode"
            echo "  $0 --port 8080      # Start on port 8080"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}🚀 Starting FANZ Money Dash in ${YELLOW}${MODE}${CYAN} mode...${NC}"
echo -e "${BLUE}📍 Server will run on: ${YELLOW}http://${HOST}:${PORT}${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ and try again.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 18+ and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: v${NODE_VERSION}${NC}"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Package manager: npm${NC}"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env file from template${NC}"
        echo -e "${YELLOW}📝 Please edit .env file with your configuration before continuing${NC}"
        echo -e "${CYAN}💡 Key settings to configure:${NC}"
        echo -e "${BLUE}   - JWT_SECRET: Add a secure secret key${NC}"
        echo -e "${BLUE}   - MONGODB_URI: Your MongoDB connection string${NC}"
        echo -e "${BLUE}   - Payment gateway credentials (CCBill, Segpay, etc.)${NC}"
        echo -e "${BLUE}   - Blockchain RPC URLs and private keys${NC}"
        echo ""
        read -p "Press Enter to continue after editing .env file..."
    else
        echo -e "${RED}❌ No .env.example file found. Please create a .env file manually.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Environment file found${NC}"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${CYAN}📦 Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Create logs directory
mkdir -p logs

# Check for required services
echo -e "${CYAN}🔍 Checking required services...${NC}"

# Check if MongoDB is running (optional check)
if command -v mongod &> /dev/null; then
    if pgrep mongod > /dev/null; then
        echo -e "${GREEN}✅ MongoDB is running${NC}"
    else
        echo -e "${YELLOW}⚠️  MongoDB is not running. Please start MongoDB first.${NC}"
        echo -e "${BLUE}   You can start it with: mongod --dbpath /data/db${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  MongoDB not found. Make sure it's installed and accessible.${NC}"
fi

# Check if Redis is running (optional)
if command -v redis-server &> /dev/null; then
    if pgrep redis-server > /dev/null; then
        echo -e "${GREEN}✅ Redis is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis is not running. Caching will use in-memory storage.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Redis not found. In-memory caching will be used.${NC}"
fi

# Export environment variables
export NODE_ENV=$MODE
export PORT=$PORT
export HOST=$HOST

echo ""
echo -e "${CYAN}🎯 Configuration:${NC}"
echo -e "${BLUE}   Environment: ${YELLOW}${NODE_ENV}${NC}"
echo -e "${BLUE}   Host: ${YELLOW}${HOST}${NC}"
echo -e "${BLUE}   Port: ${YELLOW}${PORT}${NC}"
echo -e "${BLUE}   Features:${NC}"
echo -e "${BLUE}     🤖 AI Analytics: ${GREEN}Enabled${NC}"
echo -e "${BLUE}     🔗 Blockchain: ${GREEN}Enabled${NC}"
echo -e "${BLUE}     📱 PWA: ${GREEN}Enabled${NC}"
echo -e "${BLUE}     ⚖️  Compliance: ${GREEN}Enabled${NC}"
echo -e "${BLUE}     📡 Real-time: ${GREEN}Enabled${NC}"
echo ""

# Start the application
echo -e "${GREEN}🚀 Starting FANZ Money Dash server...${NC}"
echo -e "${CYAN}🌐 Access the platform at: ${YELLOW}http://${HOST}:${PORT}${NC}"
echo -e "${CYAN}📚 API Documentation: ${YELLOW}http://${HOST}:${PORT}/api/docs${NC}"
echo -e "${CYAN}🏥 Health Check: ${YELLOW}http://${HOST}:${PORT}/health${NC}"
echo ""

# Different start commands based on mode
if [ "$MODE" = "production" ]; then
    # Production mode - use PM2 if available
    if command -v pm2 &> /dev/null; then
        echo -e "${CYAN}🔄 Starting with PM2 (production process manager)...${NC}"
        pm2 start src/server.js --name "fanz-money-dash" --env production
        echo -e "${GREEN}✅ Started successfully with PM2${NC}"
        echo -e "${CYAN}📊 View logs: ${YELLOW}pm2 logs fanz-money-dash${NC}"
        echo -e "${CYAN}🔄 Restart: ${YELLOW}pm2 restart fanz-money-dash${NC}"
        echo -e "${CYAN}🛑 Stop: ${YELLOW}pm2 stop fanz-money-dash${NC}"
    else
        echo -e "${CYAN}🔄 Starting in production mode...${NC}"
        node src/server.js
    fi
else
    # Development mode - use nodemon if available
    if command -v nodemon &> /dev/null; then
        echo -e "${CYAN}🔄 Starting with nodemon (auto-reload enabled)...${NC}"
        nodemon src/server.js
    else
        echo -e "${CYAN}🔄 Starting development server...${NC}"
        echo -e "${YELLOW}💡 Install nodemon for auto-reload: npm install -g nodemon${NC}"
        node src/server.js
    fi
fi