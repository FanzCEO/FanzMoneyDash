import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../Common/LoadingSpinner';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner overlay message="Authenticating..." />;
  }

  if (!isAuthenticated) {
    // Redirect to login with return URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access if required
  if (requiredRole && user?.role !== requiredRole) {
    // You could redirect to an unauthorized page or show a message
    return (
      <div className="unauthorized-access">
        <div className="unauthorized-container">
          <div className="unauthorized-icon">🚫</div>
          <h1>Access Denied</h1>
          <p>You don't have permission to access this area.</p>
          <p>Required role: <strong>{requiredRole}</strong></p>
          <p>Your role: <strong>{user?.role || 'Unknown'}</strong></p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;