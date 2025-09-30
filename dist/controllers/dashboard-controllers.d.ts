/**
 * FanzMoneyDash Dashboard Integration Controllers
 * API endpoints for all FANZ dashboards to access financial data and operations
 * Integrates with FanzDash, Creator Studios, Starz Dashboards, and Admin panels
 */
import { Request, Response } from 'express';
import { Logger } from '../utils/logger';
export interface DashboardUser {
    userId: string;
    role: 'admin' | 'moderator' | 'creator' | 'fan' | 'support';
    permissions: string[];
    platforms: string[];
}
export interface FinancialOverview {
    totalRevenue: string;
    totalPayouts: string;
    pendingTransactions: number;
    activeDisputes: number;
    trustScore: {
        average: number;
        trending: 'up' | 'down' | 'stable';
    };
    processorHealth: Array<{
        processor: string;
        status: 'healthy' | 'degraded' | 'offline';
        successRate: number;
        avgResponseTime: number;
    }>;
}
export interface CreatorFinancialSummary {
    creatorId: string;
    earnings: {
        today: string;
        thisWeek: string;
        thisMonth: string;
        allTime: string;
    };
    balance: {
        available: string;
        pending: string;
        frozen: string;
    };
    payouts: {
        lastPayoutDate: string;
        nextPayoutDate: string;
        totalPaidOut: string;
    };
    metrics: {
        fanCount: number;
        avgTipAmount: string;
        topPlatform: string;
        trustScore: number;
    };
}
export declare class AdminDashboardController {
    private readonly logger;
    /**
     * Get comprehensive financial overview for admin dashboard
     */
    getFinancialOverview(req: Request, res: Response): Promise<void>;
    /**
     * Get detailed settlement reports
     */
    getSettlementReports(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get real-time transaction monitoring data
     */
    getTransactionMonitoring(req: Request, res: Response): Promise<void>;
    /**
     * Handle dispute management actions
     */
    manageDispute(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Process manual refund approval/rejection
     */
    processRefundApproval(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private getRevenueData;
    private getPayoutData;
    private getTransactionCounts;
    private getDisputeData;
    private getTrustScoreMetrics;
    private getProcessorHealthMetrics;
}
export declare class CreatorDashboardController {
    private readonly logger;
    /**
     * Get creator's financial summary
     */
    getFinancialSummary(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Request payout for creator
     */
    requestPayout(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get creator's transaction history
     */
    getTransactionHistory(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private getCreatorEarnings;
    private getCreatorBalance;
    private getCreatorPayoutInfo;
    private getCreatorMetrics;
}
export declare class FanDashboardController {
    private readonly logger;
    /**
     * Get fan's spending summary
     */
    getSpendingSummary(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Process payment for fan
     */
    processPayment(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Request refund for fan
     */
    requestRefund(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private getFanSpendingData;
    private getFanSubscriptions;
    private getFanTrustScore;
}
export declare class VerificationController {
    private readonly logger;
    /**
     * Verify transaction manually
     */
    verifyTransaction(req: Request, res: Response): Promise<void>;
    /**
     * Get pending verifications for admin review
     */
    getPendingVerifications(req: Request, res: Response): Promise<void>;
}
export declare class BaseDashboardController {
    protected readonly logger: Logger;
    protected readonly database: any;
    protected extractUser(req: Request): DashboardUser;
    protected validateAdminAccess(user: DashboardUser): void;
    protected handleError(error: any, res: Response, message: string): void;
}
export interface AdminDashboardController extends BaseDashboardController {
}
export interface CreatorDashboardController extends BaseDashboardController {
}
export interface FanDashboardController extends BaseDashboardController {
}
export interface VerificationController extends BaseDashboardController {
}
export declare const adminDashboardController: AdminDashboardController;
export declare const creatorDashboardController: CreatorDashboardController;
export declare const fanDashboardController: FanDashboardController;
export declare const verificationController: VerificationController;
//# sourceMappingURL=dashboard-controllers.d.ts.map