"use strict";
/**
 * FanzMoneyDash Money Orchestrator
 * Central coordination service for all FANZ financial operations
 * Integrates payments, refunds, payouts, settlements, and compliance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.moneyOrchestrator = exports.MoneyOrchestrator = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
const fanztrust_service_1 = require("./fanztrust-service");
// ========================================
// MONEY ORCHESTRATOR
// ========================================
class MoneyOrchestrator extends events_1.EventEmitter {
    logger = new logger_1.Logger('MoneyOrchestrator');
    // Service dependencies
    database;
    ledgerService;
    eventBus;
    // Processor clients
    processorClients = new Map();
    payoutClients = new Map();
    // Configuration
    config = {
        // Processing limits
        maxTransactionAmount: '50000', // $500 max transaction
        minTransactionAmount: '0.50', // $0.50 min transaction
        // Routing preferences
        primaryProcessors: ['rocketgate', 'segpay', 'ccbill'],
        cryptoProcessors: ['bitpay', 'coinbase', 'nowpayments'],
        // Settlement timing
        settlementCutoffHour: 23, // 11 PM UTC
        settlementDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        // Fee structure (basis points)
        platformFeeRate: 500, // 5%
        processingFeeRate: 290, // 2.9%
        // Risk thresholds
        autoApproveLimit: '100', // Auto-approve under $100
        manualReviewLimit: '1000', // Manual review $100-$1000
        blockLimit: '1000', // Block over $1000 if high risk
        // Payout minimums
        payoutMinimums: {
            paxum: '20',
            wise: '10',
            crypto: '25',
            ach: '50',
            wire: '100'
        }
    };
    constructor(database, ledgerService, eventBus) {
        super();
        this.database = database;
        this.ledgerService = ledgerService;
        this.eventBus = eventBus;
        this.initializeProcessorClients();
        this.initializeEventHandlers();
        this.logger.info('💰 FanzMoneyDash Money Orchestrator initialized');
    }
    // ========================================
    // PAYMENT PROCESSING
    // ========================================
    async processPayment(request) {
        const startTime = Date.now();
        const transactionId = `fmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.logger.info(`💳 Processing payment`, {
            transactionId,
            fanId: request.fanId,
            creatorId: request.creatorId,
            amount: request.amount,
            platform: request.platform,
            paymentMethod: request.paymentMethod
        });
        try {
            // 1. Validate payment request
            await this.validatePaymentRequest(request);
            // 2. Pre-transaction verification with FanzTrust™
            const verification = await this.verifyTransaction(request, transactionId);
            // 3. Handle verification result
            if (verification.status === 'rejected') {
                throw new Error(`Payment blocked: ${verification.riskFactors.join(', ')}`);
            }
            // 4. Route to optimal payment processor
            const routingDecision = await this.routePayment(request, verification);
            // 5. Create transaction record
            const transaction = await this.createTransaction(request, transactionId, routingDecision, verification);
            // 6. Process with selected processor
            let processingResult;
            if (verification.status === 'suspicious') {
                // Hold for manual review
                processingResult = await this.holdForReview(transaction, verification);
            }
            else {
                // Process immediately
                processingResult = await this.executePayment(transaction, routingDecision);
            }
            // 7. Update ledger
            await this.updateLedger(transaction, processingResult);
            // 8. Calculate fees and settlement
            const feeCalculation = this.calculateFees(request.amount, request.currency, routingDecision.processor);
            const settlementEstimate = this.estimateSettlement(processingResult.status);
            // 9. Emit payment event
            this.eventBus.emit('money.payment.processed', {
                transactionId,
                fanId: request.fanId,
                creatorId: request.creatorId,
                platform: request.platform,
                amount: request.amount,
                status: processingResult.status,
                processor: routingDecision.processor,
                riskScore: verification.trustScore
            });
            const response = {
                transactionId,
                status: processingResult.status,
                processorUsed: routingDecision.processor,
                processorTransactionId: processingResult.processorTransactionId,
                authorizationCode: processingResult.authorizationCode,
                fees: feeCalculation,
                settlement: settlementEstimate,
                verification: verification.status === 'suspicious' ? {
                    verificationId: verification.verificationId,
                    status: verification.status,
                    nextSteps: verification.nextActions
                } : undefined,
                metadata: {
                    processingTimeMs: Date.now() - startTime,
                    riskScore: verification.trustScore,
                    routingDecision: routingDecision.reason
                }
            };
            this.logger.info(`✅ Payment processed successfully`, {
                transactionId,
                status: processingResult.status,
                processor: routingDecision.processor,
                riskScore: verification.trustScore,
                processingTimeMs: response.metadata.processingTimeMs
            });
            return response;
        }
        catch (error) {
            this.logger.error(`❌ Payment processing failed`, {
                transactionId,
                error: error.message,
                fanId: request.fanId,
                amount: request.amount
            });
            // Create failed transaction record
            await this.createFailedTransaction(request, transactionId, error.message);
            throw error;
        }
    }
    // ========================================
    // PAYOUT PROCESSING
    // ========================================
    async processPayout(request) {
        const payoutId = `fmp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.logger.info(`💸 Processing payout`, {
            payoutId,
            creatorId: request.creatorId,
            amount: request.amount,
            payoutMethod: request.payoutMethod
        });
        try {
            // 1. Validate payout request
            await this.validatePayoutRequest(request);
            // 2. Check creator balance and eligibility
            const balanceCheck = await this.checkCreatorBalance(request.creatorId, request.amount);
            if (!balanceCheck.sufficient) {
                throw new Error(`Insufficient balance. Available: ${balanceCheck.available}, Requested: ${request.amount}`);
            }
            // 3. Calculate payout fees
            const feeCalculation = this.calculatePayoutFees(request.amount, request.payoutMethod);
            // 4. Create payout record
            const payout = await this.createPayout(request, payoutId, feeCalculation);
            // 5. Execute payout based on method and schedule
            let payoutResult;
            if (request.scheduleType === 'instant') {
                payoutResult = await this.executeInstantPayout(payout);
            }
            else {
                payoutResult = await this.schedulePayoutExecution(payout);
            }
            // 6. Update creator balance and ledger
            await this.updateCreatorBalance(request.creatorId, request.amount, 'debit', payoutId);
            await this.updateLedgerForPayout(payout, payoutResult);
            // 7. Emit payout event
            this.eventBus.emit('money.payout.processed', {
                payoutId,
                creatorId: request.creatorId,
                amount: request.amount,
                payoutMethod: request.payoutMethod,
                status: payoutResult.status
            });
            const response = {
                payoutId,
                status: payoutResult.status,
                estimatedArrival: payoutResult.estimatedArrival,
                trackingId: payoutResult.trackingId,
                fees: feeCalculation,
                netAmount: this.subtractFees(request.amount, feeCalculation.totalFees)
            };
            this.logger.info(`✅ Payout processed`, {
                payoutId,
                status: payoutResult.status,
                payoutMethod: request.payoutMethod
            });
            return response;
        }
        catch (error) {
            this.logger.error(`❌ Payout processing failed`, {
                payoutId,
                error: error.message,
                creatorId: request.creatorId
            });
            // Create failed payout record
            await this.createFailedPayout(request, payoutId, error.message);
            throw error;
        }
    }
    // ========================================
    // REFUND PROCESSING
    // ========================================
    async processRefund(transactionId, reason, reasonDetails, evidence) {
        this.logger.info(`↩️ Processing refund`, { transactionId, reason });
        try {
            // Get original transaction
            const transaction = await this.getTransaction(transactionId);
            if (!transaction) {
                throw new Error('Transaction not found');
            }
            // Use FanzTrust™ for automated refund decision
            const refundResult = await fanztrust_service_1.fanzTrustEngine.processRefundRequest({
                transactionId,
                fanId: transaction.user_id,
                creatorId: transaction.creator_id,
                amount: transaction.amount,
                currency: transaction.currency,
                reason,
                reasonDetails,
                evidence
            });
            // Handle refund based on FanzTrust™ decision
            if (refundResult.status === 'auto_approved') {
                await this.executeRefund(transaction, refundResult);
            }
            else if (refundResult.status === 'manual_review') {
                await this.queueRefundForReview(transaction, refundResult);
            }
            return refundResult;
        }
        catch (error) {
            this.logger.error(`❌ Refund processing failed`, {
                transactionId,
                error: error.message
            });
            throw error;
        }
    }
    // ========================================
    // SETTLEMENT REPORTING
    // ========================================
    async generateSettlementSummary(dateFrom, dateTo, processorFilter) {
        this.logger.info(`📊 Generating settlement summary`, { dateFrom, dateTo });
        try {
            const settlementId = `fms_${Date.now()}`;
            // Get settlement data from database
            const settlementData = await this.database.query(`
        SELECT 
          processor_id,
          platform_id,
          COUNT(*) as transaction_count,
          SUM(amount) as gross_revenue,
          SUM(processing_fee) as total_processing_fees,
          SUM(platform_fee) as total_platform_fees
        FROM transactions 
        WHERE created_at >= $1 AND created_at <= $2
        AND status IN ('completed', 'settled')
        ${processorFilter ? `AND processor_id IN (${processorFilter.map(p => `'${p}'`).join(',')})` : ''}
        GROUP BY processor_id, platform_id
        ORDER BY gross_revenue DESC
      `, [dateFrom, dateTo]);
            // Get refunds and chargebacks
            const adjustments = await this.database.query(`
        SELECT 
          SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END) as total_refunds,
          SUM(CASE WHEN type = 'chargeback' THEN amount ELSE 0 END) as total_chargebacks
        FROM transaction_events 
        WHERE created_at >= $1 AND created_at <= $2
      `, [dateFrom, dateTo]);
            // Calculate totals
            const totals = settlementData.reduce((acc, row) => ({
                transactions: acc.transactions + parseInt(row.transaction_count),
                grossRevenue: acc.grossRevenue + parseFloat(row.gross_revenue),
                totalFees: acc.totalFees + parseFloat(row.total_processing_fees) + parseFloat(row.total_platform_fees)
            }), { transactions: 0, grossRevenue: 0, totalFees: 0 });
            const totalRefunds = parseFloat(adjustments[0]?.total_refunds || '0');
            const totalChargebacks = parseFloat(adjustments[0]?.total_chargebacks || '0');
            const netSettlement = totals.grossRevenue - totals.totalFees - totalRefunds - totalChargebacks;
            // Generate breakdown
            const byProcessor = this.groupBy(settlementData, 'processor_id');
            const byPlatform = this.groupBy(settlementData, 'platform_id');
            const summary = {
                settlementId,
                dateRange: { from: dateFrom, to: dateTo },
                totalTransactions: totals.transactions,
                grossRevenue: totals.grossRevenue.toFixed(2),
                totalFees: totals.totalFees.toFixed(2),
                totalRefunds: totalRefunds.toFixed(2),
                totalChargebacks: totalChargebacks.toFixed(2),
                netSettlement: netSettlement.toFixed(2),
                breakdown: {
                    byProcessor: byProcessor.map(group => ({
                        processor: group.key,
                        transactions: group.transactions,
                        revenue: group.revenue.toFixed(2),
                        fees: group.fees.toFixed(2)
                    })),
                    byPlatform: byPlatform.map(group => ({
                        platform: group.key,
                        transactions: group.transactions,
                        revenue: group.revenue.toFixed(2)
                    }))
                }
            };
            this.logger.info(`✅ Settlement summary generated`, {
                settlementId,
                totalTransactions: summary.totalTransactions,
                netSettlement: summary.netSettlement
            });
            return summary;
        }
        catch (error) {
            this.logger.error(`❌ Settlement summary failed`, { error: error.message });
            throw error;
        }
    }
    // ========================================
    // DISPUTE MANAGEMENT
    // ========================================
    async handleDispute(transactionId, disputeType, disputeDetails) {
        this.logger.info(`⚖️ Handling dispute`, { transactionId, disputeType });
        try {
            const transaction = await this.getTransaction(transactionId);
            if (!transaction) {
                throw new Error('Transaction not found');
            }
            // Create dispute record
            const dispute = await this.createDispute(transaction, disputeType, disputeDetails);
            // Notify stakeholders
            await this.notifyDisputeStakeholders(dispute, transaction);
            // Auto-respond to disputes where possible
            if (disputeType === 'retrieval') {
                await this.autoRespondToRetrieval(dispute, transaction);
            }
            this.eventBus.emit('money.dispute.created', {
                disputeId: dispute.id,
                transactionId,
                disputeType,
                amount: transaction.amount
            });
        }
        catch (error) {
            this.logger.error(`❌ Dispute handling failed`, {
                transactionId,
                error: error.message
            });
            throw error;
        }
    }
    // ========================================
    // PRIVATE HELPER METHODS
    // ========================================
    async validatePaymentRequest(request) {
        // Validate amount
        const amount = parseFloat(request.amount);
        if (amount < parseFloat(this.config.minTransactionAmount)) {
            throw new Error(`Amount below minimum: ${this.config.minTransactionAmount}`);
        }
        if (amount > parseFloat(this.config.maxTransactionAmount)) {
            throw new Error(`Amount exceeds maximum: ${this.config.maxTransactionAmount}`);
        }
        // Validate payment method details
        switch (request.paymentMethod) {
            case 'card':
                if (!request.paymentDetails.cardToken) {
                    throw new Error('Card token required for card payments');
                }
                break;
            case 'crypto':
                if (!request.paymentDetails.walletAddress) {
                    throw new Error('Wallet address required for crypto payments');
                }
                break;
            // Add other validation rules as needed
        }
    }
    async verifyTransaction(request, transactionId) {
        return await fanztrust_service_1.fanzTrustEngine.verifyTransaction({
            fanId: request.fanId,
            creatorId: request.creatorId,
            transactionId,
            paymentMethod: request.paymentMethod,
            platform: request.platform,
            proof: {
                email: '', // Would be retrieved from user profile
                timestamp: new Date().toISOString(),
                deviceFingerprint: request.metadata?.deviceFingerprint,
                ipAddress: request.metadata?.ipAddress,
                last4: request.paymentDetails.last4
            }
        });
    }
    async routePayment(request, verification) {
        // Get routing rules from database
        const routingRules = await this.database.query(`
      SELECT * FROM routing_rules 
      WHERE is_active = true 
      ORDER BY priority ASC
    `);
        // Apply routing logic
        for (const rule of routingRules) {
            const conditions = rule.conditions || {};
            // Check conditions
            let matches = true;
            if (conditions.platform && conditions.platform !== request.platform) {
                matches = false;
            }
            if (conditions.paymentMethod && conditions.paymentMethod !== request.paymentMethod) {
                matches = false;
            }
            if (conditions.minRiskScore && verification.trustScore < conditions.minRiskScore) {
                matches = false;
            }
            if (conditions.maxRiskScore && verification.trustScore > conditions.maxRiskScore) {
                matches = false;
            }
            if (matches) {
                return {
                    processor: rule.target_processor,
                    merchantId: rule.target_merchant_id,
                    reason: `Matched routing rule: ${rule.name}`
                };
            }
        }
        // Default routing
        const defaultProcessor = this.config.primaryProcessors[0];
        return {
            processor: defaultProcessor,
            merchantId: 'default',
            reason: 'Default routing - no specific rules matched'
        };
    }
    async createTransaction(request, transactionId, routing, verification) {
        return await this.database.insert('transactions', {
            id: transactionId,
            user_id: request.fanId,
            creator_id: request.creatorId,
            platform_id: request.platform,
            amount: request.amount,
            currency: request.currency,
            payment_method: request.paymentMethod,
            processor_id: routing.processor,
            merchant_id: routing.merchantId,
            status: 'pending',
            risk_score: verification.trustScore,
            verification_id: verification.verificationId,
            metadata: {
                ...request.metadata,
                routingReason: routing.reason
            },
            created_at: new Date()
        });
    }
    async executePayment(transaction, routing) {
        const processorClient = this.processorClients.get(routing.processor);
        if (!processorClient) {
            throw new Error(`Processor not available: ${routing.processor}`);
        }
        try {
            // Call processor API
            const result = await processorClient.processPayment({
                merchantId: routing.merchantId,
                amount: transaction.amount,
                currency: transaction.currency,
                paymentMethod: transaction.payment_method,
                // Include payment details, customer info, etc.
            });
            // Update transaction status
            await this.database.update('transactions', transaction.id, {
                status: result.status,
                processor_transaction_id: result.transactionId,
                authorization_code: result.authorizationCode,
                updated_at: new Date()
            });
            return result;
        }
        catch (error) {
            // Update transaction as failed
            await this.database.update('transactions', transaction.id, {
                status: 'failed',
                failure_reason: error.message,
                updated_at: new Date()
            });
            throw error;
        }
    }
    calculateFees(amount, currency, processor) {
        const amountNum = parseFloat(amount);
        // Processing fee (varies by processor)
        const processingFeeRate = this.getProcessingFeeRate(processor);
        const processingFee = amountNum * (processingFeeRate / 10000);
        // Platform fee
        const platformFee = amountNum * (this.config.platformFeeRate / 10000);
        const totalFees = processingFee + platformFee;
        return {
            processingFee: processingFee.toFixed(2),
            platformFee: platformFee.toFixed(2),
            totalFees: totalFees.toFixed(2)
        };
    }
    getProcessingFeeRate(processor) {
        const rates = {
            'rocketgate': 290, // 2.9%
            'segpay': 295, // 2.95%
            'ccbill': 285, // 2.85%
            'bitpay': 100, // 1.0%
            'coinbase': 150 // 1.5%
        };
        return rates[processor] || this.config.processingFeeRate;
    }
    estimateSettlement(status) {
        const now = new Date();
        let estimatedDate = new Date(now);
        // Add business days based on processor
        if (status === 'completed') {
            estimatedDate.setDate(now.getDate() + 2); // 2 business days
        }
        else {
            estimatedDate.setDate(now.getDate() + 5); // 5 business days
        }
        return {
            estimatedDate: estimatedDate.toISOString().split('T')[0],
            netAmount: '0.00' // Would be calculated based on actual fees
        };
    }
    async initializeProcessorClients() {
        // Initialize payment processor clients
        this.logger.info('🔌 Initializing processor clients...');
        // Implementation would load actual processor SDKs
        // For now, using mock clients
    }
    async initializeEventHandlers() {
        // Listen for important events
        this.eventBus.on('fanztrust.verification.completed', this.handleVerificationCompleted.bind(this));
        this.eventBus.on('fanztrust.refund.processed', this.handleRefundProcessed.bind(this));
        // Settlement events
        this.eventBus.on('settlement.ready', this.processSettlement.bind(this));
        // Dispute events
        this.eventBus.on('processor.dispute.received', this.handleDispute.bind(this));
    }
    async handleVerificationCompleted(event) {
        this.logger.info('🔍 Verification completed', event);
        // Handle verification completion logic
    }
    async handleRefundProcessed(event) {
        this.logger.info('↩️ Refund processed', event);
        // Handle refund completion logic
    }
    async processSettlement(event) {
        this.logger.info('💰 Processing settlement', event);
        // Handle settlement processing logic
    }
    // Additional helper methods for database operations, validation, etc.
    async holdForReview(transaction, verification) {
        return {
            status: 'requires_verification',
            processorTransactionId: null,
            authorizationCode: null
        };
    }
    async updateLedger(transaction, result) {
        // Update double-entry ledger with transaction
        await this.ledgerService.recordTransaction(transaction, result);
    }
    async validatePayoutRequest(request) {
        // Validate payout request
        const minAmount = this.config.payoutMinimums[request.payoutMethod];
        if (parseFloat(request.amount) < parseFloat(minAmount)) {
            throw new Error(`Amount below minimum for ${request.payoutMethod}: ${minAmount}`);
        }
    }
    async checkCreatorBalance(creatorId, amount) {
        // Check creator's available balance
        const balance = await this.database.query(`
      SELECT available_balance FROM creator_balances WHERE creator_id = $1
    `, [creatorId]);
        const available = balance[0]?.available_balance || '0';
        const sufficient = parseFloat(available) >= parseFloat(amount);
        return { sufficient, available };
    }
    calculatePayoutFees(amount, method) {
        // Calculate payout fees based on method
        const feeRates = {
            'paxum': 100, // $1.00
            'wise': 50, // $0.50
            'crypto': 500, // $5.00
            'ach': 25, // $0.25
            'wire': 1500 // $15.00
        };
        const fee = (feeRates[method] || 0) / 100;
        return {
            payoutFee: fee.toFixed(2),
            totalFees: fee.toFixed(2)
        };
    }
    subtractFees(amount, fees) {
        return (parseFloat(amount) - parseFloat(fees)).toFixed(2);
    }
    async createTransaction(...args) { /* Implementation */ return null; }
    async createFailedTransaction(...args) { /* Implementation */ return null; }
    async createPayout(...args) { /* Implementation */ return null; }
    async createFailedPayout(...args) { /* Implementation */ return null; }
    async executeInstantPayout(...args) { /* Implementation */ return null; }
    async schedulePayoutExecution(...args) { /* Implementation */ return null; }
    async updateCreatorBalance(...args) { /* Implementation */ return null; }
    async updateLedgerForPayout(...args) { /* Implementation */ return null; }
    async getTransaction(id) { /* Implementation */ return null; }
    async executeRefund(...args) { /* Implementation */ return null; }
    async queueRefundForReview(...args) { /* Implementation */ return null; }
    async createDispute(...args) { /* Implementation */ return null; }
    async notifyDisputeStakeholders(...args) { /* Implementation */ return null; }
    async autoRespondToRetrieval(...args) { /* Implementation */ return null; }
    groupBy(data, key) {
        const grouped = data.reduce((acc, item) => {
            const groupKey = item[key];
            if (!acc[groupKey]) {
                acc[groupKey] = { key: groupKey, transactions: 0, revenue: 0, fees: 0 };
            }
            acc[groupKey].transactions += parseInt(item.transaction_count);
            acc[groupKey].revenue += parseFloat(item.gross_revenue);
            acc[groupKey].fees += parseFloat(item.total_processing_fees) + parseFloat(item.total_platform_fees);
            return acc;
        }, {});
        return Object.values(grouped);
    }
}
exports.MoneyOrchestrator = MoneyOrchestrator;
// Export singleton instance
exports.moneyOrchestrator = new MoneyOrchestrator(null, // database - would be injected
null, // ledgerService - would be injected  
null // eventBus - would be injected
);
//# sourceMappingURL=money-orchestrator.js.map