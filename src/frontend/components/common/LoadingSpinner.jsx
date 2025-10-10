import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const LoadingSpinner = ({ size = 'medium', message = 'Loading...', overlay = false }) => {
  const { brandColors, brand } = useTheme();

  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium',
    large: 'spinner-large'
  };

  const spinnerComponent = (
    <div className={`loading-spinner ${sizeClasses[size]}`}>
      <div 
        className="spinner-ring"
        style={{
          borderTopColor: brandColors[brand],
          borderRightColor: brandColors[brand]
        }}
      ></div>
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );

  if (overlay) {
    return (
      <div className="loading-overlay">
        {spinnerComponent}
      </div>
    );
  }

  return spinnerComponent;
};

export default LoadingSpinner;