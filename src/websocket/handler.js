const websocketHandler = (io) => {
  console.log('📡 WebSocket server initialized');

  io.on('connection', (socket) => {
    console.log(`🔗 Client connected: ${socket.id}`);

    // Join user-specific room for personalized updates
    socket.on('join_user_room', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined personal room`);
    });

    // Handle financial data requests
    socket.on('subscribe_financial_updates', (userId) => {
      socket.join(`financial_${userId}`);
      console.log(`📊 User ${userId} subscribed to financial updates`);
      
      // Send initial data
      socket.emit('financial_update', {
        type: 'initial',
        data: {
          balance: 1000.00,
          recentTransactions: [],
          alerts: []
        }
      });
    });

    // Handle compliance notifications
    socket.on('subscribe_compliance_alerts', (userId) => {
      socket.join(`compliance_${userId}`);
      console.log(`⚖️ User ${userId} subscribed to compliance alerts`);
    });

    // Handle blockchain notifications
    socket.on('subscribe_blockchain_updates', (userId) => {
      socket.join(`blockchain_${userId}`);
      console.log(`🔗 User ${userId} subscribed to blockchain updates`);
    });

    // Handle AI insights requests
    socket.on('request_ai_insight', async (data) => {
      try {
        // Mock AI insight generation
        const insight = {
          type: 'revenue_forecast',
          message: 'Based on your recent activity, revenue is projected to increase by 15% next month.',
          confidence: 0.87,
          timestamp: new Date().toISOString()
        };

        socket.emit('ai_insight', insight);
      } catch (error) {
        console.error('AI insight error:', error);
        socket.emit('error', { message: 'Failed to generate AI insight' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Utility functions to broadcast updates
  io.broadcastFinancialUpdate = (userId, data) => {
    io.to(`financial_${userId}`).emit('financial_update', data);
  };

  io.broadcastComplianceAlert = (userId, alert) => {
    io.to(`compliance_${userId}`).emit('compliance_alert', alert);
  };

  io.broadcastBlockchainUpdate = (userId, update) => {
    io.to(`blockchain_${userId}`).emit('blockchain_update', update);
  };

  io.broadcastAIInsight = (userId, insight) => {
    io.to(`user_${userId}`).emit('ai_insight', insight);
  };
};

export default websocketHandler;