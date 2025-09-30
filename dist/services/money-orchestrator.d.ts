/**
 * FanzMoneyDash Money Orchestrator
 * Central coordination service for all FANZ financial operations
 * Integrates payments, refunds, payouts, settlements, and compliance
 */
import { EventEmitter } from 'events';
export interface PaymentRequest {
    fanId: string;
    creatorId: string;
    platform: string;
    amount: string;
    currency: string;
    paymentMethod: 'card' | 'crypto' | 'bank' | 'wallet' | 'apple_pay' | 'google_pay';
    paymentDetails: {
        cardToken?: string;
        last4?: string;
        expiryDate?: string;
        walletAddress?: string;
        txid?: string;
        blockHeight?: number;
        applePayToken?: string;
        googlePayToken?: string;
        accountToken?: string;
        routingNumber?: string;
    };
    metadata?: {
        contentId?: string;
        subscriptionId?: string;
        tipMessage?: string;
        deviceFingerprint?: string;
        ipAddress?: string;
        userAgent?: string;
    };
}
export interface PaymentResponse {
    transactionId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'requires_verification';
    processorUsed: string;
    processorTransactionId?: string;
    authorizationCode?: string;
    fees: {
        processingFee: string;
        platformFee: string;
        totalFees: string;
    };
    settlement: {
        estimatedDate: string;
        netAmount: string;
    };
    verification?: {
        verificationId: string;
        status: string;
        nextSteps: string[];
    };
    metadata: {
        processingTimeMs: number;
        riskScore: number;
        routingDecision: string;
    };
}
export interface PayoutRequest {
    creatorId: string;
    amount: string;
    currency: string;
    payoutMethod: 'paxum' | 'wise' | 'payoneer' | 'crypto' | 'ach' | 'wire';
    payoutDetails: {
        paxumEmail?: string;
        wiseEmail?: string;
        profileId?: string;
        payoneerEmail?: string;
        cryptoAddress?: string;
        cryptoCurrency?: string;
        routingNumber?: string;
        accountNumber?: string;
        accountType?: 'checking' | 'savings';
        swiftCode?: string;
        iban?: string;
        bankName?: string;
    };
    scheduleType: 'instant' | 'daily' | 'weekly' | 'manual';
    metadata?: Record<string, any>;
}
export interface PayoutResponse {
    payoutId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    estimatedArrival: string;
    trackingId?: string;
    fees: {
        payoutFee: string;
        exchangeFee?: string;
        totalFees: string;
    };
    netAmount: string;
}
export interface SettlementSummary {
    settlementId: string;
    dateRange: {
        from: string;
        to: string;
    };
    totalTransactions: number;
    grossRevenue: string;
    totalFees: string;
    totalRefunds: string;
    totalChargebacks: string;
    netSettlement: string;
    breakdown: {
        byProcessor: Array<{
            processor: string;
            transactions: number;
            revenue: string;
            fees: string;
        }>;
        byPlatform: Array<{
            platform: string;
            transactions: number;
            revenue: string;
        }>;
    };
}
export declare class MoneyOrchestrator extends EventEmitter {
    private readonly logger;
    private readonly database;
    private readonly ledgerService;
    private readonly eventBus;
    private readonly processorClients;
    private readonly payoutClients;
    private readonly config;
    constructor(database: any, ledgerService: any, eventBus: any);
    processPayment(request: PaymentRequest): Promise<PaymentResponse>;
    processPayout(request: PayoutRequest): Promise<PayoutResponse>;
    processRefund(transactionId: string, reason: string, reasonDetails?: string, evidence?: any): Promise<any>;
    generateSettlementSummary(dateFrom: string, dateTo: string, processorFilter?: string[]): Promise<SettlementSummary>;
    handleDispute(transactionId: string, disputeType: 'chargeback' | 'retrieval' | 'fraud_claim', disputeDetails: any): Promise<void>;
    private validatePaymentRequest;
    private verifyTransaction;
    private routePayment;
    private executePayment;
    private calculateFees;
    private getProcessingFeeRate;
    private estimateSettlement;
    private initializeProcessorClients;
    private initializeEventHandlers;
    private handleVerificationCompleted;
    private handleRefundProcessed;
    private processSettlement;
    private holdForReview;
    private updateLedger;
    private validatePayoutRequest;
    private checkCreatorBalance;
    private calculatePayoutFees;
    private subtractFees;
    private createFailedTransaction;
    private createPayout;
    private createFailedPayout;
    private executeInstantPayout;
    private schedulePayoutExecution;
    private updateCreatorBalance;
    private updateLedgerForPayout;
    private getTransaction;
    private executeRefund;
    private queueRefundForReview;
    private createDispute;
    private notifyDisputeStakeholders;
    private autoRespondToRetrieval;
    private groupBy;
}
export declare const moneyOrchestrator: MoneyOrchestrator;
//# sourceMappingURL=money-orchestrator.d.ts.map