import React, { createContext, useContext, useReducer, useEffect } from 'react';

const ToastContext = createContext();

const toastReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.payload]
      };
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.payload)
      };
    case 'CLEAR_ALL':
      return {
        ...state,
        toasts: []
      };
    default:
      return state;
  }
};

const initialState = {
  toasts: []
};

export const ToastProvider = ({ children }) => {
  const [state, dispatch] = useReducer(toastReducer, initialState);

  const addToast = (message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      message,
      type, // success, error, warning, info
      duration: options.duration || (type === 'error' ? 5000 : 3000),
      persistent: options.persistent || false,
      action: options.action || null,
      ...options
    };

    dispatch({ type: 'ADD_TOAST', payload: toast });

    // Auto remove non-persistent toasts
    if (!toast.persistent) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration);
    }

    return id;
  };

  const removeToast = (id) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  };

  const clearAll = () => {
    dispatch({ type: 'CLEAR_ALL' });
  };

  // Convenience methods
  const success = (message, options = {}) => addToast(message, 'success', options);
  const error = (message, options = {}) => addToast(message, 'error', options);
  const warning = (message, options = {}) => addToast(message, 'warning', options);
  const info = (message, options = {}) => addToast(message, 'info', options);

  const value = {
    toasts: state.toasts,
    addToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={state.toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

const Toast = ({ toast, onRemove }) => {
  const handleRemove = () => {
    onRemove(toast.id);
  };

  const getToastIcon = (type) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className={`toast toast-${toast.type}`} role="alert" aria-live="polite">
      <div className="toast-content">
        <span className="toast-icon">{getToastIcon(toast.type)}</span>
        <span className="toast-message">{toast.message}</span>
        {toast.action && (
          <button 
            className="toast-action" 
            onClick={toast.action.onClick}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {!toast.persistent && (
        <button className="toast-close" onClick={handleRemove} aria-label="Close notification">
          ×
        </button>
      )}
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};