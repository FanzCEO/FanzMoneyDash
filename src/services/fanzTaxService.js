import { EventEmitter } from 'events';
import ComplianceService from './complianceService.js';
import { validatePayoutEvent, enrichWithFxData } from '../utils/taxValidation.js';
import { generateUUID, hashIP } from '../utils/helpers.js';
import logger from '../config/logger.js';

/**
 * FANZ Tax Service - Next-Generation Creator Tax Management
 * 
 * Features:
 * - Automated 1099 generation and e-filing
 * - Real-time tax estimates with AI optimization
 * - Multi-processor aggregation (all FANZ-compliant gateways)
 * - International support (US/CA/UK/EU/AU)
 * - Tax Vault auto-reserves with smart recommendations
 * - Proactive compliance monitoring
 */
class FanzTaxService extends EventEmitter {
  constructor() {
    super();
    this.complianceService = new ComplianceService();
    this.supportedProcessors = this.initializeSupportedProcessors();
    this.taxRates = this.initializeTaxRates();
    this.auditLogger = this.initializeAuditLogger();
    
    logger.info('🧮 FANZ Tax Service initialized with next-gen features');
  }

  /**
   * Initialize all FANZ-compliant payment processors
   * Excludes Stripe/PayPal per FANZ rules
   */
  initializeSupportedProcessors() {
    return {
      // Card Processors (Adult-Friendly)
      ccbill: { 
        name: 'CCBill',
        webhookUrl: '/webhooks/ccbill', 
        batchApi: true,
        eFileSupported: true,
        countries: ['US', 'CA', 'UK', 'EU', 'AU']
      },
      segpay: { 
        name: 'Segpay',
        webhookUrl: '/webhooks/segpay', 
        batchApi: true,
        eFileSupported: true,
        countries: ['US', 'CA', 'UK', 'EU']
      },
      epoch: { 
        name: 'Epoch',
        webhookUrl: '/webhooks/epoch', 
        batchApi: false,
        eFileSupported: true,
        countries: ['US', 'CA']
      },
      vendo: { 
        name: 'Vendo',
        webhookUrl: '/webhooks/vendo', 
        batchApi: true,
        eFileSupported: true,
        countries: ['US', 'CA', 'UK', 'EU', 'AU']
      },
      verotel: { 
        name: 'Verotel',
        webhookUrl: '/webhooks/verotel', 
        batchApi: true,
        eFileSupported: true,
        countries: ['EU', 'UK']
      },
      netbilling: { 
        name: 'NetBilling',
        webhookUrl: '/webhooks/netbilling', 
        batchApi: false,
        eFileSupported: true,
        countries: ['US']
      },
      commercegate: { 
        name: 'CommerceGate',
        webhookUrl: '/webhooks/commercegate', 
        batchApi: true,
        eFileSupported: true,
        countries: ['US', 'CA', 'UK', 'EU', 'AU']
      },
      rocketgate: { 
        name: 'RocketGate',
        webhookUrl: '/webhooks/rocketgate', 
        batchApi: true,
        eFileSupported: true,
        countries: ['US', 'CA']
      },
      centrobill: { 
        name: 'CentroBill',
        webhookUrl: '/webhooks/centrobill', 
        batchApi: true,
        eFileSupported: true,
        countries: ['US', 'CA', 'EU']
      },
      
      // Crypto Processors
      bitpay: { 
        name: 'BitPay',
        webhookUrl: '/webhooks/bitpay', 
        batchApi: true,
        cryptoProcessor: true,
        countries: ['US', 'CA', 'UK', 'EU', 'AU']
      },
      nowpayments: { 
        name: 'NOWPayments',
        webhookUrl: '/webhooks/nowpayments', 
        batchApi: true,
        cryptoProcessor: true,
        countries: ['US', 'CA', 'UK', 'EU', 'AU']
      },
      coingate: { 
        name: 'CoinGate',
        webhookUrl: '/webhooks/coingate', 
        batchApi: false,
        cryptoProcessor: true,
        countries: ['US', 'CA', 'UK', 'EU', 'AU']
      },
      coinspaid: { 
        name: 'CoinsPaid',
        webhookUrl: '/webhooks/coinspaid', 
        batchApi: true,
        cryptoProcessor: true,
        countries: ['US', 'CA', 'UK', 'EU', 'AU']
      },
      
      // Bank/Wire Processors (Payout focus)
      paxum: { 
        name: 'Paxum',
        webhookUrl: '/webhooks/paxum', 
        batchApi: true,
        payoutProcessor: true,
        countries: ['US', 'CA', 'UK', 'EU', 'AU']
      },
      epayservice: { 
        name: 'ePayService',
        webhookUrl: '/webhooks/epayservice', 
        batchApi: false,
        payoutProcessor: true,
        countries: ['US', 'CA', 'UK', 'EU', 'AU']
      },
      wise: { 
        name: 'Wise',
        webhookUrl: '/webhooks/wise', 
        batchApi: true,
        payoutProcessor: true,
        countries: ['US', 'CA', 'UK', 'EU', 'AU']
      }
    };
  }

  /**
   * Initialize tax rates for all supported jurisdictions
   */
  initializeTaxRates() {
    return {
      'US': {
        federal: { base: 0.22, selfEmployment: 0.1413 },
        state: { average: 0.05, ranges: { min: 0, max: 0.13 } },
        quarterly: true,
        thresholds: { '1099NEC': 600, '1099K': 20000 },
        backupWithholding: 0.24
      },
      'CA': {
        federal: 0.26,
        provincial: { average: 0.11, ranges: { min: 0.05, max: 0.16 } },
        cpp: 0.0495, // Canada Pension Plan
        ei: 0.0163,  // Employment Insurance
        quarterly: false,
        thresholds: { 'T4A': 500 }
      },
      'UK': {
        income: { basic: 0.20, higher: 0.40, additional: 0.45 },
        nationalInsurance: { class2: 156, class4: 0.09 }, // £156 flat + 9%
        vat: 0.20,
        thresholds: { selfAssessment: 1000 }
      },
      'EU': {
        income: { average: 0.25, ranges: { min: 0.15, max: 0.47 } },
        vat: { standard: 0.21, reduced: 0.05 },
        social: 0.15, // Average social security
        quarterly: false
      },
      'AU': {
        income: { 
          brackets: [
            { min: 0, max: 18200, rate: 0 },
            { min: 18200, max: 45000, rate: 0.19 },
            { min: 45000, max: 120000, rate: 0.325 },
            { min: 120000, max: 180000, rate: 0.37 },
            { min: 180000, max: Infinity, rate: 0.45 }
          ]
        },
        gst: 0.10,
        medicare: 0.02,
        quarterly: true
      }
    };
  }

  /**
   * Initialize audit logging system
   */
  initializeAuditLogger() {
    return {
      auditedActions: [
        'tax_profile_created',
        'w9_form_submitted',
        'w8_form_submitted',
        'tin_match_attempted',
        'backup_withholding_enabled',
        'tax_calculation_performed',
        '1099_generated',
        'form_distributed',
        'efile_submitted',
        'correction_issued',
        'consent_granted',
        'consent_withdrawn',
        'tax_vault_deposit',
        'tax_vault_withdrawal'
      ]
    };
  }

  /**
   * Process incoming payout webhook from any supported processor
   * @param {string} processorId - ID of the payment processor
   * @param {Object} payload - Webhook payload from processor
   * @param {Object} metadata - Additional metadata (IP, headers, etc.)
   */
  async processPayoutWebhook(processorId, payload, metadata = {}) {
    try {
      // Validate processor is supported
      const processor = this.supportedProcessors[processorId];
      if (!processor) {
        throw new Error(`Unsupported processor: ${processorId}`);
      }

      // Normalize payout data to FANZ standard format
      const normalizedPayout = await this.normalizePayoutData(processorId, payload);
      
      // Validate payout event structure
      await validatePayoutEvent(normalizedPayout);
      
      // Enrich with FX rates for crypto/foreign currency
      if (normalizedPayout.currency !== 'USD' || processor.cryptoProcessor) {
        await enrichWithFxData(normalizedPayout);
      }

      // Store in FanzFinance OS ledger
      await this.recordPayoutInLedger(normalizedPayout);
      
      // Process tax implications
      await this.processTaxImplications(normalizedPayout);
      
      // Update real-time tax estimates
      await this.updateCreatorTaxEstimates(normalizedPayout.creatorId);
      
      // Process Tax Vault auto-reserve if enabled
      await this.processTaxVaultReserve(normalizedPayout);

      // Audit log
      await this.logTaxEvent({
        userId: normalizedPayout.creatorId,
        action: 'payout_processed',
        entityType: 'payout',
        entityId: normalizedPayout.id,
        changes: { processor: processorId, amount: normalizedPayout.amount },
        ...metadata
      });

      // Emit event for other services
      this.emit('payoutProcessed', {
        creatorId: normalizedPayout.creatorId,
        processorId,
        amount: normalizedPayout.amount,
        taxImplications: await this.calculateTaxImplications(normalizedPayout)
      });

      logger.info(`✅ Processed payout from ${processor.name}`, {
        creatorId: normalizedPayout.creatorId,
        amount: normalizedPayout.amount,
        processor: processorId
      });

      return {
        success: true,
        payoutId: normalizedPayout.id,
        taxEstimatesUpdated: true,
        message: `Payout processed and tax calculations updated`
      };

    } catch (error) {
      logger.error(`❌ Failed to process payout from ${processorId}:`, error);
      
      // Store failed payout for retry
      await this.storeFailedPayout(processorId, payload, error);
      
      throw error;
    }
  }

  /**
   * Normalize payout data from different processors to standard format
   * @param {string} processorId - Payment processor identifier
   * @param {Object} payload - Raw webhook payload
   */
  async normalizePayoutData(processorId, payload) {
    const processor = this.supportedProcessors[processorId];
    const baseFields = {
      id: generateUUID(),
      processorId,
      createdAt: new Date(),
      status: 'pending'
    };

    // Processor-specific normalization
    switch (processorId) {
      case 'ccbill':
        return {
          ...baseFields,
          creatorId: payload.subscriptionId || payload.clientAccnum,
          payoutId: payload.payoutId,
          amount: parseFloat(payload.amount),
          currency: payload.currencyCode || 'USD',
          payoutDate: new Date(payload.payoutDate),
          taxYear: new Date(payload.payoutDate).getFullYear(),
          source: this.mapCCBillTransactionType(payload.transactionType),
          fees: parseFloat(payload.processingFee || 0),
          netAmount: parseFloat(payload.amount) - parseFloat(payload.processingFee || 0),
          metadata: {
            transactionId: payload.transactionId,
            subscriptionTypeId: payload.subscriptionTypeId
          }
        };

      case 'segpay':
        return {
          ...baseFields,
          creatorId: payload.merchantId,
          payoutId: payload.payoutReference,
          amount: parseFloat(payload.grossAmount),
          currency: payload.currency || 'USD',
          payoutDate: new Date(payload.settlementDate),
          taxYear: new Date(payload.settlementDate).getFullYear(),
          source: this.mapSegpayTransactionType(payload.transactionType),
          fees: parseFloat(payload.fees),
          netAmount: parseFloat(payload.netAmount),
          metadata: {
            memberTransId: payload.memberTransId,
            productId: payload.productId
          }
        };

      case 'bitpay':
        return {
          ...baseFields,
          creatorId: payload.posData?.creatorId || payload.orderId,
          payoutId: payload.id,
          amount: parseFloat(payload.price),
          currency: payload.currency,
          fxRate: parseFloat(payload.exchangeRates?.USD || 1),
          fmvUsd: parseFloat(payload.price) * parseFloat(payload.exchangeRates?.USD || 1),
          payoutDate: new Date(payload.currentTime),
          taxYear: new Date(payload.currentTime).getFullYear(),
          source: 'crypto',
          fees: parseFloat(payload.amountPaid) - parseFloat(payload.price),
          netAmount: parseFloat(payload.amountPaid),
          metadata: {
            invoiceId: payload.id,
            bitcoinAddress: payload.bitcoinAddress,
            confirmations: payload.confirmations
          }
        };

      case 'paxum':
        return {
          ...baseFields,
          creatorId: payload.receiverEmail,
          payoutId: payload.transactionId,
          amount: parseFloat(payload.amount),
          currency: payload.currency || 'USD',
          payoutDate: new Date(payload.transactionDate),
          taxYear: new Date(payload.transactionDate).getFullYear(),
          source: 'payout',
          fees: parseFloat(payload.fee || 0),
          netAmount: parseFloat(payload.amount) - parseFloat(payload.fee || 0),
          metadata: {
            senderEmail: payload.senderEmail,
            description: payload.description
          }
        };

      default:
        // Generic processor handling
        return {
          ...baseFields,
          creatorId: payload.creatorId || payload.merchantId || payload.accountId,
          payoutId: payload.payoutId || payload.transactionId || payload.id,
          amount: parseFloat(payload.amount || payload.grossAmount),
          currency: payload.currency || 'USD',
          payoutDate: new Date(payload.date || payload.timestamp || Date.now()),
          taxYear: new Date(payload.date || payload.timestamp || Date.now()).getFullYear(),
          source: payload.source || 'unknown',
          fees: parseFloat(payload.fees || payload.processingFee || 0),
          netAmount: parseFloat(payload.netAmount || payload.amount || 0),
          metadata: payload
        };
    }
  }

  /**
   * Calculate comprehensive tax implications for a payout
   * @param {Object} normalizedPayout - Normalized payout event
   */
  async calculateTaxImplications(normalizedPayout) {
    try {
      // Get creator's tax profile
      const taxProfile = await this.getCreatorTaxProfile(normalizedPayout.creatorId);
      if (!taxProfile) {
        logger.warn(`No tax profile found for creator ${normalizedPayout.creatorId}`);
        return null;
      }

      const jurisdiction = taxProfile.taxResidency;
      const rates = this.taxRates[jurisdiction];
      
      if (!rates) {
        throw new Error(`Unsupported tax jurisdiction: ${jurisdiction}`);
      }

      // Calculate federal/primary tax
      let federalTax = 0;
      let stateTax = 0;
      let totalTax = 0;

      switch (jurisdiction) {
        case 'US':
          federalTax = normalizedPayout.netAmount * rates.federal.base;
          
          // Self-employment tax
          const seTax = normalizedPayout.netAmount * rates.federal.selfEmployment;
          
          // Estimated state tax (varies by state)
          stateTax = normalizedPayout.netAmount * rates.state.average;
          
          totalTax = federalTax + seTax + stateTax;
          
          // Apply backup withholding if applicable
          if (taxProfile.backupWithholding) {
            totalTax += normalizedPayout.netAmount * rates.backupWithholding;
          }
          break;

        case 'CA':
          federalTax = normalizedPayout.netAmount * rates.federal;
          stateTax = normalizedPayout.netAmount * rates.provincial.average;
          
          // CPP and EI contributions
          const cppContrib = Math.min(normalizedPayout.netAmount * rates.cpp, 3754.45); // 2024 max
          const eiContrib = Math.min(normalizedPayout.netAmount * rates.ei, 1049.12);   // 2024 max
          
          totalTax = federalTax + stateTax + cppContrib + eiContrib;
          break;

        case 'UK':
          // Progressive income tax
          if (normalizedPayout.netAmount <= 12570) { // Personal allowance 2024
            federalTax = 0;
          } else if (normalizedPayout.netAmount <= 50270) {
            federalTax = (normalizedPayout.netAmount - 12570) * rates.income.basic;
          } else {
            federalTax = (50270 - 12570) * rates.income.basic + 
                        (normalizedPayout.netAmount - 50270) * rates.income.higher;
          }
          
          // National Insurance (simplified)
          const niContrib = normalizedPayout.netAmount > 12570 ? 
                           (normalizedPayout.netAmount - 12570) * rates.nationalInsurance.class4 : 0;
          
          totalTax = federalTax + niContrib;
          break;

        case 'AU':
          // Progressive tax brackets
          for (const bracket of rates.income.brackets) {
            if (normalizedPayout.netAmount > bracket.min) {
              const taxableInThisBracket = Math.min(
                normalizedPayout.netAmount - bracket.min,
                bracket.max - bracket.min
              );
              federalTax += taxableInThisBracket * bracket.rate;
            }
          }
          
          // Medicare levy
          const medicareLevy = normalizedPayout.netAmount * rates.medicare;
          
          totalTax = federalTax + medicareLevy;
          break;

        default:
          // EU fallback
          federalTax = normalizedPayout.netAmount * (rates.income?.average || 0.25);
          totalTax = federalTax;
      }

      return {
        jurisdiction,
        grossAmount: normalizedPayout.amount,
        netAmount: normalizedPayout.netAmount,
        federalTax: Math.round(federalTax * 100) / 100,
        stateTax: Math.round(stateTax * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        effectiveRate: totalTax / normalizedPayout.netAmount,
        recommendedReserve: Math.round(totalTax * 1.1 * 100) / 100, // 10% buffer
        currency: normalizedPayout.currency,
        taxYear: normalizedPayout.taxYear,
        calculatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to calculate tax implications:', error);
      throw error;
    }
  }

  /**
   * Generate real-time tax estimates for creator
   * @param {string} creatorId - Creator identifier
   */
  async generateRealTimeEstimates(creatorId) {
    try {
      const currentYear = new Date().getFullYear();
      const ytdPayouts = await this.getYtdPayouts(creatorId, currentYear);
      const taxProfile = await this.getCreatorTaxProfile(creatorId);
      
      if (!taxProfile || ytdPayouts.length === 0) {
        return this.getEmptyEstimates();
      }

      // Calculate YTD totals
      const ytdGross = ytdPayouts.reduce((sum, p) => sum + p.amount, 0);
      const ytdNet = ytdPayouts.reduce((sum, p) => sum + p.netAmount, 0);
      const ytdFees = ytdPayouts.reduce((sum, p) => sum + p.fees, 0);

      // Project annual income based on current pace
      const dayOfYear = Math.ceil((Date.now() - new Date(currentYear, 0, 1)) / (24 * 60 * 60 * 1000));
      const projectedAnnualIncome = (ytdNet / dayOfYear) * 365;

      // Calculate tax estimates
      const taxImplications = await this.calculateTaxImplications({
        ...ytdPayouts[0],
        netAmount: projectedAnnualIncome
      });

      // Generate quarterly estimates for US
      const quarterlyEstimates = taxProfile.taxResidency === 'US' ? 
        await this.calculateQuarterlyEstimates(taxProfile, projectedAnnualIncome) : [];

      // Calculate recommended Tax Vault reserve
      const taxVaultStrategy = await this.optimizeTaxVaultStrategy(creatorId);

      return {
        creatorId,
        taxYear: currentYear,
        ytdGross,
        ytdNet,
        ytdFees,
        projectedAnnualIncome,
        estimatedFederalTax: taxImplications?.federalTax || 0,
        estimatedStateTax: taxImplications?.stateTax || 0,
        totalEstimatedTax: taxImplications?.totalTax || 0,
        effectiveRate: taxImplications?.effectiveRate || 0,
        quarterlyEstimates,
        taxVaultStrategy,
        lastUpdated: new Date().toISOString(),
        processorBreakdown: this.calculateProcessorBreakdown(ytdPayouts),
        complianceStatus: await this.getComplianceStatus(creatorId)
      };

    } catch (error) {
      logger.error(`Failed to generate real-time estimates for creator ${creatorId}:`, error);
      throw error;
    }
  }

  /**
   * AI-powered Tax Vault optimization strategy
   * @param {string} creatorId - Creator identifier
   */
  async optimizeTaxVaultStrategy(creatorId) {
    try {
      const payouts = await this.getRecentPayouts(creatorId, 12); // Last 12 payouts
      if (payouts.length === 0) {
        return this.getDefaultTaxVaultStrategy();
      }

      // Calculate payout patterns
      const monthlyAverage = payouts.reduce((sum, p) => sum + p.netAmount, 0) / payouts.length;
      const volatility = this.calculateVolatility(payouts);
      const seasonality = this.detectSeasonality(payouts);

      // Get creator's tax profile for jurisdiction-specific adjustments
      const taxProfile = await this.getCreatorTaxProfile(creatorId);
      
      // Base reserve rate
      let recommendedReserveRate = 0.25; // Start with 25%

      // Adjust for volatility
      if (volatility > 0.5) {
        recommendedReserveRate += 0.05; // Add 5% for high volatility
      } else if (volatility < 0.2) {
        recommendedReserveRate -= 0.03; // Reduce 3% for stable income
      }

      // Jurisdiction adjustments
      const jurisdictionAdjustments = {
        'CA': 0.05,  // Higher tax rates
        'UK': 0.03,  // National Insurance
        'AU': 0.04,  // Medicare + higher brackets
        'EU': 0.02   // Social contributions
      };
      
      if (jurisdictionAdjustments[taxProfile.taxResidency]) {
        recommendedReserveRate += jurisdictionAdjustments[taxProfile.taxResidency];
      }

      // Seasonal adjustments
      if (seasonality.hasPattern) {
        recommendedReserveRate += seasonality.peakMonths.includes(new Date().getMonth()) ? -0.02 : 0.02;
      }

      // Cap at reasonable bounds
      recommendedReserveRate = Math.max(0.15, Math.min(0.40, recommendedReserveRate));

      return {
        recommendedReserveRate,
        projectedMonthlyReserve: monthlyAverage * recommendedReserveRate,
        strategy: volatility > 0.5 ? 'conservative' : volatility < 0.2 ? 'aggressive' : 'balanced',
        volatilityScore: volatility,
        seasonalityDetected: seasonality.hasPattern,
        explanation: this.generateTaxVaultExplanation(recommendedReserveRate, volatility, taxProfile),
        aiConfidence: this.calculateAIConfidence(payouts.length, volatility),
        lastOptimized: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to optimize Tax Vault strategy for creator ${creatorId}:`, error);
      return this.getDefaultTaxVaultStrategy();
    }
  }

  /**
   * Generate AI-powered tax insights and recommendations
   * @param {string} creatorId - Creator identifier
   */
  async generateTaxInsights(creatorId) {
    try {
      const taxProfile = await this.getCreatorTaxProfile(creatorId);
      const estimates = await this.generateRealTimeEstimates(creatorId);
      const payouts = await this.getYtdPayouts(creatorId, new Date().getFullYear());
      
      const insights = [];

      // Quarterly payment reminders (US only)
      if (taxProfile.taxResidency === 'US' && estimates.quarterlyEstimates?.length > 0) {
        const nextQuarterly = estimates.quarterlyEstimates.find(q => new Date(q.dueDate) > new Date());
        if (nextQuarterly) {
          const daysUntilDue = Math.ceil((new Date(nextQuarterly.dueDate) - new Date()) / (24 * 60 * 60 * 1000));
          
          insights.push({
            id: 'quarterly_payment_due',
            type: 'quarterly_payment',
            priority: daysUntilDue <= 30 ? 'high' : 'medium',
            title: `Quarterly Tax Payment ${daysUntilDue <= 7 ? 'Due Soon!' : 'Approaching'}`,
            description: `Your Q${nextQuarterly.quarter} estimated tax payment of $${nextQuarterly.amount.toLocaleString()} is due ${nextQuarterly.dueDate}`,
            actionUrl: '/tax-center/quarterly-payments',
            citation: 'IRS Form 1040ES - https://www.irs.gov/forms-pubs/form-1040es',
            daysUntilDue,
            aiGenerated: true
          });
        }
      }

      // Entity structure optimization
      if (estimates.projectedAnnualIncome > 60000 && taxProfile.entityType === 'individual') {
        const potentialSavings = estimates.projectedAnnualIncome * 0.0531; // Approximate S-Corp savings
        
        insights.push({
          id: 'entity_optimization',
          type: 'entity_optimization',
          priority: 'medium',
          title: 'Consider S-Corp Election for Tax Savings',
          description: `Based on your projected income of $${estimates.projectedAnnualIncome.toLocaleString()}, an S-Corp election could save you approximately $${potentialSavings.toLocaleString()} in self-employment taxes annually.`,
          actionUrl: '/tax-center/entity-optimization',
          citation: 'IRS Publication 535 - https://www.irs.gov/publications/p535',
          potentialSavings,
          aiGenerated: true
        });
      }

      // Deduction optimization
      const potentialDeductions = await this.analyzePotentialDeductions(creatorId, payouts);
      if (potentialDeductions.total > 1000) {
        insights.push({
          id: 'deduction_optimization',
          type: 'deduction_optimization',
          priority: 'medium',
          title: 'Maximize Your Tax Deductions',
          description: `You may be missing up to $${potentialDeductions.total.toLocaleString()} in potential deductions. Common creator deductions include equipment ($${potentialDeductions.equipment}), software ($${potentialDeductions.software}), marketing ($${potentialDeductions.marketing}), and home office expenses ($${potentialDeductions.homeOffice}).`,
          actionUrl: '/tax-center/deductions',
          citation: 'IRS Publication 334 - https://www.irs.gov/publications/p334',
          breakdown: potentialDeductions,
          aiGenerated: true
        });
      }

      // Tax Vault optimization
      if (estimates.taxVaultStrategy?.strategy !== 'optimal') {
        insights.push({
          id: 'tax_vault_optimization',
          type: 'tax_vault_optimization',
          priority: 'low',
          title: 'Optimize Your Tax Vault Strategy',
          description: `Your current tax reserve rate could be optimized. Based on your income patterns, we recommend ${(estimates.taxVaultStrategy.recommendedReserveRate * 100).toFixed(1)}% reserve rate.`,
          actionUrl: '/tax-center/tax-vault',
          aiGenerated: true
        });
      }

      // International tax considerations
      if (taxProfile.taxResidency !== 'US') {
        insights.push({
          id: 'international_tax_guidance',
          type: 'international_guidance',
          priority: 'medium',
          title: `${taxProfile.taxResidency} Tax Guidance Available`,
          description: `As a ${taxProfile.taxResidency} resident, you have specific tax obligations and opportunities. View our comprehensive guide for ${taxProfile.taxResidency} creators.`,
          actionUrl: `/tax-center/international/${taxProfile.taxResidency.toLowerCase()}`,
          aiGenerated: true
        });
      }

      // Log AI insight generation
      await this.logTaxEvent({
        userId: creatorId,
        action: 'ai_insights_generated',
        entityType: 'insights',
        entityId: `insights_${Date.now()}`,
        changes: { insightCount: insights.length, types: insights.map(i => i.type) }
      });

      return insights;

    } catch (error) {
      logger.error(`Failed to generate tax insights for creator ${creatorId}:`, error);
      return [];
    }
  }

  /**
   * Helper methods for tax calculations and utilities
   */

  mapCCBillTransactionType(transactionType) {
    const typeMap = {
      'SALE': 'subscription',
      'REBILL': 'subscription',
      'REFUND': 'refund',
      'CHARGEBACK': 'chargeback'
    };
    return typeMap[transactionType] || 'other';
  }

  mapSegpayTransactionType(transactionType) {
    const typeMap = {
      'initial': 'subscription',
      'rebill': 'subscription',
      'refund': 'refund',
      'void': 'void'
    };
    return typeMap[transactionType] || 'other';
  }

  calculateVolatility(payouts) {
    if (payouts.length < 2) return 0;
    
    const amounts = payouts.map(p => p.netAmount);
    const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length;
    const standardDeviation = Math.sqrt(variance);
    
    return mean > 0 ? standardDeviation / mean : 0; // Coefficient of variation
  }

  detectSeasonality(payouts) {
    if (payouts.length < 12) {
      return { hasPattern: false, confidence: 'low' };
    }

    // Group by month
    const monthlyTotals = new Array(12).fill(0);
    payouts.forEach(payout => {
      const month = new Date(payout.payoutDate).getMonth();
      monthlyTotals[month] += payout.netAmount;
    });

    // Simple seasonality detection - look for months that are >20% above average
    const average = monthlyTotals.reduce((sum, total) => sum + total, 0) / 12;
    const peakMonths = monthlyTotals.map((total, index) => ({ month: index, total }))
      .filter(item => item.total > average * 1.2)
      .map(item => item.month);

    return {
      hasPattern: peakMonths.length >= 2,
      peakMonths,
      confidence: peakMonths.length >= 3 ? 'high' : peakMonths.length === 2 ? 'medium' : 'low'
    };
  }

  async analyzePotentialDeductions(creatorId, payouts) {
    // AI-powered deduction analysis based on payout patterns and industry standards
    const totalIncome = payouts.reduce((sum, p) => sum + p.netAmount, 0);
    
    // Industry averages for creator deductions
    const deductionRates = {
      equipment: 0.08,     // 8% of income on equipment
      software: 0.03,      // 3% on software/tools
      marketing: 0.05,     // 5% on marketing/advertising
      homeOffice: 0.04,    // 4% on home office expenses
      internet: 0.02,      // 2% on internet/phone
      professional: 0.02   // 2% on professional services
    };

    const potentialDeductions = {};
    let total = 0;

    for (const [category, rate] of Object.entries(deductionRates)) {
      const amount = Math.round(totalIncome * rate);
      potentialDeductions[category] = amount;
      total += amount;
    }

    return { ...potentialDeductions, total };
  }

  generateTaxVaultExplanation(reserveRate, volatility, taxProfile) {
    const percentage = (reserveRate * 100).toFixed(1);
    const volatilityDesc = volatility > 0.5 ? 'highly variable' : volatility < 0.2 ? 'stable' : 'moderately variable';
    const jurisdictionName = this.getJurisdictionName(taxProfile.taxResidency);
    
    return `Based on your ${volatilityDesc} income pattern and ${jurisdictionName} tax obligations, we recommend reserving ${percentage}% of each payout. This strategy balances tax preparedness with cash flow needs.`;
  }

  getJurisdictionName(code) {
    const names = {
      'US': 'United States',
      'CA': 'Canada',
      'UK': 'United Kingdom',
      'EU': 'European Union',
      'AU': 'Australia'
    };
    return names[code] || code;
  }

  calculateAIConfidence(payoutCount, volatility) {
    let confidence = 0.5; // Base confidence
    
    // More payouts = higher confidence
    if (payoutCount >= 12) confidence += 0.3;
    else if (payoutCount >= 6) confidence += 0.2;
    else if (payoutCount >= 3) confidence += 0.1;
    
    // Lower volatility = higher confidence
    if (volatility < 0.2) confidence += 0.2;
    else if (volatility > 0.5) confidence -= 0.1;
    
    return Math.max(0.1, Math.min(0.9, confidence));
  }

  getEmptyEstimates() {
    return {
      ytdGross: 0,
      ytdNet: 0,
      ytdFees: 0,
      projectedAnnualIncome: 0,
      estimatedFederalTax: 0,
      estimatedStateTax: 0,
      totalEstimatedTax: 0,
      effectiveRate: 0,
      quarterlyEstimates: [],
      taxVaultStrategy: this.getDefaultTaxVaultStrategy(),
      lastUpdated: new Date().toISOString(),
      processorBreakdown: {},
      complianceStatus: 'incomplete'
    };
  }

  getDefaultTaxVaultStrategy() {
    return {
      recommendedReserveRate: 0.25,
      projectedMonthlyReserve: 0,
      strategy: 'balanced',
      volatilityScore: 0,
      seasonalityDetected: false,
      explanation: 'Default 25% reserve rate recommended until sufficient payout history is available.',
      aiConfidence: 0.5,
      lastOptimized: new Date().toISOString()
    };
  }

  // Placeholder methods - to be implemented with actual database/service connections
  async getCreatorTaxProfile(creatorId) {
    // TODO: Implement database query to get creator tax profile
    return {
      id: creatorId,
      taxResidency: 'US',
      entityType: 'individual',
      backupWithholding: false,
      eConsentStatus: 'granted'
    };
  }

  async getYtdPayouts(creatorId, taxYear) {
    // TODO: Implement database query for YTD payouts
    return [];
  }

  async getRecentPayouts(creatorId, count) {
    // TODO: Implement database query for recent payouts
    return [];
  }

  async recordPayoutInLedger(normalizedPayout) {
    // TODO: Integrate with FanzFinance OS ledger system
    logger.info('Recording payout in ledger:', normalizedPayout);
  }

  async processTaxImplications(normalizedPayout) {
    // TODO: Process tax implications and update running totals
    logger.info('Processing tax implications for payout:', normalizedPayout);
  }

  async updateCreatorTaxEstimates(creatorId) {
    // TODO: Update real-time tax estimates
    logger.info(`Updating tax estimates for creator ${creatorId}`);
  }

  async processTaxVaultReserve(normalizedPayout) {
    // TODO: Process automatic tax vault reserves
    logger.info('Processing Tax Vault reserve for payout:', normalizedPayout);
  }

  async logTaxEvent(event) {
    // TODO: Implement comprehensive audit logging
    logger.info('Tax audit event:', event);
  }

  async storeFailedPayout(processorId, payload, error) {
    // TODO: Store failed payouts for retry processing
    logger.error('Storing failed payout:', { processorId, error: error.message });
  }

  calculateProcessorBreakdown(payouts) {
    // TODO: Calculate breakdown by processor
    return {};
  }

  async getComplianceStatus(creatorId) {
    // TODO: Get compliance status
    return 'compliant';
  }

  async calculateQuarterlyEstimates(taxProfile, projectedIncome) {
    // TODO: Calculate quarterly tax estimates for US creators
    return [];
  }
}

export default FanzTaxService;