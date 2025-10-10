import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useToast } from '../../contexts/ToastContext';

const Header = () => {
  const { user, logout } = useAuth();
  const { theme, brand, toggleTheme, setBrand, brandColors } = useTheme();
  const { connected } = useWebSocket();
  const { success } = useToast();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showBrandMenu, setShowBrandMenu] = useState(false);

  const handleLogout = () => {
    logout();
    success('Logged out successfully');
  };

  const handleBrandChange = (newBrand) => {
    setBrand(newBrand);
    setShowBrandMenu(false);
    success(`Switched to ${newBrand.toUpperCase()} theme`);
  };

  const formatBrandName = (brand) => {
    const names = {
      fanz: 'FANZ',
      boyfanz: 'BoyFanz',
      girlfanz: 'GirlFanz',
      pupfanz: 'PupFanz',
      daddies: 'DaddiesFanz',
      cougarfanz: 'CougarFanz',
      taboofanz: 'TabooFanz'
    };
    return names[brand] || brand.toUpperCase();
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand-selector">
          <button 
            className="brand-button"
            onClick={() => setShowBrandMenu(!showBrandMenu)}
            style={{ color: brandColors[brand] }}
          >
            {formatBrandName(brand)} MoneyDash
            <span className="brand-arrow">▼</span>
          </button>
          
          {showBrandMenu && (
            <div className="brand-menu">
              {Object.keys(brandColors).map(brandKey => (
                <button
                  key={brandKey}
                  className={`brand-option ${brand === brandKey ? 'active' : ''}`}
                  onClick={() => handleBrandChange(brandKey)}
                  style={{ 
                    color: brandColors[brandKey],
                    borderColor: brand === brandKey ? brandColors[brandKey] : 'transparent'
                  }}
                >
                  <span 
                    className="brand-dot"
                    style={{ backgroundColor: brandColors[brandKey] }}
                  ></span>
                  {formatBrandName(brandKey)}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="connection-status">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="header-center">
        <h1 className="page-title">Financial Command Center</h1>
      </div>

      <div className="header-right">
        <button 
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <div className="user-menu">
          <button 
            className="user-button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="user-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                <span>{user?.name?.charAt(0) || 'U'}</span>
              )}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.name || 'User'}</span>
              <span className="user-role">{user?.role || 'Admin'}</span>
            </div>
            <span className="user-arrow">▼</span>
          </button>

          {showProfileMenu && (
            <div className="user-dropdown">
              <div className="dropdown-header">
                <div className="user-details">
                  <strong>{user?.name}</strong>
                  <span className="user-email">{user?.email}</span>
                </div>
              </div>
              
              <div className="dropdown-divider"></div>
              
              <a href="/settings" className="dropdown-item">
                ⚙️ Settings
              </a>
              <a href="/profile" className="dropdown-item">
                👤 Profile
              </a>
              <a href="/help" className="dropdown-item">
                ❓ Help & Support
              </a>
              
              <div className="dropdown-divider"></div>
              
              <button 
                className="dropdown-item logout"
                onClick={handleLogout}
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;