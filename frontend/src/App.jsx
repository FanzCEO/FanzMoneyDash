import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ToastProvider } from './contexts/ToastContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load pages
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Transactions = React.lazy(() => import('./pages/Transactions'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const Compliance = React.lazy(() => import('./pages/Compliance'));
const Users = React.lazy(() => import('./pages/Users'));
const Blockchain = React.lazy(() => import('./pages/Blockchain'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Settings = React.lazy(() => import('./pages/Settings'));

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <WebSocketProvider>
              <ToastProvider>
                <div className="app">
                  <Header />
                  <div className="app-content">
                    <Sidebar />
                    <main className="main-content">
                      <Suspense fallback={<LoadingSpinner />}>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/transactions" element={<Transactions />} />
                          <Route path="/analytics" element={<Analytics />} />
                          <Route path="/compliance" element={<Compliance />} />
                          <Route path="/users" element={<Users />} />
                          <Route path="/blockchain" element={<Blockchain />} />
                          <Route path="/reports" element={<Reports />} />
                          <Route path="/settings" element={<Settings />} />
                        </Routes>
                      </Suspense>
                    </main>
                  </div>
                </div>
              </ToastProvider>
            </WebSocketProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;