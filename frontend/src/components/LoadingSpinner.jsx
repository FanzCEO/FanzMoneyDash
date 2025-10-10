import React from 'react';

export default function LoadingSpinner({ message = 'Loading...', size = 'medium' }) {
  return (
    <div className={`loading-spinner loading-spinner--${size}`}>
      <div className="loading-spinner__spinner">
        <div className="loading-spinner__circle"></div>
      </div>
      {message && (
        <div className="loading-spinner__message">{message}</div>
      )}
    </div>
  );
}