/**
 * FanzMoneyDash Dashboard Integration Controllers
 * API endpoints for all FANZ dashboards to access financial data and operations
 * Integrates with FanzDash, Creator Studios, Starz Dashboards, and Admin panels
 */

import { Request, Response } from 'express';
import { Logger } from '../utils/logger';
import { moneyOrchestrator } from '../services/money-orchestrator';
import { fanzTrustEngine } from '../services/fanztrust-service';
import type {
  PaymentRequest,
  PayoutRequest,
  VerificationRequest,
  RefundRequest
} from '../services/money-orchestrator';

// ========================================
// TYPES & INTERFACES
// ========================================

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

// ========================================
// ADMIN DASHBOARD CONTROLLER
// ========================================

export class AdminDashboardController {
  private readonly logger = new Logger('AdminDashboardController');

  /**
   * Get comprehensive financial overview for admin dashboard
   */
  async getFinancialOverview(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      this.validateAdminAccess(user);

      const { timeframe = '30d', platforms } = req.query;

      // Get financial metrics
      const [
        revenueData,
        payoutData,
        transactionCounts,
        disputeData,
        trustScoreData,
        processorHealth
      ] = await Promise.all([
        this.getRevenueData(timeframe as string, platforms as string[]),
        this.getPayoutData(timeframe as string),
        this.getTransactionCounts(),
        this.getDisputeData(),
        this.getTrustScoreMetrics(),
        this.getProcessorHealthMetrics()
      ]);

      const overview: FinancialOverview = {
        totalRevenue: revenueData.total,
        totalPayouts: payoutData.total,
        pendingTransactions: transactionCounts.pending,
        activeDisputes: disputeData.active,
        trustScore: trustScoreData,
        processorHealth
      };

      this.logger.info('🏢 Admin financial overview requested', {
        userId: user.userId,
        timeframe,
        totalRevenue: overview.totalRevenue
      });

      res.json({
        success: true,
        data: overview,
        metadata: {
          timeframe,
          generatedAt: new Date().toISOString(),
          platforms: platforms || 'all'
        }
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to get financial overview');
    }
  }

  /**
   * Get detailed settlement reports
   */
  async getSettlementReports(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      this.validateAdminAccess(user);

      const { dateFrom, dateTo, processors } = req.query;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({
          success: false,
          error: 'dateFrom and dateTo parameters are required'
        });
      }

      const settlement = await moneyOrchestrator.generateSettlementSummary(
        dateFrom as string,
        dateTo as string,
        processors ? (processors as string).split(',') : undefined
      );

      this.logger.info('📊 Settlement report generated', {
        userId: user.userId,
        dateFrom,
        dateTo,
        settlementId: settlement.settlementId
      });

      res.json({
        success: true,
        data: settlement
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to generate settlement report');
    }
  }

  /**
   * Get real-time transaction monitoring data
   */
  async getTransactionMonitoring(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      this.validateAdminAccess(user);

      const { status, processor, platform, limit = 50 } = req.query;

      // Build query conditions
      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 0;

      if (status) {
        conditions.push(`status = $${++paramCount}`);
        params.push(status);
      }

      if (processor) {
        conditions.push(`processor_id = $${++paramCount}`);
        params.push(processor);
      }

      if (platform) {
        conditions.push(`platform_id = $${++paramCount}`);
        params.push(platform);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const transactions = await this.database.query(`
        SELECT 
          t.id,
          t.amount,
          t.currency,
          t.status,
          t.processor_id,
          t.platform_id,
          t.risk_score,
          t.created_at,
          t.updated_at,
          ts.score as trust_score,
          ts.decision as trust_decision
        FROM transactions t
        LEFT JOIN trust_scores ts ON t.verification_id = ts.verification_id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT $${++paramCount}
      `, [...params, limit]);

      res.json({
        success: true,
        data: transactions,
        metadata: {
          total: transactions.length,
          filters: { status, processor, platform }
        }
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to get transaction monitoring data');
    }
  }

  /**
   * Handle dispute management actions
   */
  async manageDispute(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      this.validateAdminAccess(user);

      const { disputeId } = req.params;
      const { action, notes, evidence } = req.body;

      if (!['accept', 'fight', 'settle'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Must be: accept, fight, or settle'
        });
      }

      // Update dispute record
      await this.database.update('disputes', disputeId, {
        status: action === 'accept' ? 'accepted' : action === 'fight' ? 'fighting' : 'settled',
        admin_action: action,
        admin_notes: notes,
        admin_evidence: evidence,
        handled_by: user.userId,
        handled_at: new Date()
      });

      // Log admin action
      await this.database.insert('audit_logs', {
        user_id: user.userId,
        action: 'dispute_management',
        entity_type: 'dispute',
        entity_id: disputeId,
        details: { action, notes },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      this.logger.info('⚖️ Dispute action taken', {
        userId: user.userId,
        disputeId,
        action
      });

      res.json({
        success: true,
        message: `Dispute ${action} action completed`,
        disputeId
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to manage dispute');
    }
  }

  /**
   * Process manual refund approval/rejection
   */
  async processRefundApproval(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      this.validateAdminAccess(user);

      const { approvalId } = req.params;
      const { action, reason, notes } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Must be: approve or reject'
        });
      }

      // Get approval record
      const approval = await this.database.query(
        'SELECT * FROM approvals WHERE id = $1 AND entity_type = $2',
        [approvalId, 'refund']
      );

      if (!approval[0]) {
        return res.status(404).json({
          success: false,
          error: 'Refund approval not found'
        });
      }

      // Update approval
      await this.database.update('approvals', approvalId, {
        status: action === 'approve' ? 'approved' : 'rejected',
        approved_by: user.userId,
        approved_at: new Date(),
        approval_reason: reason,
        approval_notes: notes
      });

      // If approved, execute the refund
      if (action === 'approve') {
        const refundData = approval[0].request_data;
        await moneyOrchestrator.processRefund(
          refundData.transactionId,
          refundData.reason,
          refundData.reasonDetails,
          refundData.evidence
        );
      }

      this.logger.info('✅ Refund approval processed', {
        userId: user.userId,
        approvalId,
        action
      });

      res.json({
        success: true,
        message: `Refund ${action}ed successfully`,
        approvalId
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to process refund approval');
    }
  }

  // Private helper methods for admin controller
  private async getRevenueData(timeframe: string, platforms?: string[]): Promise<{ total: string }> {
    // Implementation to get revenue data
    return { total: '0.00' };
  }

  private async getPayoutData(timeframe: string): Promise<{ total: string }> {
    // Implementation to get payout data
    return { total: '0.00' };
  }

  private async getTransactionCounts(): Promise<{ pending: number }> {
    const result = await this.database.query(
      "SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'"
    );
    return { pending: parseInt(result[0]?.count || '0') };
  }

  private async getDisputeData(): Promise<{ active: number }> {
    const result = await this.database.query(
      "SELECT COUNT(*) as count FROM disputes WHERE status IN ('open', 'fighting')"
    );
    return { active: parseInt(result[0]?.count || '0') };
  }

  private async getTrustScoreMetrics(): Promise<{ average: number; trending: 'up' | 'down' | 'stable' }> {
    // Implementation to get trust score metrics
    return { average: 75, trending: 'stable' };
  }

  private async getProcessorHealthMetrics(): Promise<Array<{
    processor: string;
    status: 'healthy' | 'degraded' | 'offline';
    successRate: number;
    avgResponseTime: number;
  }>> {
    // Implementation to get processor health
    return [];
  }
}

// ========================================
// CREATOR DASHBOARD CONTROLLER
// ========================================

export class CreatorDashboardController {
  private readonly logger = new Logger('CreatorDashboardController');

  /**
   * Get creator's financial summary
   */
  async getFinancialSummary(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      const { creatorId } = req.params;

      // Validate access - creators can only see their own data
      if (user.role === 'creator' && user.userId !== creatorId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const [
        earnings,
        balance,
        payoutInfo,
        metrics
      ] = await Promise.all([
        this.getCreatorEarnings(creatorId),
        this.getCreatorBalance(creatorId),
        this.getCreatorPayoutInfo(creatorId),
        this.getCreatorMetrics(creatorId)
      ]);

      const summary: CreatorFinancialSummary = {
        creatorId,
        earnings,
        balance,
        payouts: payoutInfo,
        metrics
      };

      this.logger.info('👤 Creator financial summary requested', {
        creatorId,
        requestedBy: user.userId
      });

      res.json({
        success: true,
        data: summary
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to get creator financial summary');
    }
  }

  /**
   * Request payout for creator
   */
  async requestPayout(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      const { creatorId } = req.params;

      // Validate access
      if (user.role === 'creator' && user.userId !== creatorId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const payoutRequest: PayoutRequest = {
        creatorId,
        amount: req.body.amount,
        currency: req.body.currency || 'USD',
        payoutMethod: req.body.payoutMethod,
        payoutDetails: req.body.payoutDetails,
        scheduleType: req.body.scheduleType || 'manual',
        metadata: {
          requestedBy: user.userId,
          platform: req.body.platform,
          notes: req.body.notes
        }
      };

      const result = await moneyOrchestrator.processPayout(payoutRequest);

      this.logger.info('💸 Payout requested', {
        creatorId,
        payoutId: result.payoutId,
        amount: payoutRequest.amount,
        method: payoutRequest.payoutMethod
      });

      res.json({
        success: true,
        data: result,
        message: 'Payout request submitted successfully'
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to process payout request');
    }
  }

  /**
   * Get creator's transaction history
   */
  async getTransactionHistory(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      const { creatorId } = req.params;
      const { page = 1, limit = 20, status, dateFrom, dateTo } = req.query;

      // Validate access
      if (user.role === 'creator' && user.userId !== creatorId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      // Build query
      const conditions = ['creator_id = $1'];
      const params: any[] = [creatorId];
      let paramCount = 1;

      if (status) {
        conditions.push(`status = $${++paramCount}`);
        params.push(status);
      }

      if (dateFrom) {
        conditions.push(`created_at >= $${++paramCount}`);
        params.push(dateFrom);
      }

      if (dateTo) {
        conditions.push(`created_at <= $${++paramCount}`);
        params.push(dateTo);
      }

      const transactions = await this.database.query(`
        SELECT 
          id,
          user_id,
          amount,
          currency,
          status,
          processor_id,
          platform_id,
          risk_score,
          created_at,
          metadata
        FROM transactions 
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `, [...params, limit, offset]);

      // Get total count
      const totalResult = await this.database.query(`
        SELECT COUNT(*) as count FROM transactions 
        WHERE ${conditions.join(' AND ')}
      `, params);

      const total = parseInt(totalResult[0]?.count || '0');

      res.json({
        success: true,
        data: transactions,
        metadata: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string))
        }
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to get transaction history');
    }
  }

  // Private helper methods for creator controller
  private async getCreatorEarnings(creatorId: string): Promise<{
    today: string;
    thisWeek: string;
    thisMonth: string;
    allTime: string;
  }> {
    // Implementation to get creator earnings
    return {
      today: '0.00',
      thisWeek: '0.00',
      thisMonth: '0.00',
      allTime: '0.00'
    };
  }

  private async getCreatorBalance(creatorId: string): Promise<{
    available: string;
    pending: string;
    frozen: string;
  }> {
    const balance = await this.database.query(`
      SELECT available_balance, pending_balance, frozen_balance
      FROM creator_balances 
      WHERE creator_id = $1
    `, [creatorId]);

    const result = balance[0] || {};
    return {
      available: result.available_balance || '0.00',
      pending: result.pending_balance || '0.00',
      frozen: result.frozen_balance || '0.00'
    };
  }

  private async getCreatorPayoutInfo(creatorId: string): Promise<{
    lastPayoutDate: string;
    nextPayoutDate: string;
    totalPaidOut: string;
  }> {
    // Implementation to get payout information
    return {
      lastPayoutDate: '',
      nextPayoutDate: '',
      totalPaidOut: '0.00'
    };
  }

  private async getCreatorMetrics(creatorId: string): Promise<{
    fanCount: number;
    avgTipAmount: string;
    topPlatform: string;
    trustScore: number;
  }> {
    // Implementation to get creator metrics
    return {
      fanCount: 0,
      avgTipAmount: '0.00',
      topPlatform: '',
      trustScore: 0
    };
  }
}

// ========================================
// FAN DASHBOARD CONTROLLER
// ========================================

export class FanDashboardController {
  private readonly logger = new Logger('FanDashboardController');

  /**
   * Get fan's spending summary
   */
  async getSpendingSummary(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      const { fanId } = req.params;

      // Validate access - fans can only see their own data
      if (user.role === 'fan' && user.userId !== fanId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const [spendingData, subscriptions, trustScore] = await Promise.all([
        this.getFanSpendingData(fanId),
        this.getFanSubscriptions(fanId),
        this.getFanTrustScore(fanId)
      ]);

      res.json({
        success: true,
        data: {
          fanId,
          spending: spendingData,
          subscriptions,
          trustScore
        }
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to get fan spending summary');
    }
  }

  /**
   * Process payment for fan
   */
  async processPayment(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      const { fanId } = req.params;

      // Validate access
      if (user.role === 'fan' && user.userId !== fanId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const paymentRequest: PaymentRequest = {
        fanId,
        creatorId: req.body.creatorId,
        platform: req.body.platform,
        amount: req.body.amount,
        currency: req.body.currency || 'USD',
        paymentMethod: req.body.paymentMethod,
        paymentDetails: req.body.paymentDetails,
        metadata: {
          ...req.body.metadata,
          deviceFingerprint: req.body.deviceFingerprint,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      };

      const result = await moneyOrchestrator.processPayment(paymentRequest);

      this.logger.info('💳 Fan payment processed', {
        fanId,
        transactionId: result.transactionId,
        amount: paymentRequest.amount,
        creatorId: paymentRequest.creatorId
      });

      res.json({
        success: true,
        data: result,
        message: 'Payment processed successfully'
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to process payment');
    }
  }

  /**
   * Request refund for fan
   */
  async requestRefund(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      const { fanId, transactionId } = req.params;

      // Validate access
      if (user.role === 'fan' && user.userId !== fanId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const { reason, reasonDetails, evidence } = req.body;

      const result = await moneyOrchestrator.processRefund(
        transactionId,
        reason,
        reasonDetails,
        evidence
      );

      this.logger.info('↩️ Fan refund requested', {
        fanId,
        transactionId,
        refundId: result.refundId
      });

      res.json({
        success: true,
        data: result,
        message: 'Refund request submitted successfully'
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to process refund request');
    }
  }

  // Private helper methods for fan controller
  private async getFanSpendingData(fanId: string): Promise<any> {
    // Implementation to get fan spending data
    return {};
  }

  private async getFanSubscriptions(fanId: string): Promise<any[]> {
    // Implementation to get fan subscriptions
    return [];
  }

  private async getFanTrustScore(fanId: string): Promise<number> {
    const result = await this.database.query(`
      SELECT AVG(score) as avg_score 
      FROM trust_scores 
      WHERE user_id = $1
    `, [fanId]);

    return parseFloat(result[0]?.avg_score || '50');
  }
}

// ========================================
// VERIFICATION CONTROLLER
// ========================================

export class VerificationController {
  private readonly logger = new Logger('VerificationController');

  /**
   * Verify transaction manually
   */
  async verifyTransaction(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      this.validateAdminAccess(user);

      const verificationRequest: VerificationRequest = {
        fanId: req.body.fanId,
        creatorId: req.body.creatorId,
        transactionId: req.body.transactionId,
        paymentMethod: req.body.paymentMethod,
        platform: req.body.platform,
        proof: req.body.proof,
        metadata: {
          ...req.body.metadata,
          verifiedBy: user.userId
        }
      };

      const result = await fanzTrustEngine.verifyTransaction(verificationRequest);

      this.logger.info('🔍 Manual verification completed', {
        verificationId: result.verificationId,
        status: result.status,
        verifiedBy: user.userId
      });

      res.json({
        success: true,
        data: result,
        message: 'Transaction verification completed'
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to verify transaction');
    }
  }

  /**
   * Get pending verifications for admin review
   */
  async getPendingVerifications(req: Request, res: Response) {
    try {
      const user = this.extractUser(req);
      this.validateAdminAccess(user);

      const { limit = 20, platform } = req.query;

      const conditions = ["status = 'requires_verification'"];
      const params: any[] = [];
      let paramCount = 0;

      if (platform) {
        conditions.push(`platform_id = $${++paramCount}`);
        params.push(platform);
      }

      const pendingVerifications = await this.database.query(`
        SELECT 
          t.id,
          t.user_id,
          t.creator_id,
          t.amount,
          t.platform_id,
          t.risk_score,
          t.created_at,
          ts.verification_id,
          ts.explanation
        FROM transactions t
        LEFT JOIN trust_scores ts ON t.verification_id = ts.verification_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY t.created_at DESC
        LIMIT $${++paramCount}
      `, [...params, limit]);

      res.json({
        success: true,
        data: pendingVerifications,
        metadata: {
          total: pendingVerifications.length
        }
      });

    } catch (error) {
      this.handleError(error, res, 'Failed to get pending verifications');
    }
  }
}

// ========================================
// BASE CONTROLLER CLASS WITH SHARED METHODS
// ========================================

export class BaseDashboardController {
  protected readonly logger = new Logger('BaseDashboardController');
  protected readonly database: any = null; // Would be injected

  protected extractUser(req: Request): DashboardUser {
    // Extract user from JWT token or session
    // This is a simplified implementation
    const user = (req as any).user;
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user;
  }

  protected validateAdminAccess(user: DashboardUser): void {
    if (!['admin', 'moderator'].includes(user.role)) {
      throw new Error('Admin access required');
    }
  }

  protected handleError(error: any, res: Response, message: string): void {
    this.logger.error(message, { error: error.message });
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || message,
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}

// Apply base class to all controllers
export interface AdminDashboardController extends BaseDashboardController {}
export interface CreatorDashboardController extends BaseDashboardController {}
export interface FanDashboardController extends BaseDashboardController {}
export interface VerificationController extends BaseDashboardController {}

Object.setPrototypeOf(AdminDashboardController.prototype, BaseDashboardController.prototype);
Object.setPrototypeOf(CreatorDashboardController.prototype, BaseDashboardController.prototype);
Object.setPrototypeOf(FanDashboardController.prototype, BaseDashboardController.prototype);
Object.setPrototypeOf(VerificationController.prototype, BaseDashboardController.prototype);

// Export controller instances
export const adminDashboardController = new AdminDashboardController();
export const creatorDashboardController = new CreatorDashboardController();
export const fanDashboardController = new FanDashboardController();
export const verificationController = new VerificationController();