import express from 'express';
import ComplianceService from '../services/complianceService.js';
import authMiddleware from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();
const complianceService = new ComplianceService();

// Multi-jurisdiction tax calculation
router.post('/tax/calculate', [
  authMiddleware,
  body('jurisdiction').isIn(['US', 'CA', 'UK', 'EU', 'AU']),
  body('income').isNumeric(),
  body('expenses').optional().isNumeric(),
  body('taxYear').optional().isInt({ min: 2020, max: 2030 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.user;
    const { jurisdiction, income, expenses = 0, taxYear = new Date().getFullYear() } = req.body;

    const taxCalculation = await complianceService.calculateTax({
      userId,
      jurisdiction,
      income,
      expenses,
      taxYear
    });

    res.json({
      success: true,
      data: {
        calculation: taxCalculation,
        jurisdiction,
        taxYear,
        calculatedAt: new Date().toISOString(),
        breakdown: {
          grossIncome: income,
          deductibleExpenses: expenses,
          taxableIncome: taxCalculation.taxableIncome,
          totalTax: taxCalculation.totalTax,
          effectiveRate: taxCalculation.effectiveRate
        }
      }
    });
  } catch (error) {
    console.error('Tax calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate taxes'
    });
  }
});

// Generate compliance reports
router.post('/report/generate', [
  authMiddleware,
  body('reportType').isIn(['quarterly', 'annual', 'monthly', 'custom']),
  body('jurisdiction').isIn(['US', 'CA', 'UK', 'EU', 'AU']),
  body('period').matches(/^\d{4}-(Q[1-4]|\d{2}|annual)$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.user;
    const { reportType, jurisdiction, period, includeTransactions = true } = req.body;

    const report = await complianceService.generateReport({
      userId,
      reportType,
      jurisdiction,
      period,
      includeTransactions
    });

    res.json({
      success: true,
      data: {
        report,
        metadata: {
          reportId: report.id,
          generatedAt: report.generatedAt,
          jurisdiction,
          period,
          reportType,
          status: 'completed'
        }
      }
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate compliance report'
    });
  }
});

// Audit trail retrieval
router.get('/audit-trail', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { startDate, endDate, transactionType, page = 1, limit = 50 } = req.query;

    const auditTrail = await complianceService.getAuditTrail({
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      transactionType,
      pagination: { page: parseInt(page), limit: parseInt(limit) }
    });

    res.json({
      success: true,
      data: {
        auditTrail,
        pagination: {
          currentPage: parseInt(page),
          totalPages: auditTrail.totalPages,
          totalRecords: auditTrail.totalCount,
          hasMore: auditTrail.hasMore
        }
      }
    });
  } catch (error) {
    console.error('Audit trail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit trail'
    });
  }
});

// Submit tax filing
router.post('/filing/submit', [
  authMiddleware,
  body('jurisdiction').isIn(['US', 'CA', 'UK', 'EU', 'AU']),
  body('filingType').isIn(['quarterly', 'annual', 'monthly']),
  body('formData').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.user;
    const { jurisdiction, filingType, formData, attachments = [] } = req.body;

    const filing = await complianceService.submitFiling({
      userId,
      jurisdiction,
      filingType,
      formData,
      attachments
    });

    res.json({
      success: true,
      data: {
        filing,
        submissionId: filing.id,
        status: filing.status,
        confirmationNumber: filing.confirmationNumber,
        submittedAt: filing.submittedAt
      }
    });
  } catch (error) {
    console.error('Filing submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit tax filing'
    });
  }
});

// Get compliance status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const jurisdiction = req.query.jurisdiction;

    const status = await complianceService.getComplianceStatus(userId, jurisdiction);

    res.json({
      success: true,
      data: {
        status,
        checkDate: new Date().toISOString(),
        summary: {
          overallCompliance: status.overallScore,
          pendingActions: status.pendingActions,
          nextDeadline: status.nextDeadline,
          riskLevel: status.riskLevel
        }
      }
    });
  } catch (error) {
    console.error('Compliance status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get compliance status'
    });
  }
});

// Tax forms generation
router.post('/forms/generate', [
  authMiddleware,
  body('formType').isIn(['1099', '1040', 'T4A', 'T1', 'P60', 'P85']),
  body('taxYear').isInt({ min: 2020, max: 2030 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.user;
    const { formType, taxYear, includeSchedules = false } = req.body;

    const form = await complianceService.generateTaxForm({
      userId,
      formType,
      taxYear,
      includeSchedules
    });

    res.json({
      success: true,
      data: {
        form,
        formType,
        taxYear,
        generatedAt: new Date().toISOString(),
        downloadUrl: form.downloadUrl,
        expiresAt: form.expiresAt
      }
    });
  } catch (error) {
    console.error('Form generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tax form'
    });
  }
});

// Compliance alerts and notifications
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { severity, read, page = 1, limit = 20 } = req.query;

    const alerts = await complianceService.getComplianceAlerts({
      userId,
      severity,
      read: read !== undefined ? read === 'true' : undefined,
      pagination: { page: parseInt(page), limit: parseInt(limit) }
    });

    res.json({
      success: true,
      data: {
        alerts,
        summary: {
          total: alerts.totalCount,
          unread: alerts.unreadCount,
          critical: alerts.criticalCount,
          high: alerts.highCount
        }
      }
    });
  } catch (error) {
    console.error('Alerts retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve compliance alerts'
    });
  }
});

// Mark alert as read
router.patch('/alerts/:alertId/read', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { alertId } = req.params;

    await complianceService.markAlertAsRead(userId, alertId);

    res.json({
      success: true,
      message: 'Alert marked as read'
    });
  } catch (error) {
    console.error('Mark alert read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark alert as read'
    });
  }
});

// Get supported jurisdictions and their requirements
router.get('/jurisdictions', async (req, res) => {
  try {
    const jurisdictions = await complianceService.getSupportedJurisdictions();

    res.json({
      success: true,
      data: {
        jurisdictions,
        supported: jurisdictions.length,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Jurisdictions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get supported jurisdictions'
    });
  }
});

// Compliance dashboard data
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const period = req.query.period || '30d';

    const dashboardData = await complianceService.getDashboardData(userId, period);

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get compliance dashboard data'
    });
  }
});

export default router;