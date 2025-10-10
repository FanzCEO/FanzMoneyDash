import logger from '../config/logger.js';

/**
 * FANZ Tax Validation Utilities
 * 
 * Provides validation and enrichment functions for tax-related data processing
 */

/**
 * Validate a normalized payout event structure
 * @param {Object} payoutEvent - Normalized payout event
 * @throws {Error} If validation fails
 */
export async function validatePayoutEvent(payoutEvent) {
  const requiredFields = [
    'id', 'creatorId', 'processorId', 'payoutId', 'amount', 
    'currency', 'payoutDate', 'taxYear', 'netAmount'
  ];

  // Check required fields
  for (const field of requiredFields) {
    if (payoutEvent[field] === undefined || payoutEvent[field] === null) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate data types and ranges
  if (typeof payoutEvent.amount !== 'number' || payoutEvent.amount < 0) {
    throw new Error('Amount must be a positive number');
  }

  if (typeof payoutEvent.netAmount !== 'number' || payoutEvent.netAmount < 0) {
    throw new Error('Net amount must be a positive number');
  }

  if (payoutEvent.netAmount > payoutEvent.amount) {
    throw new Error('Net amount cannot exceed gross amount');
  }

  // Validate currency code
  const validCurrencies = ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'BTC', 'ETH', 'USDT', 'USDC'];
  if (!validCurrencies.includes(payoutEvent.currency)) {
    throw new Error(`Invalid currency: ${payoutEvent.currency}`);
  }

  // Validate tax year
  const currentYear = new Date().getFullYear();
  if (payoutEvent.taxYear < 2020 || payoutEvent.taxYear > currentYear + 1) {
    throw new Error(`Invalid tax year: ${payoutEvent.taxYear}`);
  }

  // Validate payout date
  if (!(payoutEvent.payoutDate instanceof Date) || isNaN(payoutEvent.payoutDate.getTime())) {
    throw new Error('Invalid payout date');
  }

  // Additional business rules
  const payoutYear = payoutEvent.payoutDate.getFullYear();
  if (payoutYear !== payoutEvent.taxYear) {
    logger.warn(`Payout date year (${payoutYear}) differs from tax year (${payoutEvent.taxYear})`, {
      payoutId: payoutEvent.id
    });
  }

  logger.debug('Payout event validation passed', { payoutId: payoutEvent.id });
}

/**
 * Enrich payout data with foreign exchange rates for accurate tax calculations
 * @param {Object} payoutEvent - Normalized payout event (modified in place)
 */
export async function enrichWithFxData(payoutEvent) {
  try {
    // Skip if already in USD or if FX rate already provided
    if (payoutEvent.currency === 'USD' && !payoutEvent.fxRate) {
      return;
    }

    // Get FX rate for the payout date
    const fxRate = await getFxRate(payoutEvent.currency, 'USD', payoutEvent.payoutDate);
    
    if (fxRate) {
      payoutEvent.fxRate = fxRate;
      
      // Calculate fair market value in USD if not already provided
      if (!payoutEvent.fmvUsd) {
        payoutEvent.fmvUsd = Math.round((payoutEvent.amount * fxRate) * 100) / 100;
      }

      logger.debug('Enriched payout with FX data', {
        payoutId: payoutEvent.id,
        currency: payoutEvent.currency,
        fxRate,
        fmvUsd: payoutEvent.fmvUsd
      });
    }

  } catch (error) {
    logger.warn('Failed to enrich FX data - proceeding without', {
      payoutId: payoutEvent.id,
      currency: payoutEvent.currency,
      error: error.message
    });
    
    // For crypto, use a conservative fallback if no rate available
    if (isCryptoCurrency(payoutEvent.currency)) {
      payoutEvent.fmvUsd = payoutEvent.amount; // Assume 1:1 as fallback
      logger.warn(`Using 1:1 fallback rate for ${payoutEvent.currency}`, {
        payoutId: payoutEvent.id
      });
    }
  }
}

/**
 * Get foreign exchange rate from external service
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {Date} date - Historical date for rate
 * @returns {Promise<number|null>} Exchange rate or null if unavailable
 */
async function getFxRate(fromCurrency, toCurrency, date) {
  try {
    // For crypto currencies, use specialized API
    if (isCryptoCurrency(fromCurrency)) {
      return await getCryptoFxRate(fromCurrency, toCurrency, date);
    }

    // For fiat currencies, use standard FX API
    return await getFiatFxRate(fromCurrency, toCurrency, date);

  } catch (error) {
    logger.error('FX rate lookup failed:', error);
    return null;
  }
}

/**
 * Get cryptocurrency exchange rates (historical)
 * @param {string} cryptoCurrency - Crypto currency code
 * @param {string} fiatCurrency - Fiat currency code
 * @param {Date} date - Historical date
 * @returns {Promise<number|null>} Exchange rate
 */
async function getCryptoFxRate(cryptoCurrency, fiatCurrency, date) {
  // This would integrate with a crypto pricing API like CoinGecko, CoinMarketCap, etc.
  // For now, returning mock data
  
  const cryptoRates = {
    'BTC': { 'USD': 45000 },  // Mock BTC rate
    'ETH': { 'USD': 3000 },   // Mock ETH rate
    'USDT': { 'USD': 1.0 },   // Stablecoins
    'USDC': { 'USD': 1.0 }
  };

  const rate = cryptoRates[cryptoCurrency]?.[fiatCurrency];
  
  if (rate) {
    logger.debug(`Got crypto FX rate: 1 ${cryptoCurrency} = ${rate} ${fiatCurrency}`);
    return rate;
  }

  return null;
}

/**
 * Get fiat currency exchange rates (historical)
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency  
 * @param {Date} date - Historical date
 * @returns {Promise<number|null>} Exchange rate
 */
async function getFiatFxRate(fromCurrency, toCurrency, date) {
  // This would integrate with a forex API like Fixer.io, Open Exchange Rates, etc.
  // For now, returning mock data
  
  const fiatRates = {
    'CAD': { 'USD': 0.74 },
    'GBP': { 'USD': 1.27 },
    'EUR': { 'USD': 1.09 },
    'AUD': { 'USD': 0.67 }
  };

  const rate = fiatRates[fromCurrency]?.[toCurrency];
  
  if (rate) {
    logger.debug(`Got fiat FX rate: 1 ${fromCurrency} = ${rate} ${toCurrency}`);
    return rate;
  }

  return null;
}

/**
 * Check if a currency is a cryptocurrency
 * @param {string} currency - Currency code
 * @returns {boolean} True if crypto currency
 */
function isCryptoCurrency(currency) {
  const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'LTC', 'BCH', 'XRP', 'ADA', 'DOT', 'UNI'];
  return cryptoCurrencies.includes(currency);
}

/**
 * Validate Tax Identification Number (TIN) format for different jurisdictions
 * @param {string} tin - Tax identification number
 * @param {string} jurisdiction - Tax jurisdiction (US, CA, UK, EU, AU)
 * @returns {Object} Validation result with isValid and normalizedTin
 */
export function validateTIN(tin, jurisdiction) {
  if (!tin || typeof tin !== 'string') {
    return { isValid: false, error: 'TIN is required' };
  }

  const cleanTin = tin.replace(/[^0-9A-Z]/g, ''); // Remove non-alphanumeric

  switch (jurisdiction) {
    case 'US':
      return validateUSTIN(cleanTin);
    
    case 'CA':
      return validateCATIN(cleanTin);
    
    case 'UK':
      return validateUKTIN(cleanTin);
    
    case 'AU':
      return validateAUTIN(cleanTin);
    
    case 'EU':
      // EU varies by country - basic validation
      return {
        isValid: cleanTin.length >= 8 && cleanTin.length <= 15,
        normalizedTin: cleanTin,
        error: cleanTin.length < 8 || cleanTin.length > 15 ? 'Invalid EU TIN format' : null
      };
    
    default:
      return { isValid: false, error: `Unsupported jurisdiction: ${jurisdiction}` };
  }
}

/**
 * Validate US TIN (SSN or EIN)
 * @param {string} tin - Cleaned TIN
 * @returns {Object} Validation result
 */
function validateUSTIN(tin) {
  // SSN format: 9 digits
  if (tin.length === 9 && /^\d{9}$/.test(tin)) {
    // Check for invalid SSN patterns
    if (tin.startsWith('000') || tin.startsWith('666') || tin.startsWith('9')) {
      return { isValid: false, error: 'Invalid SSN format' };
    }
    
    return {
      isValid: true,
      normalizedTin: tin,
      tinType: 'SSN'
    };
  }
  
  // EIN format: 9 digits starting with valid prefix
  if (tin.length === 9 && /^\d{9}$/.test(tin)) {
    const prefix = tin.substring(0, 2);
    const validPrefixes = ['01', '02', '03', '04', '05', '06', '10', '11', '12', '13', '14', '15', '16', '20', '21', '22', '23', '24', '25', '26', '27', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '45', '46', '47', '48', '51', '52', '53', '54', '55', '56', '57', '58', '59', '65', '66', '67', '68', '71', '72', '73', '74', '75', '76', '77', '81', '82', '83', '84', '85', '86', '87', '88', '91', '92', '93', '94', '95', '98'];
    
    if (validPrefixes.includes(prefix)) {
      return {
        isValid: true,
        normalizedTin: tin,
        tinType: 'EIN'
      };
    }
  }
  
  return { isValid: false, error: 'Invalid US TIN format (must be valid SSN or EIN)' };
}

/**
 * Validate Canadian TIN (SIN or BN)
 * @param {string} tin - Cleaned TIN
 * @returns {Object} Validation result
 */
function validateCATIN(tin) {
  // SIN format: 9 digits with check digit validation
  if (tin.length === 9 && /^\d{9}$/.test(tin)) {
    // Luhn algorithm check for SIN
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let digit = parseInt(tin[i]);
      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit = Math.floor(digit / 10) + (digit % 10);
      }
      sum += digit;
    }
    
    if (sum % 10 === 0) {
      return {
        isValid: true,
        normalizedTin: tin,
        tinType: 'SIN'
      };
    }
  }
  
  // BN format: 9 digits + 4 character suffix (e.g., RT0001)
  if (tin.length === 15 && /^\d{9}[A-Z]{2}\d{4}$/.test(tin)) {
    return {
      isValid: true,
      normalizedTin: tin,
      tinType: 'BN'
    };
  }
  
  return { isValid: false, error: 'Invalid Canadian TIN format (must be valid SIN or BN)' };
}

/**
 * Validate UK TIN (UTR)
 * @param {string} tin - Cleaned TIN
 * @returns {Object} Validation result
 */
function validateUKTIN(tin) {
  // UTR format: 10 digits
  if (tin.length === 10 && /^\d{10}$/.test(tin)) {
    return {
      isValid: true,
      normalizedTin: tin,
      tinType: 'UTR'
    };
  }
  
  return { isValid: false, error: 'Invalid UK UTR format (must be 10 digits)' };
}

/**
 * Validate Australian TIN (ABN or TFN)
 * @param {string} tin - Cleaned TIN
 * @returns {Object} Validation result
 */
function validateAUTIN(tin) {
  // TFN format: 8 or 9 digits
  if ((tin.length === 8 || tin.length === 9) && /^\d+$/.test(tin)) {
    return {
      isValid: true,
      normalizedTin: tin,
      tinType: 'TFN'
    };
  }
  
  // ABN format: 11 digits with check digit validation
  if (tin.length === 11 && /^\d{11}$/.test(tin)) {
    // ABN check digit validation
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let sum = 0;
    
    // Subtract 1 from first digit
    const firstDigit = parseInt(tin[0]) - 1;
    sum += firstDigit * weights[0];
    
    // Sum remaining digits
    for (let i = 1; i < 11; i++) {
      sum += parseInt(tin[i]) * weights[i];
    }
    
    if (sum % 89 === 0) {
      return {
        isValid: true,
        normalizedTin: tin,
        tinType: 'ABN'
      };
    }
  }
  
  return { isValid: false, error: 'Invalid Australian TIN format (must be valid TFN or ABN)' };
}

/**
 * Validate email address for tax communications
 * @param {string} email - Email address
 * @returns {boolean} True if valid email format
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize and validate currency amount
 * @param {any} amount - Amount value
 * @returns {number|null} Sanitized amount or null if invalid
 */
export function sanitizeAmount(amount) {
  if (typeof amount === 'number' && !isNaN(amount) && amount >= 0) {
    return Math.round(amount * 100) / 100; // Round to 2 decimal places
  }
  
  if (typeof amount === 'string') {
    // Remove currency symbols and parse
    const cleanAmount = amount.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleanAmount);
    
    if (!isNaN(parsed) && parsed >= 0) {
      return Math.round(parsed * 100) / 100;
    }
  }
  
  return null;
}

/**
 * Validate tax year
 * @param {any} year - Tax year value
 * @returns {number|null} Valid tax year or null
 */
export function validateTaxYear(year) {
  const currentYear = new Date().getFullYear();
  const numYear = parseInt(year);
  
  if (!isNaN(numYear) && numYear >= 2020 && numYear <= currentYear + 1) {
    return numYear;
  }
  
  return null;
}

/**
 * Check if a date falls within a specific tax year
 * @param {Date} date - Date to check
 * @param {number} taxYear - Tax year
 * @returns {boolean} True if date is in tax year
 */
export function isDateInTaxYear(date, taxYear) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return false;
  }
  
  return date.getFullYear() === taxYear;
}

export default {
  validatePayoutEvent,
  enrichWithFxData,
  validateTIN,
  validateEmail,
  sanitizeAmount,
  validateTaxYear,
  isDateInTaxYear
};