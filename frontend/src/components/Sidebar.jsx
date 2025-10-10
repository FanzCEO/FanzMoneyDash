import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const navigationItems = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: '📊',
    description: 'Overview & KPIs'
  },
  {
    path: '/transactions',
    label: 'Transactions',
    icon: '💳',
    description: 'Payment history'
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: '📈',
    description: 'AI insights'
  },
  {
    path: '/compliance',
    label: 'Compliance',
    icon: '⚖️',
    description: 'Legal & tax'
  },
  {
    path: '/users',
    label: 'Users',
    icon: '👥',
    description: 'Creator management'
  },
  {
    path: '/blockchain',
    label: 'Blockchain',
    icon: '🔗',
    description: 'On-chain data'
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: '📋',
    description: 'Financial reports'
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: '⚙️',
    description: 'System config'
  }
];

export default function Sidebar() {
  const { brand } = useTheme();

  return (
    <nav className="sidebar">
      <div className="sidebar__header">
        <h2 className="sidebar__title">Navigation</h2>
        <div className="sidebar__brand-indicator" style={{ backgroundColor: brand.primary }}>
          <span className="sidebar__brand-name">{brand.name}</span>
        </div>
      </div>

      <ul className="sidebar__nav">
        {navigationItems.map((item) => (
          <li key={item.path} className="sidebar__nav-item">
            <NavLink
              to={item.path}
              className={({ isActive }) => 
                `sidebar__nav-link ${isActive ? 'sidebar__nav-link--active' : ''}`
              }
              title={item.description}
            >
              <span className="sidebar__nav-icon">{item.icon}</span>
              <div className="sidebar__nav-content">
                <span className="sidebar__nav-label">{item.label}</span>
                <span className="sidebar__nav-description">{item.description}</span>
              </div>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="sidebar__footer">
        <div className="sidebar__system-info">
          <div className="sidebar__system-status">
            <span className="status-dot status-dot--online"></span>
            <span className="status-text">System Online</span>
          </div>
          <div className="sidebar__last-update">
            Last update: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </nav>
  );
}