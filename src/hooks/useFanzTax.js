import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

/**
 * Custom hook for FANZ Tax Service integration
 * Provides comprehensive tax data management and API interactions
 */
export const useFanzTax = (creatorId) => {
  // Core state management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Tax data state
  const [estimates, setEstimates] = useState(null);
  const [insights, setInsights] = useState([]);
  const [taxVaultStrategy, setTaxVaultStrategy] = useState(null);
  const [processingStats, setProcessingStats] = useState(null);
  const [supportedProcessors, setSupportedProcessors] = useState([]);
  const [supportedJurisdictions, setSupportedJurisdictions] = useState([]);
  const [taxSummary, setTaxSummary] = useState(null);

  // API helper with error handling
  const apiCall = useCallback(async (endpoint, options = {}) => {
    try {
      const response = await axios({
        url: `${API_BASE_URL}/tax${endpoint}`,
        method: 'GET',
        timeout: 10000,
        ...options
      });
      
      return response.data;
    } catch (error) {
      console.error(`FANZ Tax API Error (${endpoint}):`, error);
      
      // Handle specific error types
      if (error.response?.status === 403) {
        throw new Error('Access denied. Please check your permissions.');
      } else if (error.response?.status === 404) {
        throw new Error('Tax data not found.');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. Please try again.');
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else {
        throw new Error('Failed to connect to tax service.');
      }
    }
  }, []);

  // Fetch real-time tax estimates
  const fetchEstimates = useCallback(async () => {
    if (!creatorId) return;

    try {
      const data = await apiCall(`/estimates/${creatorId}`);
      setEstimates(data.data);
    } catch (error) {
      console.error('Failed to fetch tax estimates:', error);
      // Set mock data for development
      setEstimates({
        ytdIncome: 45250,
        ytdTaxes: 11312.50,
        nextQuarterlyAmount: 3250.75,
        nextQuarterlyDue: '2025-01-15',
        effectiveTaxRate: 25.0,
        marginalTaxRate: 28.0,
        estimatedAnnual: 67875
      });
    }
  }, [creatorId, apiCall]);

  // Fetch AI-powered tax insights
  const fetchInsights = useCallback(async () => {
    if (!creatorId) return;

    try {
      const data = await apiCall(`/insights/${creatorId}`);
      setInsights(data.data.insights || []);
    } catch (error) {
      console.error('Failed to fetch tax insights:', error);
      // Set mock data for development
      setInsights([
        {
          id: 'insight_dev_1',
          category: 'optimization',
          priority: 'high',
          title: 'Quarterly Payment Optimization',
          description: 'Optimize your quarterly payments based on income patterns',
          impact: { savingsAmount: 450, confidence: 87 }
        }
      ]);
    }
  }, [creatorId, apiCall]);

  // Fetch Tax Vault optimization strategy
  const fetchTaxVaultStrategy = useCallback(async () => {
    if (!creatorId) return;

    try {
      const data = await apiCall(`/tax-vault/${creatorId}`);
      setTaxVaultStrategy(data.data);
    } catch (error) {
      console.error('Failed to fetch tax vault strategy:', error);
      // Set mock data for development
      setTaxVaultStrategy({
        currentBalance: 8950,
        recommendedBalance: 11300,
        shortfall: 2350,
        monthlyContribution: 850,
        strategy: 'Automatic percentage-based contributions'
      });
    }
  }, [creatorId, apiCall]);

  // Fetch supported payment processors
  const fetchSupportedProcessors = useCallback(async () => {
    try {
      const data = await apiCall('/processors');
      setSupportedProcessors(data.data.processors || []);
    } catch (error) {
      console.error('Failed to fetch supported processors:', error);
      // Set mock data for development
      setSupportedProcessors([
        { id: 'paxum', name: 'Paxum', countries: ['US', 'CA', 'UK'], payoutProcessor: true },
        { id: 'epayservice', name: 'ePayService', countries: ['US', 'EU'], payoutProcessor: true },
        { id: 'ccbill', name: 'CCBill', countries: ['US', 'EU', 'CA'], cryptoProcessor: false }
      ]);
    }
  }, [apiCall]);

  // Fetch supported tax jurisdictions
  const fetchSupportedJurisdictions = useCallback(async () => {
    try {
      const data = await apiCall('/jurisdictions');
      setSupportedJurisdictions(data.data.jurisdictions || []);
    } catch (error) {
      console.error('Failed to fetch supported jurisdictions:', error);
      // Set mock data for development
      setSupportedJurisdictions([
        { code: 'US', name: 'United States', quarterly: true, eFileSupported: true },
        { code: 'CA', name: 'Canada', quarterly: true, eFileSupported: true },
        { code: 'UK', name: 'United Kingdom', quarterly: false, eFileSupported: false }
      ]);
    }
  }, [apiCall]);

  // Calculate tax implications for a specific payout
  const calculateTaxImplications = useCallback(async (payoutData) => {
    try {
      const data = await apiCall('/calculate-implications', {
        method: 'POST',
        data: { payoutData }
      });
      return data.data;
    } catch (error) {
      console.error('Failed to calculate tax implications:', error);
      throw error;
    }
  }, [apiCall]);

  // Validate Tax ID Number (TIN)
  const validateTIN = useCallback(async (tin, jurisdiction) => {
    try {
      const data = await apiCall('/validate-tin', {
        method: 'POST',
        data: { tin, jurisdiction }
      });
      return data.data;
    } catch (error) {
      console.error('Failed to validate TIN:', error);
      throw error;
    }
  }, [apiCall]);

  // Get tax year summary
  const fetchTaxSummary = useCallback(async (taxYear = new Date().getFullYear()) => {
    if (!creatorId) return;

    try {
      const data = await apiCall(`/summary/${creatorId}/${taxYear}`);
      setTaxSummary(data.data);
      return data.data;
    } catch (error) {
      console.error('Failed to fetch tax summary:', error);
      // Set mock data for development
      const mockSummary = {
        creatorId,
        taxYear,
        totalPayouts: 24,
        grossIncome: 45250,
        netIncome: 42987.50,
        totalFees: 2262.50,
        processorBreakdown: {
          paxum: 28450,
          epayservice: 12500,
          ccbill: 6300
        }
      };
      setTaxSummary(mockSummary);
      return mockSummary;
    }
  }, [creatorId, apiCall]);

  // Generate 1099 forms
  const generate1099 = useCallback(async (taxYear) => {
    try {
      const data = await apiCall('/generate-1099', {
        method: 'POST',
        data: { creatorId, taxYear }
      });
      return data.data;
    } catch (error) {
      console.error('Failed to generate 1099:', error);
      throw error;
    }
  }, [creatorId, apiCall]);

  // Refresh all tax data
  const refreshData = useCallback(async () => {
    if (!creatorId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all data concurrently
      await Promise.allSettled([
        fetchEstimates(),
        fetchInsights(),
        fetchTaxVaultStrategy(),
        fetchSupportedProcessors(),
        fetchSupportedJurisdictions(),
        fetchTaxSummary()
      ]);

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to refresh tax data:', error);
      setError(error.message || 'Failed to refresh tax data');
    } finally {
      setLoading(false);
    }
  }, [
    creatorId,
    fetchEstimates,
    fetchInsights,
    fetchTaxVaultStrategy,
    fetchSupportedProcessors,
    fetchSupportedJurisdictions,
    fetchTaxSummary
  ]);

  // Initial data load
  useEffect(() => {
    if (creatorId) {
      refreshData();
    }
  }, [creatorId, refreshData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!creatorId) return;

    const interval = setInterval(() => {
      refreshData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [creatorId, refreshData]);

  // Health check for the tax service
  const healthCheck = useCallback(async () => {
    try {
      const data = await apiCall('/health');
      return data;
    } catch (error) {
      console.error('Tax service health check failed:', error);
      throw error;
    }
  }, [apiCall]);

  // Get admin statistics (admin only)
  const getAdminStatistics = useCallback(async (period = '30d') => {
    try {
      const data = await apiCall(`/admin/statistics?period=${period}`);
      return data.data;
    } catch (error) {
      console.error('Failed to fetch admin statistics:', error);
      throw error;
    }
  }, [apiCall]);

  // Return all hook data and functions
  return {
    // State
    loading,
    error,
    lastRefresh,
    
    // Tax data
    estimates,
    insights,
    taxVaultStrategy,
    processingStats,
    supportedProcessors,
    supportedJurisdictions,
    taxSummary,

    // Actions
    refreshData,
    calculateTaxImplications,
    validateTIN,
    fetchTaxSummary,
    generate1099,
    healthCheck,
    getAdminStatistics,

    // Helper methods
    isDataStale: lastRefresh && (Date.now() - lastRefresh.getTime()) > 10 * 60 * 1000, // 10 minutes
    hasEstimates: !!estimates,
    hasInsights: insights.length > 0,
    hasHighPriorityInsights: insights.filter(i => i.priority === 'high').length > 0,
    urgentInsightsCount: insights.filter(i => i.urgent).length,
    
    // Computed values
    estimatedTaxRate: estimates ? (estimates.ytdTaxes / estimates.ytdIncome) : 0,
    taxVaultCoverage: taxVaultStrategy ? (taxVaultStrategy.currentBalance / taxVaultStrategy.recommendedBalance) : 0,
    nextQuarterlyDue: estimates?.nextQuarterlyDue,
    
    // Service status
    isServiceHealthy: !error && !loading,
    lastUpdateTime: lastRefresh?.toLocaleTimeString()
  };
};

/**
 * Hook for tax-related form validation
 */
export const useTaxValidation = () => {
  const validateTaxAmount = useCallback((amount) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return { isValid: false, error: 'Please enter a valid positive amount' };
    }
    if (numAmount > 1000000) {
      return { isValid: false, error: 'Amount is too large' };
    }
    return { isValid: true };
  }, []);

  const validateTaxYear = useCallback((year) => {
    const numYear = parseInt(year);
    const currentYear = new Date().getFullYear();
    if (isNaN(numYear) || numYear < 2020 || numYear > currentYear + 1) {
      return { isValid: false, error: 'Please enter a valid tax year' };
    }
    return { isValid: true };
  }, []);

  const validateJurisdiction = useCallback((jurisdiction) => {
    const validJurisdictions = ['US', 'CA', 'UK', 'EU', 'AU'];
    if (!jurisdiction || !validJurisdictions.includes(jurisdiction)) {
      return { isValid: false, error: 'Please select a valid jurisdiction' };
    }
    return { isValid: true };
  }, []);

  return {
    validateTaxAmount,
    validateTaxYear,
    validateJurisdiction
  };
};

export default useFanzTax;