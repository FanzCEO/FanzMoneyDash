import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useWebSocket } from '../contexts/WebSocketContext';

export default function Header() {
  const { user, logout } = useAuth();
  const { brand, currentTheme, currentBrand, toggleTheme, setBrand, brands } = useTheme();
  const { isConnected, connectionStatus } = useWebSocket();

  const handleBrandChange = (event) => {
    setBrand(event.target.value);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  return (
    <header className="header">
      <div className="header__left">
        <div className="header__logo">
          <h1 className="header__title">
            {brand.name} Money Dash
          </h1>
          <span className="header__version">v1.0.0</span>
        </div>
      </div>

      <div className="header__center">
        <div className="header__connection">
          <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="connection-indicator__dot"></span>
            <span className="connection-indicator__text">{connectionStatus}</span>
          </div>
        </div>
      </div>

      <div className="header__right">
        <div className="header__controls">
          {/* Brand Selector */}
          <div className="control-group">
            <label htmlFor="brand-select" className="control-label">Brand:</label>
            <select
              id="brand-select"
              className="brand-select"
              value={currentBrand || 'fanz'}
              onChange={handleBrandChange}
            >
              {Object.entries(brands).map(([key, brandInfo]) => (
                <option key={key} value={key}>
                  {brandInfo.name}
                </option>
              ))}
            </select>
          </div>

          {/* Theme Toggle */}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {currentTheme === 'dark' ? '🌞' : '🌙'}
          </button>

          {/* User Profile */}
          {user && (
            <div className="user-profile">
              <div className="user-profile__info">
                <img
                  src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7C4DFF&color=fff`}
                  alt={user.name}
                  className="user-profile__avatar"
                />
                <div className="user-profile__details">
                  <span className="user-profile__name">{user.name}</span>
                  <span className="user-profile__role">{user.role}</span>
                </div>
              </div>
              
              <div className="user-profile__actions">
                <button
                  className="logout-btn"
                  onClick={handleLogout}
                  title="Logout"
                >
                  🚪
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}