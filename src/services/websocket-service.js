/**
 * FANZ Real-time WebSocket Service
 * Handles real-time financial updates, notifications, and dashboard streaming
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const redis = require('redis');
const EventEmitter = require('events');
const { logger } = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');

class WebSocketService extends EventEmitter {
    constructor(server, options = {}) {
        super();
        
        this.server = server;
        this.clients = new Map(); // Map of userId to WebSocket connections
        this.rooms = new Map(); // Map of room names to Set of user IDs
        this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds
        this.maxConnections = options.maxConnections || 10000;
        this.connectionCount = 0;
        
        // Redis client for pub/sub across multiple server instances
        this.redisClient = redis.createClient({
            url: process.env.REDIS_URL
        });
        
        this.redisSubscriber = redis.createClient({
            url: process.env.REDIS_URL
        });
        
        this.initialize();
    }

    async initialize() {
        try {
            await this.redisClient.connect();
            await this.redisSubscriber.connect();
            
            // Set up WebSocket server
            this.wss = new WebSocket.Server({
                server: this.server,
                path: '/ws',
                verifyClient: (info) => this.verifyClient(info)
            });
            
            this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
            this.wss.on('error', (error) => {
                logger.error('WebSocket server error:', error);
            });
            
            // Subscribe to Redis channels for cross-instance messaging
            await this.redisSubscriber.subscribe('financial_updates', (message) => {
                this.broadcastToClients(JSON.parse(message));
            });
            
            await this.redisSubscriber.subscribe('notifications', (message) => {
                this.handleNotification(JSON.parse(message));
            });
            
            await this.redisSubscriber.subscribe('system_alerts', (message) => {
                this.handleSystemAlert(JSON.parse(message));
            });
            
            // Start heartbeat interval
            this.startHeartbeat();
            
            logger.info('WebSocket service initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize WebSocket service:', error);
            throw error;
        }
    }

    verifyClient(info) {
        try {
            // Check connection limit
            if (this.connectionCount >= this.maxConnections) {
                logger.warn('WebSocket connection rejected: maximum connections reached');
                return false;
            }
            
            // Extract token from URL query or headers
            const url = new URL(info.req.url, 'http://localhost');
            const token = url.searchParams.get('token') || info.req.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                logger.warn('WebSocket connection rejected: no authentication token');
                return false;
            }
            
            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            info.req.user = decoded;
            
            return true;
            
        } catch (error) {
            logger.warn('WebSocket connection rejected: invalid token', error.message);
            return false;
        }
    }

    handleConnection(ws, req) {
        try {
            const user = req.user;
            const userId = user.id;
            const connectionId = `${userId}_${Date.now()}_${Math.random()}`;
            
            // Store connection
            this.clients.set(connectionId, {
                ws,
                userId,
                user,
                connectedAt: new Date(),
                lastSeen: new Date(),
                subscriptions: new Set()
            });
            
            this.connectionCount++;
            
            // Set up connection event handlers
            ws.on('message', (data) => this.handleMessage(connectionId, data));
            ws.on('close', (code, reason) => this.handleDisconnection(connectionId, code, reason));
            ws.on('error', (error) => this.handleConnectionError(connectionId, error));
            ws.on('pong', () => this.handlePong(connectionId));
            
            // Send welcome message
            this.sendToConnection(connectionId, {
                type: 'connection_established',
                connectionId,
                timestamp: new Date(),
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
            
            // Join user to their personal room
            this.joinRoom(connectionId, `user:${userId}`);
            
            // Join user to role-based room if applicable
            if (user.role === 'admin' || user.role === 'security') {
                this.joinRoom(connectionId, `role:${user.role}`);
            }
            
            logger.info(`WebSocket connection established for user ${userId}`, {
                connectionId,
                userRole: user.role,
                totalConnections: this.connectionCount
            });
            
        } catch (error) {
            logger.error('Error handling WebSocket connection:', error);
            ws.terminate();
        }
    }

    handleMessage(connectionId, data) {
        try {
            const client = this.clients.get(connectionId);
            if (!client) return;
            
            client.lastSeen = new Date();
            
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'subscribe':
                    this.handleSubscription(connectionId, message);
                    break;
                
                case 'unsubscribe':
                    this.handleUnsubscription(connectionId, message);
                    break;
                
                case 'ping':
                    this.sendToConnection(connectionId, { type: 'pong', timestamp: new Date() });
                    break;
                
                case 'get_dashboard_data':
                    this.handleDashboardDataRequest(connectionId, message);
                    break;
                
                case 'request_transaction_stream':
                    this.handleTransactionStreamRequest(connectionId, message);
                    break;
                
                default:
                    logger.warn(`Unknown message type received: ${message.type}`, {
                        connectionId,
                        userId: client.userId
                    });
            }
            
        } catch (error) {
            logger.error('Error handling WebSocket message:', error);
        }
    }

    handleSubscription(connectionId, message) {
        const client = this.clients.get(connectionId);
        if (!client) return;
        
        const { channel, filters } = message;
        
        // Validate subscription permissions
        if (!this.canSubscribeToChannel(client.user, channel)) {
            this.sendToConnection(connectionId, {
                type: 'subscription_error',
                channel,
                error: 'Permission denied'
            });
            return;
        }
        
        // Add subscription
        client.subscriptions.add(channel);
        
        // Join relevant room
        this.joinRoom(connectionId, channel);
        
        this.sendToConnection(connectionId, {
            type: 'subscription_confirmed',
            channel,
            timestamp: new Date()
        });
        
        logger.info(`User subscribed to channel`, {
            userId: client.userId,
            channel,
            connectionId
        });
    }

    handleUnsubscription(connectionId, message) {
        const client = this.clients.get(connectionId);
        if (!client) return;
        
        const { channel } = message;
        
        client.subscriptions.delete(channel);
        this.leaveRoom(connectionId, channel);
        
        this.sendToConnection(connectionId, {
            type: 'unsubscription_confirmed',
            channel,
            timestamp: new Date()
        });
    }

    async handleDashboardDataRequest(connectionId, message) {
        try {
            const client = this.clients.get(connectionId);
            if (!client) return;
            
            const { dashboardType, timeRange } = message;
            
            // Get real-time dashboard data
            const dashboardData = await this.getDashboardData(client.user, dashboardType, timeRange);
            
            this.sendToConnection(connectionId, {
                type: 'dashboard_data',
                dashboardType,
                data: dashboardData,
                timestamp: new Date()
            });
            
        } catch (error) {
            logger.error('Error handling dashboard data request:', error);
            this.sendToConnection(connectionId, {
                type: 'error',
                message: 'Failed to fetch dashboard data'
            });
        }
    }

    handleDisconnection(connectionId, code, reason) {
        const client = this.clients.get(connectionId);
        if (client) {
            // Remove from all rooms
            client.subscriptions.forEach(channel => {
                this.leaveRoom(connectionId, channel);
            });
            
            this.clients.delete(connectionId);
            this.connectionCount--;
            
            logger.info(`WebSocket disconnection`, {
                connectionId,
                userId: client.userId,
                code,
                reason: reason.toString(),
                duration: Date.now() - client.connectedAt.getTime(),
                totalConnections: this.connectionCount
            });
        }
    }

    handleConnectionError(connectionId, error) {
        logger.error(`WebSocket connection error for ${connectionId}:`, error);
        this.clients.delete(connectionId);
        this.connectionCount--;
    }

    handlePong(connectionId) {
        const client = this.clients.get(connectionId);
        if (client) {
            client.lastSeen = new Date();
        }
    }

    // Real-time update methods

    async broadcastTransactionUpdate(transaction) {
        const message = {
            type: 'transaction_update',
            data: transaction,
            timestamp: new Date()
        };
        
        // Broadcast to user's personal channel
        await this.sendToRoom(`user:${transaction.userId}`, message);
        
        // Broadcast to admin/security channels if high-risk
        if (transaction.riskLevel === 'HIGH' || transaction.riskLevel === 'CRITICAL') {
            await this.sendToRoom('role:admin', message);
            await this.sendToRoom('role:security', message);
        }
        
        // Publish to Redis for other server instances
        await this.redisClient.publish('financial_updates', JSON.stringify({
            ...message,
            serverInstance: process.env.SERVER_INSTANCE_ID || 'default'
        }));
    }

    async broadcastBalanceUpdate(userId, balanceData) {
        const message = {
            type: 'balance_update',
            data: balanceData,
            timestamp: new Date()
        };
        
        await this.sendToRoom(`user:${userId}`, message);
        await this.redisClient.publish('financial_updates', JSON.stringify(message));
    }

    async broadcastPayoutUpdate(payout) {
        const message = {
            type: 'payout_update',
            data: payout,
            timestamp: new Date()
        };
        
        await this.sendToRoom(`user:${payout.userId}`, message);
        await this.redisClient.publish('financial_updates', JSON.stringify(message));
    }

    async broadcastSystemAlert(alert) {
        const message = {
            type: 'system_alert',
            data: alert,
            timestamp: new Date()
        };
        
        // Send to appropriate role-based rooms
        if (alert.severity === 'CRITICAL') {
            await this.sendToRoom('role:admin', message);
        }
        
        await this.sendToRoom('role:security', message);
        await this.redisClient.publish('system_alerts', JSON.stringify(message));
    }

    async broadcastMarketDataUpdate(marketData) {
        const message = {
            type: 'market_data_update',
            data: marketData,
            timestamp: new Date()
        };
        
        // Broadcast to all connected clients (for exchange rates, etc.)
        this.broadcastToAllClients(message);
        await this.redisClient.publish('financial_updates', JSON.stringify(message));
    }

    // Room management methods

    joinRoom(connectionId, roomName) {
        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, new Set());
        }
        this.rooms.get(roomName).add(connectionId);
    }

    leaveRoom(connectionId, roomName) {
        const room = this.rooms.get(roomName);
        if (room) {
            room.delete(connectionId);
            if (room.size === 0) {
                this.rooms.delete(roomName);
            }
        }
    }

    async sendToRoom(roomName, message) {
        const room = this.rooms.get(roomName);
        if (!room) return;
        
        const promises = Array.from(room).map(connectionId => {
            return this.sendToConnection(connectionId, message);
        });
        
        await Promise.allSettled(promises);
    }

    sendToConnection(connectionId, message) {
        const client = this.clients.get(connectionId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            return false;
        }
        
        try {
            client.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            logger.error(`Failed to send message to connection ${connectionId}:`, error);
            this.clients.delete(connectionId);
            this.connectionCount--;
            return false;
        }
    }

    broadcastToAllClients(message) {
        this.clients.forEach((client, connectionId) => {
            this.sendToConnection(connectionId, message);
        });
    }

    // Heartbeat and connection management

    startHeartbeat() {
        setInterval(() => {
            this.performHeartbeat();
        }, this.heartbeatInterval);
    }

    performHeartbeat() {
        const now = new Date();
        const timeout = this.heartbeatInterval * 2; // Allow 2 intervals for response
        
        this.clients.forEach((client, connectionId) => {
            if (now - client.lastSeen > timeout) {
                logger.warn(`Terminating inactive WebSocket connection: ${connectionId}`);
                client.ws.terminate();
                this.clients.delete(connectionId);
                this.connectionCount--;
                return;
            }
            
            // Send ping
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.ping();
            }
        });
    }

    // Permission and data methods

    canSubscribeToChannel(user, channel) {
        // Define channel permissions
        const permissions = {
            'transactions:all': ['admin', 'security'],
            'payouts:all': ['admin'],
            'system:alerts': ['admin', 'security'],
            'market:data': ['admin', 'analyst', 'creator']
        };
        
        // User can always subscribe to their own channels
        if (channel.startsWith(`user:${user.id}`)) {
            return true;
        }
        
        // Check role-based permissions
        const allowedRoles = permissions[channel];
        if (allowedRoles && allowedRoles.includes(user.role)) {
            return true;
        }
        
        return false;
    }

    async getDashboardData(user, dashboardType, timeRange) {
        // This would integrate with your existing analytics service
        // Placeholder implementation
        const baseData = {
            timestamp: new Date(),
            timeRange,
            dashboardType
        };
        
        switch (dashboardType) {
            case 'financial_overview':
                return {
                    ...baseData,
                    totalRevenue: 125000,
                    totalTransactions: 8450,
                    averageTransactionValue: 85.20,
                    topPerformingCreators: [
                        { name: 'Creator A', revenue: 15000 },
                        { name: 'Creator B', revenue: 12000 }
                    ]
                };
            
            case 'risk_analysis':
                return {
                    ...baseData,
                    riskScore: 0.23,
                    fraudDetected: 12,
                    suspiciousTransactions: 45,
                    riskTrends: [
                        { date: '2024-01-01', score: 0.21 },
                        { date: '2024-01-02', score: 0.25 }
                    ]
                };
            
            default:
                return baseData;
        }
    }

    // Cleanup and shutdown

    async shutdown() {
        try {
            logger.info('Shutting down WebSocket service...');
            
            // Close all client connections
            this.clients.forEach((client, connectionId) => {
                client.ws.close(1001, 'Server shutdown');
            });
            
            // Close WebSocket server
            if (this.wss) {
                this.wss.close();
            }
            
            // Close Redis connections
            await this.redisClient.quit();
            await this.redisSubscriber.quit();
            
            logger.info('WebSocket service shutdown completed');
            
        } catch (error) {
            logger.error('Error during WebSocket service shutdown:', error);
        }
    }

    // Statistics and monitoring

    getConnectionStats() {
        return {
            totalConnections: this.connectionCount,
            activeRooms: this.rooms.size,
            connectionsPerRoom: Array.from(this.rooms.entries()).map(([room, connections]) => ({
                room,
                connections: connections.size
            })),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }
}

// WebSocket middleware for transaction updates
class TransactionStreamHandler {
    constructor(websocketService) {
        this.ws = websocketService;
    }

    // Middleware to stream transaction updates
    transactionUpdateMiddleware() {
        return async (req, res, next) => {
            const originalSend = res.send;
            
            res.send = async function(data) {
                // Call original send
                const result = originalSend.call(this, data);
                
                // If this was a successful transaction update, stream it
                try {
                    const responseData = JSON.parse(data);
                    if (responseData.success && responseData.data && responseData.data.id) {
                        await this.ws.broadcastTransactionUpdate(responseData.data);
                    }
                } catch (error) {
                    // Ignore JSON parse errors
                }
                
                return result;
            }.bind(res);
            
            next();
        };
    }
}

module.exports = { WebSocketService, TransactionStreamHandler };