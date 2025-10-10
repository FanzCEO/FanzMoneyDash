import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';

const Dashboard = () => {
  const { brandColors, brand } = useTheme();
  const { connected, subscribe } = useWebSocket();
  const { success, error } = useToast();
  
  const [dashboardData, setDashboardData] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    activeCreators: 0,
    pendingPayouts: 0,
    fraudAlerts: 0,
    complianceScore: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [realtimeUpdates, setRealtimeUpdates] = useState([]);

  useEffect(() => {
    loadDashboardData();
    
    // Subscribe to real-time updates
    const unsubscribe = subscribe('dashboard-update', (data) => {
      setDashboardData(prev => ({ ...prev, ...data }));
      setRealtimeUpdates(prev => [
        { timestamp: new Date(), type: 'update', data },
        ...prev.slice(0, 9) // Keep last 10 updates
      ]);
    });

    return unsubscribe;
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Simulated API call - replace with actual API
      const response = await fetch('/api/dashboard/summary');
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        // Fallback with mock data
        setTimeout(() => {
          setDashboardData({
            totalRevenue: 1250000.50,
            totalTransactions: 45623,
            activeCreators: 2847,
            pendingPayouts: 125000.00,
            fraudAlerts: 3,
            complianceScore: 98.5
          });
        }, 1000);
      }
    } catch (err) {
      error('Failed to load dashboard data');
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const kpiCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(dashboardData.totalRevenue),
      icon: '💰',
      trend: '+12.5%',
      trendUp: true,
      color: brandColors[brand]
    },
    {
      title: 'Transactions',
      value: formatNumber(dashboardData.totalTransactions),
      icon: '🏦',
      trend: '+8.2%',
      trendUp: true,
      color: '#39FF14'
    },
    {
      title: 'Active Creators',
      value: formatNumber(dashboardData.activeCreators),
      icon: '👥',
      trend: '+15.7%',
      trendUp: true,
      color: '#FFD600'
    },
    {
      title: 'Pending Payouts',
      value: formatCurrency(dashboardData.pendingPayouts),
      icon: '⏳',
      trend: '-5.3%',
      trendUp: false,
      color: '#FF2D95'
    },
    {
      title: 'Fraud Alerts',
      value: dashboardData.fraudAlerts,
      icon: '🚨',
      trend: '-25%',
      trendUp: false,
      color: dashboardData.fraudAlerts > 5 ? '#FF1744' : '#39FF14'
    },
    {
      title: 'Compliance Score',
      value: `${dashboardData.complianceScore}%`,
      icon: '📋',
      trend: '+2.1%',
      trendUp: true,
      color: dashboardData.complianceScore > 95 ? '#39FF14' : '#FFD600'
    }
  ];

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="page-title-section">
          <h1 className="page-title">Financial Dashboard</h1>
          <p className="page-subtitle">Real-time overview of FANZ financial operations</p>
        </div>
        
        <div className="dashboard-controls">
          <div className="connection-indicator">
            <span className={`indicator-dot ${connected ? 'connected' : 'disconnected'}`}></span>
            <span>{connected ? 'Live Updates' : 'Offline'}</span>
          </div>
          <button 
            className="refresh-button"
            onClick={loadDashboardData}
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {kpiCards.map((kpi, index) => (
          <div key={index} className="kpi-card" style={{ borderColor: kpi.color }}>
            <div className="kpi-header">
              <span className="kpi-icon">{kpi.icon}</span>
              <h3 className="kpi-title">{kpi.title}</h3>
            </div>
            
            <div className="kpi-value" style={{ color: kpi.color }}>
              {kpi.value}
            </div>
            
            <div className={`kpi-trend ${kpi.trendUp ? 'up' : 'down'}`}>
              <span className="trend-icon">{kpi.trendUp ? '↗️' : '↘️'}</span>
              <span className="trend-value">{kpi.trend}</span>
              <span className="trend-period">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-content">
        <div className="content-section">
          <div className="section-card">
            <h2 className="section-title">Quick Actions</h2>
            <div className="quick-actions">
              <a href="/transactions" className="action-button">
                <span className="action-icon">💳</span>
                <span className="action-text">View Transactions</span>
              </a>
              <a href="/compliance" className="action-button">
                <span className="action-icon">📋</span>
                <span className="action-text">Compliance Check</span>
              </a>
              <a href="/analytics" className="action-button">
                <span className="action-icon">📊</span>
                <span className="action-text">View Analytics</span>
              </a>
              <a href="/reports" className="action-button">
                <span className="action-icon">📄</span>
                <span className="action-text">Generate Reports</span>
              </a>
            </div>
          </div>
        </div>

        <div className="content-section">
          <div className="section-card">
            <h2 className="section-title">Recent Activity</h2>
            <div className="activity-feed">
              {realtimeUpdates.length > 0 ? (
                realtimeUpdates.map((update, index) => (
                  <div key={index} className="activity-item">
                    <span className="activity-time">
                      {update.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="activity-text">
                      Dashboard data updated
                    </span>
                    <span className="activity-badge live">LIVE</span>
                  </div>
                ))
              ) : (
                <div className="activity-placeholder">
                  <span>💫</span>
                  <p>Real-time updates will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-footer">
        <div className="system-info">
          <span>Last updated: {new Date().toLocaleString()}</span>
          <span>•</span>
          <span>System: Operational</span>
          <span>•</span>
          <span style={{ color: brandColors[brand] }}>
            FANZ MoneyDash v2.1.0
          </span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;