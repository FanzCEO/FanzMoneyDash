/**
 * FanzTrust™ Verification Engine
 * Enterprise-grade transaction verification and automated refund processing
 * Integrates with all FANZ platforms and payment processors
 */
import { EventEmitter } from 'events';
export interface VerificationRequest {
    fanId: string;
    creatorId: string;
    transactionId?: string;
    paymentMethod: 'card' | 'crypto' | 'bank' | 'wallet';
    platform: string;
    proof: {
        txid?: string;
        last4?: string;
        email: string;
        timestamp: string;
        deviceFingerprint?: string;
        ipAddress?: string;
    };
    metadata?: Record<string, any>;
}
export interface VerificationResponse {
    verificationId: string;
    status: 'verified' | 'rejected' | 'suspicious';
    confidence: number;
    trustScore: number;
    riskFactors: string[];
    nextActions: string[];
    explanation: {
        primaryFactors: string[];
        riskFactors: string[];
        protectiveFactors: string[];
        recommendations: string[];
    };
    metadata: {
        processingTimeMs: number;
        modelVersion: string;
        processingNode: string;
    };
}
export interface RefundRequest {
    transactionId: string;
    fanId: string;
    creatorId: string;
    amount: string;
    currency: string;
    reason: string;
    reasonDetails?: string;
    evidence?: {
        contentAccessed?: boolean;
        accessDuration?: number;
        screenshots?: string[];
        supportingDocs?: string[];
    };
    metadata?: Record<string, any>;
}
export interface RefundResponse {
    refundId: string;
    status: 'auto_approved' | 'manual_review' | 'auto_rejected';
    decision: {
        reason: string;
        evidence: Record<string, any>;
        nextSteps: string[];
        slaHours?: number;
    };
    estimatedProcessingTime?: string;
}
export interface RiskSignals {
    device: {
        fingerprint?: string;
        reputation: number;
        velocity: number;
        newDevice: boolean;
        suspiciousPatterns: string[];
    };
    network: {
        ipReputation: number;
        geoVelocity: number;
        torVpn: boolean;
        suspiciousIsp: boolean;
        countryRisk: number;
    };
    payment: {
        avsResult?: string;
        cvvResult?: string;
        binCountry?: string;
        issuerType?: string;
        prepaidCard?: boolean;
        riskScore: number;
    };
    behavioral: {
        accountAge: number;
        spendingPattern: number;
        refundHistory: number;
        velocityScore: number;
        platformTenure: number;
    };
    platform: {
        riskLevel: 'low' | 'medium' | 'high';
        contentType: string;
        creatorTier: string;
        contentAccess: {
            accessed: boolean;
            duration?: number;
            downloadCount?: number;
        };
    };
}
export declare class FanzTrustVerificationEngine extends EventEmitter {
    private readonly database;
    private readonly ledgerService;
    private readonly eventBus;
    private readonly logger;
    private readonly modelVersion;
    private readonly processingNode;
    private readonly processorClients;
    private readonly config;
    constructor(database: any, ledgerService: any, eventBus: any);
    verifyTransaction(request: VerificationRequest): Promise<VerificationResponse>;
    processRefundRequest(request: RefundRequest): Promise<RefundResponse>;
    private crossReferenceTransaction;
    private collectRiskSignals;
    private collectDeviceSignals;
    private collectNetworkSignals;
    private collectPaymentSignals;
    private collectBehavioralSignals;
    private collectPlatformSignals;
    private calculateTrustScore;
    private calculateDeviceScore;
    private calculateNetworkScore;
    private calculateBehavioralScore;
    private calculatePlatformScore;
    private calculateConfidence;
    private makeVerificationDecision;
    private generateExplanation;
    private initializeProcessorClients;
    private createRocketGateClient;
    private createSegPayClient;
    private createCCBillClient;
    private createBitPayClient;
    private storeTrustScore;
    private lookupIPReputation;
    private calculateGeoVelocity;
    private detectTorVpn;
    private getGeoInfo;
    private collectCardSignals;
    private collectCryptoSignals;
    private collectRefundSignals;
    private calculateRefundTrustScore;
    private applyRefundPolicies;
    private executeAutoRefund;
    private queueForManualReview;
    private rejectRefund;
    private createRefundRecord;
    private createFailedRefundRecord;
    private getTransaction;
}
export declare const fanzTrustEngine: FanzTrustVerificationEngine;
//# sourceMappingURL=fanztrust-service.d.ts.map