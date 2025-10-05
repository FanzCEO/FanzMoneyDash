import express from 'express';
import * as tf from '@tensorflow/tfjs-node';
import AnalyticsService from '../services/analyticsService.js';
import authMiddleware from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();
const analyticsService = new AnalyticsService();

// AI-powered financial insights
router.get('/insights', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const timeRange = req.query.range || '30d';
    
    const insights = await analyticsService.generateInsights(userId, timeRange);
    
    res.json({
      success: true,
      data: {
        insights,
        generatedAt: new Date().toISOString(),
        timeRange,
        aiModel: 'tensorflow-js',
        confidence: insights.confidence || 0.85
      }
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI insights'
    });
  }
});

// Revenue forecasting with machine learning
router.post('/forecast', [
  authMiddleware,
  body('period').isIn(['week', 'month', 'quarter', 'year']),
  body('dataPoints').optional().isInt({ min: 10, max: 1000 })
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
    const { period, dataPoints = 100, includeSeasonality = true } = req.body;
    
    const forecast = await analyticsService.generateRevenueForecast(userId, {
      period,
      dataPoints,
      includeSeasonality
    });
    
    res.json({
      success: true,
      data: {
        forecast,
        period,
        methodology: 'LSTM Neural Network',
        accuracy: forecast.accuracy,
        confidence: forecast.confidence,
        seasonalityDetected: forecast.seasonalityDetected
      }
    });
  } catch (error) {
    console.error('Error generating forecast:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate revenue forecast'
    });
  }
});

// Financial pattern recognition
router.get('/patterns', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const lookback = parseInt(req.query.lookback) || 90; // days
    
    const patterns = await analyticsService.detectPatterns(userId, lookback);
    
    res.json({
      success: true,
      data: {
        patterns,
        lookbackDays: lookback,
        detectedAt: new Date().toISOString(),
        algorithm: 'Pattern Recognition Neural Network'
      }
    });
  } catch (error) {
    console.error('Error detecting patterns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect financial patterns'
    });
  }
});

// Risk assessment using AI
router.post('/risk-assessment', [
  authMiddleware,
  body('assessmentType').isIn(['portfolio', 'transaction', 'market']),
  body('riskTolerance').optional().isIn(['conservative', 'moderate', 'aggressive'])
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
    const { assessmentType, riskTolerance = 'moderate' } = req.body;
    
    const riskAssessment = await analyticsService.assessRisk(userId, {
      type: assessmentType,
      tolerance: riskTolerance
    });
    
    res.json({
      success: true,
      data: {
        assessment: riskAssessment,
        riskScore: riskAssessment.score,
        riskLevel: riskAssessment.level,
        recommendations: riskAssessment.recommendations,
        factors: riskAssessment.factors
      }
    });
  } catch (error) {
    console.error('Error assessing risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assess financial risk'
    });
  }
});

// Performance metrics dashboard
router.get('/performance', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const period = req.query.period || '30d';
    
    const performance = await analyticsService.getPerformanceMetrics(userId, period);
    
    res.json({
      success: true,
      data: {
        metrics: performance,
        period,
        kpis: {
          totalRevenue: performance.totalRevenue,
          growthRate: performance.growthRate,
          profitMargin: performance.profitMargin,
          averageTransaction: performance.averageTransaction,
          customerLifetimeValue: performance.clv
        }
      }
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics'
    });
  }
});

// Comparative analysis with AI recommendations
router.post('/compare', [
  authMiddleware,
  body('compareWith').isIn(['industry', 'peers', 'historical']),
  body('metrics').isArray().optional()
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
    const { compareWith, metrics = ['revenue', 'growth', 'engagement'] } = req.body;
    
    const comparison = await analyticsService.generateComparison(userId, {
      compareWith,
      metrics
    });
    
    res.json({
      success: true,
      data: {
        comparison,
        recommendations: comparison.aiRecommendations,
        benchmarks: comparison.benchmarks,
        performanceGap: comparison.gaps
      }
    });
  } catch (error) {
    console.error('Error generating comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate comparative analysis'
    });
  }
});

// AI model health check
router.get('/model-status', authMiddleware, async (req, res) => {
  try {
    const modelStatus = await analyticsService.getModelStatus();
    
    res.json({
      success: true,
      data: {
        models: modelStatus,
        tensorflow: {
          version: tf.version.tfjs,
          backend: tf.getBackend(),
          memory: tf.memory()
        },
        lastTraining: modelStatus.lastTraining,
        accuracy: modelStatus.accuracy
      }
    });
  } catch (error) {
    console.error('Error checking model status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check AI model status'
    });
  }
});

export default router;