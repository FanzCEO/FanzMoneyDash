import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Dashboard() {
  const { subscribe, unsubscribe } = useWebSocket();
  const { brand } = useTheme();
  
  const [kpis, setKpis] = useState({
    totalRevenue: { value: 0, change: 0, loading: true },
    totalTransactions: { value: 0, change: 0, loading: true },
    activeCreators: { value: 0, change: 0, loading: true },
    pendingPayouts: { value: 0, change: 0, loading: true },
    fraudAlerts: { value: 0, change: 0, loading: true },
    complianceScore: { value: 0, change: 0, loading: true }
  });

  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    // Mock data loading
    const loadInitialData = async () => {
      // Simulate API call
      setTimeout(() => {
        setKpis({
          totalRevenue: { value: 1247500.89, change: 12.5, loading: false },
          totalTransactions: { value: 45623, change: 8.3, loading: false },
          activeCreators: { value: 2847, change: -2.1, loading: false },
          pendingPayouts: { value: 89750.45, change: -15.2, loading: false },
          fraudAlerts: { value: 3, change: -50.0, loading: false },
          complianceScore: { value: 98.5, change: 1.2, loading: false }
        });

        setRecentActivity([
          {
            id: 1,
            type: 'transaction',
            message: 'Large transaction processed: $2,450.00',
            timestamp: new Date(Date.now() - 300000).toISOString(),
            severity: 'info'
          },
          {
            id: 2,
            type: 'creator',
            message: 'New creator registration: @newcreator2024',
            timestamp: new Date(Date.now() - 600000).toISOString(),
            severity: 'success'
          },
          {
            id: 3,
            type: 'compliance',
            message: 'Tax report generated for Q4 2024',
            timestamp: new Date(Date.now() - 900000).toISOString(),
            severity: 'info'
          },
          {
            id: 4,
            type: 'payout',
            message: 'Batch payout completed: $45,230.75',
            timestamp: new Date(Date.now() - 1200000).toISOString(),
            severity: 'success'
          }
        ]);
      }, 1000);
    };

    loadInitialData();

    // Subscribe to real-time updates
    const handleKpiUpdate = (data) => {
      setKpis(prev => ({
        ...prev,
        [data.metric]: { ...prev[data.metric], ...data.data }
      }));
    };

    const handleActivityUpdate = (activity) => {
      setRecentActivity(prev => [activity, ...prev.slice(0, 9)]);
    };

    subscribe('kpi-update', handleKpiUpdate);
    subscribe('activity-update', handleActivityUpdate);

    return () => {
      unsubscribe('kpi-update', handleKpiUpdate);
      unsubscribe('activity-update', handleActivityUpdate);
    };
  }, [subscribe, unsubscribe]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getChangeIndicator = (change) => {
    if (change > 0) return { icon: '📈', color: 'var(--color-success)', direction: 'up' };
    if (change < 0) return { icon: '📉', color: 'var(--color-error)', direction: 'down' };
    return { icon: '➖', color: 'var(--color-textSecondary)', direction: 'neutral' };
  };

  const KpiCard = ({ title, value, change, loading, format = 'number', icon }) => {
    const changeIndicator = getChangeIndicator(change);
    
    return (
      <div className="kpi-card">
        <div className="kpi-card__header">
          <span className="kpi-card__icon">{icon}</span>
          <h3 className="kpi-card__title">{title}</h3>
        </div>
        
        <div className="kpi-card__content">
          {loading ? (
            <div className="kpi-card__loading">
              <div className="loading-shimmer"></div>
            </div>
          ) : (
            <>
              <div className="kpi-card__value">
                {format === 'currency' ? formatCurrency(value) : 
                 format === 'percentage' ? `${value}%` :
                 formatNumber(value)}
              </div>
              
              <div className="kpi-card__change" style={{ color: changeIndicator.color }}>
                <span className="kpi-card__change-icon">{changeIndicator.icon}</span>
                <span className="kpi-card__change-value">
                  {Math.abs(change)}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h1 className="dashboard__title">
          {brand.name} Financial Dashboard
        </h1>
        <p className="dashboard__subtitle">
          Real-time financial overview and key performance indicators
        </p>
      </div>

      {/* KPI Grid */}
      <div className="dashboard__kpis">
        <KpiCard
          title="Total Revenue"
          value={kpis.totalRevenue.value}
          change={kpis.totalRevenue.change}
          loading={kpis.totalRevenue.loading}
          format="currency"
          icon="💰"
        />
        
        <KpiCard
          title="Total Transactions"
          value={kpis.totalTransactions.value}
          change={kpis.totalTransactions.change}
          loading={kpis.totalTransactions.loading}
          icon="💳"
        />
        
        <KpiCard
          title="Active Creators"
          value={kpis.activeCreators.value}
          change={kpis.activeCreators.change}
          loading={kpis.activeCreators.loading}
          icon="👥"
        />
        
        <KpiCard
          title="Pending Payouts"
          value={kpis.pendingPayouts.value}
          change={kpis.pendingPayouts.change}
          loading={kpis.pendingPayouts.loading}
          format="currency"
          icon="📤"
        />
        
        <KpiCard
          title="Fraud Alerts"
          value={kpis.fraudAlerts.value}
          change={kpis.fraudAlerts.change}
          loading={kpis.fraudAlerts.loading}
          icon="🚨"
        />
        
        <KpiCard
          title="Compliance Score"
          value={kpis.complianceScore.value}
          change={kpis.complianceScore.change}
          loading={kpis.complianceScore.loading}
          format="percentage"
          icon="⚖️"
        />
      </div>

      {/* Quick Actions */}
      <div className="dashboard__actions">
        <h2 className="dashboard__section-title">Quick Actions</h2>
        <div className="quick-actions">
          <button className="quick-action-btn">
            <span className="quick-action-btn__icon">📊</span>
            <span className="quick-action-btn__label">Generate Report</span>
          </button>
          
          <button className="quick-action-btn">
            <span className="quick-action-btn__icon">💸</span>
            <span className="quick-action-btn__label">Process Payouts</span>
          </button>
          
          <button className="quick-action-btn">
            <span className="quick-action-btn__icon">🔍</span>
            <span className="quick-action-btn__label">Audit Transactions</span>
          </button>
          
          <button className="quick-action-btn">
            <span className="quick-action-btn__icon">⚙️</span>
            <span className="quick-action-btn__label">System Settings</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="dashboard__activity">
        <h2 className="dashboard__section-title">Recent Activity</h2>
        <div className="activity-feed">
          {recentActivity.length === 0 ? (
            <div className="activity-feed__empty">
              <span className="activity-feed__empty-icon">📭</span>
              <p className="activity-feed__empty-text">No recent activity</p>
            </div>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className={`activity-item activity-item--${activity.severity}`}>
                <div className="activity-item__content">
                  <span className="activity-item__message">{activity.message}</span>
                  <span className="activity-item__timestamp">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}