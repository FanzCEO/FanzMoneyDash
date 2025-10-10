import React, { createContext, useContext, useReducer, useEffect } from 'react';

const AuthContext = createContext();

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null
};

function authReducer(state, action) {
  switch (action.type) {
    case 'LOADING':
      return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null
      };
    case 'LOGIN_ERROR':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Mock authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        dispatch({ type: 'LOADING' });
        
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock user data - replace with real API call
        const mockUser = {
          id: '1',
          name: 'FANZ Admin',
          email: 'admin@fanz.network',
          role: 'admin',
          avatar: null,
          permissions: ['dashboard', 'transactions', 'analytics', 'compliance', 'users', 'blockchain', 'reports', 'settings']
        };
        
        dispatch({ type: 'LOGIN_SUCCESS', payload: mockUser });
      } catch (error) {
        dispatch({ type: 'LOGIN_ERROR', payload: error.message });
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    try {
      dispatch({ type: 'LOADING' });
      
      // Mock login - replace with real API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (credentials.email === 'admin@fanz.network' && credentials.password === 'password') {
        const user = {
          id: '1',
          name: 'FANZ Admin',
          email: credentials.email,
          role: 'admin',
          avatar: null,
          permissions: ['dashboard', 'transactions', 'analytics', 'compliance', 'users', 'blockchain', 'reports', 'settings']
        };
        
        localStorage.setItem('fanz_auth_token', 'mock-jwt-token');
        dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        return { success: true };
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      dispatch({ type: 'LOGIN_ERROR', payload: error.message });
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('fanz_auth_token');
    dispatch({ type: 'LOGOUT' });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value = {
    ...state,
    login,
    logout,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}