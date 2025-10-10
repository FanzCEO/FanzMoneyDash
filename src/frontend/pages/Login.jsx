import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading } = useAuth();
  const { brandColors, brand } = useTheme();
  const { error: showError } = useToast();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, from]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await login(formData);
      
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        showError(result.message || 'Login failed');
      }
    } catch (err) {
      showError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const demoLogin = async () => {
    setFormData({
      email: 'admin@fanz.network',
      password: 'fanz2024'
    });
    
    setTimeout(async () => {
      const result = await login({
        email: 'admin@fanz.network',
        password: 'fanz2024'
      });
      
      if (!result.success) {
        showError('Demo login failed. Please try manual login.');
      }
    }, 100);
  };

  if (loading) {
    return <LoadingSpinner overlay message="Checking authentication..." />;
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="brand-logo">
              <span 
                className="brand-icon"
                style={{ color: brandColors[brand] }}
              >
                💰
              </span>
              <h1 className="brand-title">
                <span style={{ color: brandColors[brand] }}>FANZ</span>
                <span className="brand-subtitle">MoneyDash</span>
              </h1>
            </div>
            <p className="login-subtitle">
              Financial Command Center for the FANZ Ecosystem
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="Enter your email"
                disabled={isSubmitting}
                autoComplete="email"
              />
              {errors.email && (
                <span className="form-error">{errors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="Enter your password"
                disabled={isSubmitting}
                autoComplete="current-password"
              />
              {errors.password && (
                <span className="form-error">{errors.password}</span>
              )}
            </div>

            <button
              type="submit"
              className="login-button primary"
              disabled={isSubmitting}
              style={{ backgroundColor: brandColors[brand] }}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="small" message="" />
                  <span>Signing In...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="login-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="login-button secondary"
              onClick={demoLogin}
              disabled={isSubmitting}
            >
              🚀 Try Demo Login
            </button>
          </form>

          <div className="login-footer">
            <div className="login-links">
              <a href="#forgot" className="login-link">
                Forgot Password?
              </a>
              <a href="#support" className="login-link">
                Need Help?
              </a>
            </div>
            
            <div className="security-notice">
              <span className="security-icon">🔒</span>
              <span>Secure login protected by enterprise-grade security</span>
            </div>
          </div>
        </div>

        <div className="login-info">
          <h2>Powerful Financial Management</h2>
          <ul className="feature-list">
            <li>
              <span className="feature-icon">💰</span>
              Real-time transaction monitoring
            </li>
            <li>
              <span className="feature-icon">📊</span>
              AI-powered analytics & insights
            </li>
            <li>
              <span className="feature-icon">🔗</span>
              Blockchain transparency & verification
            </li>
            <li>
              <span className="feature-icon">📋</span>
              Automated compliance & reporting
            </li>
            <li>
              <span className="feature-icon">🛡️</span>
              Advanced fraud detection
            </li>
            <li>
              <span className="feature-icon">⚡</span>
              Lightning-fast payment processing
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Login;