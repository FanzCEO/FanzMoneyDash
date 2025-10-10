import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (isAuthenticated && user) {
      connectSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, user]);

  const connectSocket = () => {
    if (socket?.connected) return;

    const token = localStorage.getItem('fanz_token');
    if (!token) return;

    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:3001', {
      auth: {
        token
      },
      transports: ['websocket'],
      upgrade: false
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      setReconnectAttempts(0);
      
      // Join user room for personalized updates
      if (user?.id) {
        newSocket.emit('join-room', `user-${user.id}`);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnected(false);
      
      // Auto-reconnect on unexpected disconnections
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        return;
      }
      
      attemptReconnect();
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
      attemptReconnect();
    });

    // Real-time event handlers
    newSocket.on('transaction-update', (data) => {
      window.dispatchEvent(new CustomEvent('transaction-update', { detail: data }));
    });

    newSocket.on('analytics-update', (data) => {
      window.dispatchEvent(new CustomEvent('analytics-update', { detail: data }));
    });

    newSocket.on('compliance-alert', (data) => {
      window.dispatchEvent(new CustomEvent('compliance-alert', { detail: data }));
    });

    newSocket.on('system-alert', (data) => {
      window.dispatchEvent(new CustomEvent('system-alert', { detail: data }));
    });

    newSocket.on('fraud-alert', (data) => {
      window.dispatchEvent(new CustomEvent('fraud-alert', { detail: data }));
    });

    setSocket(newSocket);
  };

  const attemptReconnect = () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    console.log(`Attempting to reconnect in ${timeout}ms (attempt ${reconnectAttempts + 1})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1);
      connectSocket();
    }, timeout);
  };

  const disconnectSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    
    setConnected(false);
    setReconnectAttempts(0);
  };

  const emit = (event, data) => {
    if (socket?.connected) {
      socket.emit(event, data);
    }
  };

  const subscribe = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
      
      // Return unsubscribe function
      return () => {
        socket.off(event, callback);
      };
    }
    return () => {};
  };

  const value = {
    socket,
    connected,
    emit,
    subscribe,
    reconnectAttempts
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};