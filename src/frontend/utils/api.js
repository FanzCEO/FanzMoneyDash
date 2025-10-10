// API utility functions for FANZ MoneyDash frontend

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

// Base API client with authentication and error handling
class APIClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    // Default headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add auth token if available
    const token = localStorage.getItem('fanz_token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(
          data.message || `HTTP ${response.status}`,
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      // Handle network errors
      throw new APIError(
        'Network error: Unable to connect to server',
        0,
        { originalError: error.message }
      );
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

const apiClient = new APIClient();

// Authentication API
export const authAPI = {
  async login(credentials) {
    return apiClient.post('/api/auth/login', credentials);
  },

  async verifyToken(token) {
    return apiClient.get('/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async logout() {
    return apiClient.post('/api/auth/logout');
  },

  async refreshToken() {
    return apiClient.post('/api/auth/refresh');
  }
};

// Dashboard API
export const dashboardAPI = {
  async getSummary() {
    return apiClient.get('/api/dashboard/summary');
  },

  async getKPIs() {
    return apiClient.get('/api/dashboard/kpis');
  },

  async getRecentActivity(limit = 10) {
    return apiClient.get(`/api/dashboard/activity?limit=${limit}`);
  }
};

// Transactions API
export const transactionsAPI = {
  async getTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/transactions?${query}`);
  },

  async getTransaction(id) {
    return apiClient.get(`/api/transactions/${id}`);
  },

  async processRefund(transactionId, amount, reason) {
    return apiClient.post(`/api/transactions/${transactionId}/refund`, {
      amount,
      reason
    });
  },

  async verifyTransaction(id) {
    return apiClient.post(`/api/transactions/${id}/verify`);
  },

  async getTransactionStats(timeRange = '30d') {
    return apiClient.get(`/api/transactions/stats?range=${timeRange}`);
  }
};

// Analytics API
export const analyticsAPI = {
  async getAnalytics(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/analytics?${query}`);
  },

  async getRevenueForecast(days = 30) {
    return apiClient.get(`/api/analytics/forecast?days=${days}`);
  },

  async getTrendAnalysis(metric, timeRange = '30d') {
    return apiClient.get(`/api/analytics/trends?metric=${metric}&range=${timeRange}`);
  },

  async getRiskAssessment() {
    return apiClient.get('/api/analytics/risk-assessment');
  },

  async getAnomalyDetection(timeRange = '7d') {
    return apiClient.get(`/api/analytics/anomalies?range=${timeRange}`);
  },

  async generateReport(type, params = {}) {
    return apiClient.post('/api/analytics/reports', {
      type,
      parameters: params
    });
  }
};

// Compliance API
export const complianceAPI = {
  async getComplianceStatus() {
    return apiClient.get('/api/compliance/status');
  },

  async getTaxCalculations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/compliance/tax-calculations?${query}`);
  },

  async generateTaxReport(jurisdiction, year) {
    return apiClient.post('/api/compliance/tax-reports', {
      jurisdiction,
      year
    });
  },

  async getComplianceScore() {
    return apiClient.get('/api/compliance/score');
  },

  async updateComplianceSettings(settings) {
    return apiClient.put('/api/compliance/settings', settings);
  }
};

// Blockchain API
export const blockchainAPI = {
  async getTransactionVerification(transactionId) {
    return apiClient.get(`/api/blockchain/verify/${transactionId}`);
  },

  async getCreatorEarnings(creatorId, timeRange = '30d') {
    return apiClient.get(`/api/blockchain/creator-earnings/${creatorId}?range=${timeRange}`);
  },

  async getTransparencyReport() {
    return apiClient.get('/api/blockchain/transparency-report');
  },

  async getBlockchainHealth() {
    return apiClient.get('/api/blockchain/health');
  }
};

// Users API
export const usersAPI = {
  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/users?${query}`);
  },

  async getUser(id) {
    return apiClient.get(`/api/users/${id}`);
  },

  async updateUser(id, userData) {
    return apiClient.put(`/api/users/${id}`, userData);
  },

  async deleteUser(id) {
    return apiClient.delete(`/api/users/${id}`);
  },

  async getUserStats(id) {
    return apiClient.get(`/api/users/${id}/stats`);
  }
};

// Reports API
export const reportsAPI = {
  async getReports() {
    return apiClient.get('/api/reports');
  },

  async generateReport(type, params = {}) {
    return apiClient.post('/api/reports/generate', {
      type,
      parameters: params
    });
  },

  async getReportStatus(reportId) {
    return apiClient.get(`/api/reports/${reportId}/status`);
  },

  async downloadReport(reportId) {
    const token = localStorage.getItem('fanz_token');
    const url = `${API_BASE_URL}/api/reports/${reportId}/download`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new APIError('Failed to download report', response.status);
    }

    return response.blob();
  }
};

// Notifications API
export const notificationsAPI = {
  async getNotifications(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/notifications?${query}`);
  },

  async markAsRead(notificationIds) {
    return apiClient.post('/api/notifications/mark-read', {
      notificationIds
    });
  },

  async getNotificationSettings() {
    return apiClient.get('/api/notifications/settings');
  },

  async updateNotificationSettings(settings) {
    return apiClient.put('/api/notifications/settings', settings);
  }
};

// System API
export const systemAPI = {
  async getHealth() {
    return apiClient.get('/api/health');
  },

  async getSystemStats() {
    return apiClient.get('/api/system/stats');
  },

  async getSystemLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/system/logs?${query}`);
  }
};

// File upload utility
export const uploadFile = async (file, endpoint = '/api/upload', onProgress = null) => {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('fanz_token');
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = (event.loaded / event.total) * 100;
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new APIError('Invalid response format', xhr.status));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new APIError(errorData.message || 'Upload failed', xhr.status, errorData));
        } catch (error) {
          reject(new APIError('Upload failed', xhr.status));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new APIError('Network error during upload', 0));
    });

    xhr.open('POST', `${API_BASE_URL}${endpoint}`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    
    xhr.send(formData);
  });
};

// Error handling helper
export const handleAPIError = (error, fallbackMessage = 'An error occurred') => {
  if (error instanceof APIError) {
    // Handle specific API errors
    switch (error.status) {
      case 401:
        // Unauthorized - redirect to login
        localStorage.removeItem('fanz_token');
        window.location.href = '/login';
        return 'Session expired. Please log in again.';
      case 403:
        return 'You don\'t have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return error.message || fallbackMessage;
    }
  }
  
  return fallbackMessage;
};

// Request interceptor for handling common tasks
export const setupAPIInterceptors = () => {
  // You could extend this to add global request/response interceptors
  // For example, automatic token refresh, request queuing, etc.
};

export { APIError, apiClient };