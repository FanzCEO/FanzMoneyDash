import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useWebSocket } from '../../contexts/WebSocketContext';

const Sidebar = () => {
  const location = useLocation();
  const { brandColors, brand } = useTheme();
  const { connected } = useWebSocket();

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      path: '/dashboard',
      description: 'Overview & KPIs'
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: '💰',
      path: '/transactions',
      description: 'Payment Processing',
      badge: connected ? 'LIVE' : null
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '📈',
      path: '/analytics',
      description: 'AI Insights & Reports'
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: '📋',
      path: '/compliance',
      description: 'Tax & Regulatory'
    },
    {
      id: 'blockchain',
      label: 'Blockchain',
      icon: '🔗',
      path: '/blockchain',
      description: 'Transparency & Verification'
    },
    {
      id: 'users',
      label: 'Users',
      icon: '👥',
      path: '/users',
      description: 'Creator & Fan Management'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: '📄',
      path: '/reports',
      description: 'Financial Reports'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      path: '/settings',
      description: 'System Configuration'
    }
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav">
        <div className="nav-header">
          <h2>Navigation</h2>
        </div>
        
        <ul className="nav-menu">
          {menuItems.map(item => (
            <li key={item.id} className="nav-item">
              <Link
                to={item.path}
                className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                style={{
                  borderLeftColor: isActive(item.path) ? brandColors[brand] : 'transparent'
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <div className="nav-content">
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-description">{item.description}</span>
                </div>
                {item.badge && (
                  <span 
                    className="nav-badge"
                    style={{ 
                      backgroundColor: brandColors[brand],
                      color: '#000'
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                {isActive(item.path) && (
                  <span 
                    className="nav-indicator"
                    style={{ backgroundColor: brandColors[brand] }}
                  ></span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div className="sidebar-footer">
          <div className="system-status">
            <div className="status-item">
              <span className="status-label">System Status</span>
              <span className={`status-value ${connected ? 'online' : 'offline'}`}>
                {connected ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="status-item">
              <span className="status-label">Version</span>
              <span className="status-value">v2.1.0</span>
            </div>
          </div>

          <div className="support-links">
            <a href="/help" className="support-link">
              <span>❓</span> Help & Support
            </a>
            <a href="/api/docs" className="support-link" target="_blank">
              <span>📚</span> API Docs
            </a>
          </div>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;