import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ToastProvider } from './contexts/ToastContext';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import LoadingSpinner from './components/Common/LoadingSpinner';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import ErrorBoundary from './components/Common/ErrorBoundary';

// Lazy load pages for better performance
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Transactions = React.lazy(() => import('./pages/Transactions'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const Compliance = React.lazy(() => import('./pages/Compliance'));
const Users = React.lazy(() => import('./pages/Users'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Login = React.lazy(() => import('./pages/Login'));
const Blockchain = React.lazy(() => import('./pages/Blockchain'));
const Reports = React.lazy(() => import('./pages/Reports'));

const App = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <WebSocketProvider>
            <ToastProvider>
              <Router>
                <div className="app">
                  <Routes>
                    <Route path="/login" element={
                      <Suspense fallback={<LoadingSpinner />}>
                        <Login />
                      </Suspense>
                    } />
                    <Route path="/*" element={
                      <ProtectedRoute>
                        <div className="app-layout">
                          <Header />
                          <div className="app-body">
                            <Sidebar />
                            <main className="app-content">
                              <Suspense fallback={<LoadingSpinner />}>
                                <Routes>
                                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                  <Route path="/dashboard" element={<Dashboard />} />
                                  <Route path="/transactions" element={<Transactions />} />
                                  <Route path="/analytics" element={<Analytics />} />
                                  <Route path="/compliance" element={<Compliance />} />
                                  <Route path="/users" element={<Users />} />
                                  <Route path="/blockchain" element={<Blockchain />} />
                                  <Route path="/reports" element={<Reports />} />
                                  <Route path="/settings" element={<Settings />} />
                                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                                </Routes>
                              </Suspense>
                            </main>
                          </div>
                        </div>
                      </ProtectedRoute>
                    } />
                  </Routes>
                </div>
              </Router>
            </ToastProvider>
          </WebSocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;