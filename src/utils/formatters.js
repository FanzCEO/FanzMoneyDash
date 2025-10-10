/**
 * FANZ Formatting Utilities
 * Provides consistent formatting for currency, percentages, dates, and other data types
 * Used throughout the FANZ Tax Dashboard and other components
 */

/**
 * Format currency amounts with proper locale and currency symbol
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: 'USD')
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0.00';
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    // Fallback for invalid currency/locale
    console.warn('Currency formatting error:', error);
    return `$${Number(amount).toFixed(2)}`;
  }
};

/**
 * Format percentages with proper decimal places
 * @param {number} value - The decimal value to format (0.25 = 25%)
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }

  // Handle both decimal (0.25) and percentage (25) inputs
  const percentage = value > 1 ? value : value * 100;
  
  return `${percentage.toFixed(decimals)}%`;
};

/**
 * Format large numbers with appropriate suffixes (K, M, B)
 * @param {number} num - The number to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted number string
 */
export const formatCompactNumber = (num, decimals = 1) => {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 1e9) {
    return `${sign}${(absNum / 1e9).toFixed(decimals)}B`;
  } else if (absNum >= 1e6) {
    return `${sign}${(absNum / 1e6).toFixed(decimals)}M`;
  } else if (absNum >= 1e3) {
    return `${sign}${(absNum / 1e3).toFixed(decimals)}K`;
  }

  return num.toString();
};

/**
 * Format dates in a user-friendly format
 * @param {Date|string} date - The date to format
 * @param {string} format - Format type ('short', 'long', 'relative')
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'short', locale = 'en-US') => {
  if (!date) return '';

  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    
    case 'long':
      return dateObj.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    
    case 'relative':
      return formatRelativeDate(dateObj);
    
    case 'time':
      return dateObj.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    
    default:
      return dateObj.toLocaleDateString(locale);
  }
};

/**
 * Format relative dates (e.g., "2 days ago", "in 3 hours")
 * @param {Date} date - The date to format relatively
 * @returns {string} Relative date string
 */
export const formatRelativeDate = (date) => {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (Math.abs(diffDays) >= 1) {
    if (diffDays > 0) {
      return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
    } else {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
    }
  }

  if (Math.abs(diffHours) >= 1) {
    if (diffHours > 0) {
      return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
    } else {
      return `${Math.abs(diffHours)} hour${Math.abs(diffHours) === 1 ? '' : 's'} ago`;
    }
  }

  if (Math.abs(diffMinutes) >= 1) {
    if (diffMinutes > 0) {
      return `in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
    } else {
      return `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) === 1 ? '' : 's'} ago`;
    }
  }

  return 'just now';
};

/**
 * Format tax rates with proper context
 * @param {number} rate - Tax rate as decimal (0.25) or percentage (25)
 * @param {string} type - Rate type ('effective', 'marginal', 'standard')
 * @returns {string} Formatted tax rate string
 */
export const formatTaxRate = (rate, type = 'standard') => {
  const percentage = formatPercentage(rate, 1);
  
  switch (type) {
    case 'effective':
      return `${percentage} effective`;
    case 'marginal':
      return `${percentage} marginal`;
    default:
      return percentage;
  }
};

/**
 * Format file sizes in human-readable format
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted file size string
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (!bytes) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

/**
 * Format duration in human-readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export const formatDuration = (seconds) => {
  if (!seconds) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

/**
 * Format processor names for display
 * @param {string} processorId - Internal processor ID
 * @returns {string} Display-friendly processor name
 */
export const formatProcessorName = (processorId) => {
  const processorNames = {
    paxum: 'Paxum',
    epayservice: 'ePayService',
    ccbill: 'CCBill',
    segpay: 'SegPay',
    epoch: 'Epoch',
    vendo: 'Vendo',
    verotel: 'Verotel',
    netbilling: 'NetBilling',
    commercegate: 'CommerceGate',
    rocketgate: 'RocketGate',
    centrobill: 'CentroBill',
    payze: 'Payze',
    kolektiva: 'Kolektiva',
    paygarden: 'PayGarden',
    bitpay: 'BitPay',
    coinbase: 'Coinbase Commerce',
    nowpayments: 'NOWPayments',
    coingate: 'CoinGate',
    coinspaid: 'CoinsPaid',
    opennode: 'OpenNode',
    gocoin: 'GoCoin',
    uphold: 'Uphold Merchant'
  };

  return processorNames[processorId?.toLowerCase()] || processorId || 'Unknown';
};

/**
 * Format jurisdiction names for display
 * @param {string} jurisdictionCode - ISO country/jurisdiction code
 * @returns {string} Display-friendly jurisdiction name
 */
export const formatJurisdictionName = (jurisdictionCode) => {
  const jurisdictionNames = {
    US: 'United States',
    CA: 'Canada', 
    UK: 'United Kingdom',
    EU: 'European Union',
    AU: 'Australia',
    DE: 'Germany',
    FR: 'France',
    NL: 'Netherlands',
    BE: 'Belgium',
    IT: 'Italy',
    ES: 'Spain',
    SE: 'Sweden',
    DK: 'Denmark',
    NO: 'Norway',
    FI: 'Finland',
    JP: 'Japan',
    SG: 'Singapore',
    HK: 'Hong Kong',
    NZ: 'New Zealand'
  };

  return jurisdictionNames[jurisdictionCode?.toUpperCase()] || jurisdictionCode || 'Unknown';
};

/**
 * Format confidence scores for AI insights
 * @param {number} confidence - Confidence score (0-100 or 0-1)
 * @param {boolean} includeLabel - Whether to include "confidence" label
 * @returns {string} Formatted confidence string
 */
export const formatConfidence = (confidence, includeLabel = false) => {
  const score = confidence > 1 ? confidence : confidence * 100;
  const percentage = Math.round(score);
  
  let level = 'Low';
  if (percentage >= 80) level = 'High';
  else if (percentage >= 60) level = 'Medium';
  
  const baseString = `${percentage}%`;
  return includeLabel ? `${baseString} ${level} Confidence` : baseString;
};

/**
 * Format API response times for monitoring
 * @param {number} milliseconds - Response time in milliseconds
 * @returns {string} Formatted response time
 */
export const formatResponseTime = (milliseconds) => {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`;
  } else {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  }
};

/**
 * Format tax quarter labels
 * @param {number} quarter - Quarter number (1-4)
 * @param {number} year - Year
 * @returns {string} Formatted quarter label
 */
export const formatTaxQuarter = (quarter, year) => {
  return `Q${quarter} ${year}`;
};

/**
 * Format payment status for display
 * @param {string} status - Payment status code
 * @returns {object} Status display object with label and variant
 */
export const formatPaymentStatus = (status) => {
  const statusMap = {
    pending: { label: 'Pending', variant: 'warning', color: 'orange' },
    processing: { label: 'Processing', variant: 'warning', color: 'blue' },
    completed: { label: 'Completed', variant: 'success', color: 'green' },
    failed: { label: 'Failed', variant: 'destructive', color: 'red' },
    cancelled: { label: 'Cancelled', variant: 'outline', color: 'gray' },
    refunded: { label: 'Refunded', variant: 'outline', color: 'purple' },
    disputed: { label: 'Disputed', variant: 'destructive', color: 'red' },
    paid: { label: 'Paid', variant: 'success', color: 'green' },
    due: { label: 'Due', variant: 'destructive', color: 'red' },
    overdue: { label: 'Overdue', variant: 'destructive', color: 'red' },
    upcoming: { label: 'Upcoming', variant: 'outline', color: 'blue' }
  };

  return statusMap[status?.toLowerCase()] || { 
    label: status || 'Unknown', 
    variant: 'outline', 
    color: 'gray' 
  };
};

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Format insight priority for display
 * @param {string} priority - Priority level
 * @returns {object} Priority display object
 */
export const formatInsightPriority = (priority) => {
  const priorityMap = {
    high: { label: 'High Priority', variant: 'destructive', icon: 'AlertTriangle' },
    medium: { label: 'Medium Priority', variant: 'warning', icon: 'Clock' },
    low: { label: 'Low Priority', variant: 'outline', icon: 'Info' },
    urgent: { label: 'Urgent', variant: 'destructive', icon: 'Zap' }
  };

  return priorityMap[priority?.toLowerCase()] || {
    label: 'Standard',
    variant: 'outline',
    icon: 'Circle'
  };
};

/**
 * Format numbers with proper thousand separators
 * @param {number} num - Number to format
 * @param {string} locale - Locale for formatting
 * @returns {string} Formatted number
 */
export const formatNumber = (num, locale = 'en-US') => {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }

  return new Intl.NumberFormat(locale).format(num);
};

// Export all formatters as a single object for easier importing
export const formatters = {
  currency: formatCurrency,
  percentage: formatPercentage,
  compactNumber: formatCompactNumber,
  date: formatDate,
  relativeDate: formatRelativeDate,
  taxRate: formatTaxRate,
  fileSize: formatFileSize,
  duration: formatDuration,
  processorName: formatProcessorName,
  jurisdictionName: formatJurisdictionName,
  confidence: formatConfidence,
  responseTime: formatResponseTime,
  taxQuarter: formatTaxQuarter,
  paymentStatus: formatPaymentStatus,
  truncateText: truncateText,
  insightPriority: formatInsightPriority,
  number: formatNumber
};