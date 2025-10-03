/**
 * FANZ WebSocket Client
 * Real-time financial updates and dashboard streaming for browser clients
 */

class FanzWebSocketClient {
    constructor(options = {}) {
        this.url = options.url || this.getWebSocketUrl();
        this.token = options.token || this.getAuthToken();
        this.reconnectInterval = options.reconnectInterval || 5000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
        this.heartbeatInterval = options.heartbeatInterval || 30000;
        
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.subscriptions = new Set();
        this.messageHandlers = new Map();
        this.heartbeatTimer = null;
        this.reconnectTimer = null;
        
        // Event handlers
        this.onConnectionChange = options.onConnectionChange || (() => {});
        this.onError = options.onError || ((error) => console.error('WebSocket error:', error));
        
        this.init();
    }

    getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
    }

    getAuthToken() {
        return localStorage.getItem('authToken') || 
               sessionStorage.getItem('authToken') ||
               document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    }

    init() {
        if (!this.token) {
            console.error('No authentication token available for WebSocket connection');
            return;
        }
        this.connect();
    }

    connect() {
        try {
            const wsUrl = `${this.url}?token=${encodeURIComponent(this.token)}`;
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = (event) => this.handleOpen(event);
            this.ws.onmessage = (event) => this.handleMessage(event);
            this.ws.onclose = (event) => this.handleClose(event);
            this.ws.onerror = (event) => this.handleError(event);
            
        } catch (error) {
            this.onError(error);
            this.scheduleReconnect();
        }
    }

    handleOpen(event) {
        console.log('WebSocket connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.onConnectionChange(true);
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Re-subscribe to channels
        this.resubscribeToChannels();
        
        // Show connection status
        this.updateConnectionStatus('connected');
    }

    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.processMessage(message);
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    }

    handleClose(event) {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.isConnected = false;
        this.onConnectionChange(false);
        this.stopHeartbeat();
        
        // Show connection status
        this.updateConnectionStatus('disconnected');
        
        // Attempt reconnection if not a normal closure
        if (event.code !== 1000) {
            this.scheduleReconnect();
        }
    }

    handleError(event) {
        console.error('WebSocket error:', event);
        this.onError(event);
        this.updateConnectionStatus('error');
    }

    processMessage(message) {
        const { type, data, timestamp } = message;
        
        // Handle system messages
        switch (type) {
            case 'connection_established':
                this.handleConnectionEstablished(message);
                break;
            
            case 'pong':
                // Heartbeat response - no action needed
                break;
            
            case 'subscription_confirmed':
                this.handleSubscriptionConfirmed(message);
                break;
            
            case 'subscription_error':
                this.handleSubscriptionError(message);
                break;
            
            case 'transaction_update':
                this.handleTransactionUpdate(data);
                break;
            
            case 'balance_update':
                this.handleBalanceUpdate(data);
                break;
            
            case 'payout_update':
                this.handlePayoutUpdate(data);
                break;
            
            case 'system_alert':
                this.handleSystemAlert(data);
                break;
            
            case 'market_data_update':
                this.handleMarketDataUpdate(data);
                break;
            
            case 'dashboard_data':
                this.handleDashboardData(message);
                break;
            
            case 'error':
                this.handleServerError(message);
                break;
            
            default:
                // Custom message handlers
                const handler = this.messageHandlers.get(type);
                if (handler) {
                    handler(data, message);
                } else {
                    console.warn('Unhandled message type:', type);
                }
        }
        
        // Emit custom event for external listeners
        this.emitEvent('message', message);
    }

    // Message handlers

    handleConnectionEstablished(message) {
        console.log('Connection established for user:', message.user);
        this.emitEvent('connected', message.user);
    }

    handleSubscriptionConfirmed(message) {
        console.log('Subscribed to channel:', message.channel);
        this.emitEvent('subscribed', message.channel);
    }

    handleSubscriptionError(message) {
        console.error('Subscription error:', message.error, 'for channel:', message.channel);
        this.emitEvent('subscription_error', message);
    }

    handleTransactionUpdate(transaction) {
        console.log('Transaction update received:', transaction);
        
        // Update transaction table
        this.updateTransactionInTable(transaction);
        
        // Update dashboard metrics
        this.updateDashboardMetrics();
        
        // Show notification for high-risk transactions
        if (transaction.riskLevel === 'HIGH' || transaction.riskLevel === 'CRITICAL') {
            this.showNotification('High-risk transaction detected', {
                type: 'warning',
                data: transaction
            });
        }
        
        this.emitEvent('transaction_update', transaction);
    }

    handleBalanceUpdate(balanceData) {
        console.log('Balance update received:', balanceData);
        
        // Update balance displays
        this.updateBalanceDisplays(balanceData);
        
        this.emitEvent('balance_update', balanceData);
    }

    handlePayoutUpdate(payout) {
        console.log('Payout update received:', payout);
        
        // Update payout table
        this.updatePayoutInTable(payout);
        
        // Show success notification
        if (payout.status === 'completed') {
            this.showNotification('Payout completed successfully', {
                type: 'success',
                data: payout
            });
        }
        
        this.emitEvent('payout_update', payout);
    }

    handleSystemAlert(alert) {
        console.log('System alert received:', alert);
        
        // Show system alert
        this.showSystemAlert(alert);
        
        this.emitEvent('system_alert', alert);
    }

    handleMarketDataUpdate(marketData) {
        // Update exchange rates and market data
        this.updateMarketDataDisplays(marketData);
        
        this.emitEvent('market_data_update', marketData);
    }

    handleDashboardData(message) {
        const { dashboardType, data } = message;
        
        // Update specific dashboard
        this.updateDashboard(dashboardType, data);
        
        this.emitEvent('dashboard_data', { dashboardType, data });
    }

    handleServerError(message) {
        console.error('Server error:', message.message);
        this.showNotification(message.message, { type: 'error' });
        this.emitEvent('server_error', message);
    }

    // Subscription management

    subscribe(channel, filters = {}) {
        if (!this.isConnected) {
            console.warn('Cannot subscribe: WebSocket not connected');
            return false;
        }
        
        const message = {
            type: 'subscribe',
            channel,
            filters
        };
        
        this.send(message);
        this.subscriptions.add(channel);
        return true;
    }

    unsubscribe(channel) {
        if (!this.isConnected) {
            console.warn('Cannot unsubscribe: WebSocket not connected');
            return false;
        }
        
        const message = {
            type: 'unsubscribe',
            channel
        };
        
        this.send(message);
        this.subscriptions.delete(channel);
        return true;
    }

    resubscribeToChannels() {
        this.subscriptions.forEach(channel => {
            this.send({
                type: 'subscribe',
                channel
            });
        });
    }

    // Dashboard data requests

    requestDashboardData(dashboardType, timeRange = 'day') {
        if (!this.isConnected) {
            console.warn('Cannot request dashboard data: WebSocket not connected');
            return false;
        }
        
        this.send({
            type: 'get_dashboard_data',
            dashboardType,
            timeRange
        });
        return true;
    }

    requestTransactionStream(filters = {}) {
        if (!this.isConnected) {
            console.warn('Cannot request transaction stream: WebSocket not connected');
            return false;
        }
        
        this.send({
            type: 'request_transaction_stream',
            filters
        });
        return true;
    }

    // Message sending

    send(message) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('Cannot send message: WebSocket not ready');
            return false;
        }
        
        try {
            this.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Failed to send WebSocket message:', error);
            return false;
        }
    }

    // Heartbeat management

    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.send({ type: 'ping' });
        }, this.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    // Reconnection logic

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.updateConnectionStatus('failed');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
        
        console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            this.updateConnectionStatus('reconnecting');
            this.connect();
        }, delay);
    }

    // UI Update methods

    updateConnectionStatus(status) {
        const statusElements = document.querySelectorAll('.ws-connection-status');
        statusElements.forEach(element => {
            element.className = `ws-connection-status status-${status}`;
            element.textContent = this.getStatusText(status);
        });
        
        // Update connection indicator
        const indicator = document.querySelector('.connection-indicator');
        if (indicator) {
            indicator.className = `connection-indicator ${status}`;
        }
    }

    getStatusText(status) {
        const statusTexts = {
            connected: 'Connected',
            disconnected: 'Disconnected',
            reconnecting: 'Reconnecting...',
            error: 'Connection Error',
            failed: 'Connection Failed'
        };
        return statusTexts[status] || status;
    }

    updateTransactionInTable(transaction) {
        const table = document.querySelector('#transactions-table tbody');
        if (!table) return;
        
        // Find existing row or create new one
        let row = table.querySelector(`tr[data-transaction-id="${transaction.id}"]`);
        if (!row) {
            row = table.insertRow(0); // Insert at top
            row.setAttribute('data-transaction-id', transaction.id);
            row.classList.add('new-transaction');
        }
        
        // Update row content
        row.innerHTML = `
            <td>${transaction.id}</td>
            <td>$${transaction.amount.toFixed(2)}</td>
            <td>${transaction.paymentMethod}</td>
            <td><span class="status-${transaction.status}">${transaction.status}</span></td>
            <td><span class="risk-${transaction.riskLevel?.toLowerCase()}">${transaction.riskLevel || 'LOW'}</span></td>
            <td>${new Date(transaction.createdAt).toLocaleString()}</td>
        `;
        
        // Highlight new/updated rows
        row.classList.add('updated');
        setTimeout(() => row.classList.remove('updated'), 2000);
    }

    updatePayoutInTable(payout) {
        const table = document.querySelector('#payouts-table tbody');
        if (!table) return;
        
        let row = table.querySelector(`tr[data-payout-id="${payout.id}"]`);
        if (!row) {
            row = table.insertRow(0);
            row.setAttribute('data-payout-id', payout.id);
        }
        
        row.innerHTML = `
            <td>${payout.id}</td>
            <td>$${payout.amount.toFixed(2)}</td>
            <td>${payout.method}</td>
            <td><span class="status-${payout.status}">${payout.status}</span></td>
            <td>${new Date(payout.scheduledAt).toLocaleString()}</td>
        `;
        
        row.classList.add('updated');
        setTimeout(() => row.classList.remove('updated'), 2000);
    }

    updateBalanceDisplays(balanceData) {
        // Update balance cards
        Object.keys(balanceData).forEach(currency => {
            const element = document.querySelector(`.balance-${currency.toLowerCase()}`);
            if (element) {
                element.textContent = `$${balanceData[currency].toFixed(2)}`;
                element.classList.add('updated');
                setTimeout(() => element.classList.remove('updated'), 1000);
            }
        });
    }

    updateMarketDataDisplays(marketData) {
        // Update exchange rate displays
        if (marketData.exchangeRates) {
            Object.keys(marketData.exchangeRates).forEach(pair => {
                const element = document.querySelector(`.rate-${pair.toLowerCase()}`);
                if (element) {
                    element.textContent = marketData.exchangeRates[pair].toFixed(4);
                }
            });
        }
    }

    updateDashboard(dashboardType, data) {
        const dashboard = document.querySelector(`[data-dashboard="${dashboardType}"]`);
        if (!dashboard) return;
        
        // Update dashboard metrics
        Object.keys(data).forEach(key => {
            const element = dashboard.querySelector(`[data-metric="${key}"]`);
            if (element) {
                if (typeof data[key] === 'number') {
                    element.textContent = data[key].toLocaleString();
                } else {
                    element.textContent = data[key];
                }
                element.classList.add('updated');
                setTimeout(() => element.classList.remove('updated'), 1000);
            }
        });
    }

    updateDashboardMetrics() {
        // Request fresh dashboard data
        this.requestDashboardData('financial_overview');
        this.requestDashboardData('risk_analysis');
    }

    showNotification(message, options = {}) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${options.type || 'info'}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        // Add to notifications container
        const container = document.querySelector('.notifications-container') || document.body;
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Handle close button
        notification.querySelector('.notification-close').onclick = () => {
            notification.parentNode.removeChild(notification);
        };
    }

    showSystemAlert(alert) {
        const alertClass = alert.severity === 'CRITICAL' ? 'alert-danger' : 'alert-warning';
        
        this.showNotification(alert.message, {
            type: alert.severity === 'CRITICAL' ? 'error' : 'warning'
        });
        
        // Also update system status if there's a status panel
        const statusPanel = document.querySelector('.system-status-panel');
        if (statusPanel) {
            statusPanel.className = `system-status-panel ${alertClass}`;
            statusPanel.textContent = alert.message;
        }
    }

    // Custom message handlers

    onMessage(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    offMessage(type) {
        this.messageHandlers.delete(type);
    }

    // Event system

    emitEvent(eventName, data) {
        const event = new CustomEvent(`fanz-ws:${eventName}`, { detail: data });
        document.dispatchEvent(event);
    }

    addEventListener(eventName, handler) {
        document.addEventListener(`fanz-ws:${eventName}`, handler);
    }

    removeEventListener(eventName, handler) {
        document.removeEventListener(`fanz-ws:${eventName}`, handler);
    }

    // Cleanup

    disconnect() {
        this.subscriptions.clear();
        this.stopHeartbeat();
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
        }
        
        this.updateConnectionStatus('disconnected');
    }

    destroy() {
        this.disconnect();
        this.messageHandlers.clear();
    }
}

// Auto-initialize if auth token is available
document.addEventListener('DOMContentLoaded', () => {
    const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (authToken) {
        window.fanzWS = new FanzWebSocketClient({
            onConnectionChange: (connected) => {
                console.log('WebSocket connection status:', connected ? 'Connected' : 'Disconnected');
            },
            onError: (error) => {
                console.error('WebSocket error:', error);
            }
        });
        
        // Subscribe to user's personal channel
        window.fanzWS.addEventListener('connected', (event) => {
            const user = event.detail;
            window.fanzWS.subscribe(`user:${user.id}`);
            
            // Subscribe to additional channels based on user role
            if (user.role === 'admin') {
                window.fanzWS.subscribe('system:alerts');
                window.fanzWS.subscribe('transactions:all');
            }
            
            // Request initial dashboard data
            window.fanzWS.requestDashboardData('financial_overview');
        });
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.fanzWS) {
        window.fanzWS.destroy();
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FanzWebSocketClient;
}