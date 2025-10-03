import { Pool } from 'pg';
import Redis from 'ioredis';
import { Logger } from 'winston';

export interface AnalyticsMetric {
  name: string;
  value: number;
  timestamp: Date;
  dimensions?: Record<string, string>;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  revenueByPlatform: Record<string, number>;
  revenueByMonth: Array<{ month: string; revenue: number }>;
  averageTransactionValue: number;
  conversionRate: number;
}

export interface CreatorAnalytics {
  totalCreators: number;
  activeCreators: number;
  newCreators: number;
  creatorRetentionRate: number;
  topEarningCreators: Array<{
    id: string;
    earnings: number;
    transactionCount: number;
  }>;
}

export interface FanAnalytics {
  totalFans: number;
  activeFans: number;
  newFans: number;
  fanRetentionRate: number;
  averageSpendingPerFan: number;
  fanLifetimeValue: number;
}

export interface PlatformAnalytics {
  boyfanz: PlatformMetrics;
  girlfanz: PlatformMetrics;
  pupfanz: PlatformMetrics;
  taboofanz: PlatformMetrics;
  transfanz: PlatformMetrics;
}

export interface PlatformMetrics {
  users: number;
  transactions: number;
  revenue: number;
  growthRate: number;
  averageTransactionValue: number;
}

export interface TrendAnalysis {
  metric: string;
  period: 'daily' | 'weekly' | 'monthly';
  trend: 'up' | 'down' | 'stable';
  changePercentage: number;
  forecast?: Array<{ period: string; value: number }>;
}

export class AnalyticsService {
  private db: Pool;
  private redis: Redis;
  private logger: Logger;

  constructor(db: Pool, redis: Redis, logger: Logger) {
    this.db = db;
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Get comprehensive revenue analytics
   */
  async getRevenueAnalytics(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<RevenueAnalytics> {
    try {
      const cacheKey = `revenue_analytics:${startDate.toISOString()}:${endDate.toISOString()}:${platforms?.join(',')}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const platformFilter = platforms ? `AND platform = ANY($3)` : '';
      const params = platforms ? [startDate, endDate, platforms] : [startDate, endDate];

      // Total Revenue
      const totalRevenueQuery = `
        SELECT SUM(amount::numeric) as total_revenue
        FROM transactions 
        WHERE created_at >= $1 AND created_at <= $2 
        AND status = 'completed' 
        AND type = 'payment'
        ${platformFilter}
      `;

      // Revenue by Platform
      const revenueByPlatformQuery = `
        SELECT platform, SUM(amount::numeric) as revenue
        FROM transactions 
        WHERE created_at >= $1 AND created_at <= $2 
        AND status = 'completed' 
        AND type = 'payment'
        ${platformFilter}
        GROUP BY platform
      `;

      // Revenue by Month
      const revenueByMonthQuery = `
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          SUM(amount::numeric) as revenue
        FROM transactions 
        WHERE created_at >= $1 AND created_at <= $2 
        AND status = 'completed' 
        AND type = 'payment'
        ${platformFilter}
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month
      `;

      // Average Transaction Value
      const avgTransactionQuery = `
        SELECT AVG(amount::numeric) as avg_value
        FROM transactions 
        WHERE created_at >= $1 AND created_at <= $2 
        AND status = 'completed' 
        AND type = 'payment'
        ${platformFilter}
      `;

      const [
        totalRevenue,
        revenueByPlatform,
        revenueByMonth,
        avgTransaction
      ] = await Promise.all([
        this.db.query(totalRevenueQuery, params),
        this.db.query(revenueByPlatformQuery, params),
        this.db.query(revenueByMonthQuery, params),
        this.db.query(avgTransactionQuery, params)
      ]);

      const analytics: RevenueAnalytics = {
        totalRevenue: parseFloat(totalRevenue.rows[0]?.total_revenue || '0'),
        revenueByPlatform: revenueByPlatform.rows.reduce((acc, row) => {
          acc[row.platform] = parseFloat(row.revenue);
          return acc;
        }, {}),
        revenueByMonth: revenueByMonth.rows.map(row => ({
          month: row.month,
          revenue: parseFloat(row.revenue)
        })),
        averageTransactionValue: parseFloat(avgTransaction.rows[0]?.avg_value || '0'),
        conversionRate: await this.calculateConversionRate(startDate, endDate, platforms)
      };

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(analytics));

      return analytics;
    } catch (error) {
      this.logger.error('Error getting revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Get creator analytics
   */
  async getCreatorAnalytics(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<CreatorAnalytics> {
    try {
      const platformFilter = platforms ? `AND u.platform = ANY($3)` : '';
      const params = platforms ? [startDate, endDate, platforms] : [startDate, endDate];

      // Total and Active Creators
      const creatorStatsQuery = `
        SELECT 
          COUNT(*) as total_creators,
          COUNT(CASE WHEN last_transaction_date >= $1 THEN 1 END) as active_creators,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_creators
        FROM users u
        WHERE role = 'creator'
        ${platformFilter}
      `;

      // Top Earning Creators
      const topCreatorsQuery = `
        SELECT 
          t.creator_id,
          SUM(t.amount::numeric) as earnings,
          COUNT(*) as transaction_count
        FROM transactions t
        JOIN users u ON t.creator_id = u.id
        WHERE t.created_at >= $1 AND t.created_at <= $2 
        AND t.status = 'completed' 
        AND t.type = 'payment'
        AND u.role = 'creator'
        ${platformFilter}
        GROUP BY t.creator_id
        ORDER BY earnings DESC
        LIMIT 10
      `;

      const [creatorStats, topCreators] = await Promise.all([
        this.db.query(creatorStatsQuery, params),
        this.db.query(topCreatorsQuery, params)
      ]);

      const stats = creatorStats.rows[0];
      const retentionRate = await this.calculateCreatorRetentionRate(startDate, endDate, platforms);

      return {
        totalCreators: parseInt(stats.total_creators),
        activeCreators: parseInt(stats.active_creators),
        newCreators: parseInt(stats.new_creators),
        creatorRetentionRate: retentionRate,
        topEarningCreators: topCreators.rows.map(row => ({
          id: row.creator_id,
          earnings: parseFloat(row.earnings),
          transactionCount: parseInt(row.transaction_count)
        }))
      };
    } catch (error) {
      this.logger.error('Error getting creator analytics:', error);
      throw error;
    }
  }

  /**
   * Get fan analytics
   */
  async getFanAnalytics(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<FanAnalytics> {
    try {
      const platformFilter = platforms ? `AND u.platform = ANY($3)` : '';
      const params = platforms ? [startDate, endDate, platforms] : [startDate, endDate];

      // Fan Statistics
      const fanStatsQuery = `
        SELECT 
          COUNT(*) as total_fans,
          COUNT(CASE WHEN last_transaction_date >= $1 THEN 1 END) as active_fans,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_fans,
          AVG(total_spent::numeric) as avg_spending
        FROM users u
        WHERE role = 'fan'
        ${platformFilter}
      `;

      const fanStats = await this.db.query(fanStatsQuery, params);
      const stats = fanStats.rows[0];

      const retentionRate = await this.calculateFanRetentionRate(startDate, endDate, platforms);
      const lifetimeValue = await this.calculateFanLifetimeValue(platforms);

      return {
        totalFans: parseInt(stats.total_fans),
        activeFans: parseInt(stats.active_fans),
        newFans: parseInt(stats.new_fans),
        fanRetentionRate: retentionRate,
        averageSpendingPerFan: parseFloat(stats.avg_spending || '0'),
        fanLifetimeValue: lifetimeValue
      };
    } catch (error) {
      this.logger.error('Error getting fan analytics:', error);
      throw error;
    }
  }

  /**
   * Get platform-specific analytics
   */
  async getPlatformAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<PlatformAnalytics> {
    try {
      const platforms = ['boyfanz', 'girlfanz', 'pupfanz', 'taboofanz', 'transfanz'];
      const analytics: PlatformAnalytics = {} as PlatformAnalytics;

      for (const platform of platforms) {
        const metrics = await this.getPlatformMetrics(platform, startDate, endDate);
        analytics[platform as keyof PlatformAnalytics] = metrics;
      }

      return analytics;
    } catch (error) {
      this.logger.error('Error getting platform analytics:', error);
      throw error;
    }
  }

  /**
   * Get trend analysis for specific metrics
   */
  async getTrendAnalysis(
    metric: string,
    period: 'daily' | 'weekly' | 'monthly',
    lookbackPeriods: number = 30
  ): Promise<TrendAnalysis> {
    try {
      const data = await this.getMetricHistory(metric, period, lookbackPeriods);
      const trend = this.analyzeTrend(data);
      const forecast = await this.generateForecast(data, 5);

      return {
        metric,
        period,
        trend: trend.direction,
        changePercentage: trend.changePercentage,
        forecast
      };
    } catch (error) {
      this.logger.error('Error getting trend analysis:', error);
      throw error;
    }
  }

  /**
   * Record custom analytics metric
   */
  async recordMetric(metric: AnalyticsMetric): Promise<void> {
    try {
      const query = `
        INSERT INTO analytics_metrics (name, value, timestamp, dimensions)
        VALUES ($1, $2, $3, $4)
      `;

      await this.db.query(query, [
        metric.name,
        metric.value,
        metric.timestamp,
        JSON.stringify(metric.dimensions || {})
      ]);

      // Update real-time metrics in Redis
      const redisKey = `metric:${metric.name}`;
      await this.redis.zadd(
        redisKey,
        metric.timestamp.getTime(),
        JSON.stringify({
          value: metric.value,
          dimensions: metric.dimensions
        })
      );

      // Keep only last 24 hours of real-time metrics
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      await this.redis.zremrangebyscore(redisKey, '-inf', oneDayAgo);

    } catch (error) {
      this.logger.error('Error recording metric:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics from Redis
   */
  async getRealTimeMetrics(metricNames: string[]): Promise<Record<string, any[]>> {
    try {
      const metrics: Record<string, any[]> = {};

      for (const metricName of metricNames) {
        const redisKey = `metric:${metricName}`;
        const data = await this.redis.zrange(redisKey, -100, -1, 'WITHSCORES');
        
        const values = [];
        for (let i = 0; i < data.length; i += 2) {
          values.push({
            ...JSON.parse(data[i]),
            timestamp: new Date(parseInt(data[i + 1]))
          });
        }
        
        metrics[metricName] = values;
      }

      return metrics;
    } catch (error) {
      this.logger.error('Error getting real-time metrics:', error);
      throw error;
    }
  }

  // Private helper methods
  private async calculateConversionRate(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<number> {
    const platformFilter = platforms ? `AND platform = ANY($3)` : '';
    const params = platforms ? [startDate, endDate, platforms] : [startDate, endDate];

    const query = `
      SELECT 
        COUNT(DISTINCT fan_id) as total_fans,
        COUNT(DISTINCT CASE WHEN status = 'completed' THEN fan_id END) as paying_fans
      FROM transactions 
      WHERE created_at >= $1 AND created_at <= $2 
      AND type = 'payment'
      ${platformFilter}
    `;

    const result = await this.db.query(query, params);
    const { total_fans, paying_fans } = result.rows[0];

    return total_fans > 0 ? (paying_fans / total_fans) * 100 : 0;
  }

  private async calculateCreatorRetentionRate(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<number> {
    // Implementation for creator retention calculation
    // This would track creators who were active in previous period and remain active
    return 85.5; // Placeholder
  }

  private async calculateFanRetentionRate(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<number> {
    // Implementation for fan retention calculation
    return 72.3; // Placeholder
  }

  private async calculateFanLifetimeValue(platforms?: string[]): Promise<number> {
    // Implementation for fan LTV calculation
    return 245.67; // Placeholder
  }

  private async getPlatformMetrics(
    platform: string,
    startDate: Date,
    endDate: Date
  ): Promise<PlatformMetrics> {
    const query = `
      SELECT 
        COUNT(DISTINCT u.id) as users,
        COUNT(t.id) as transactions,
        COALESCE(SUM(t.amount::numeric), 0) as revenue,
        AVG(t.amount::numeric) as avg_transaction_value
      FROM users u
      LEFT JOIN transactions t ON u.id = t.fan_id OR u.id = t.creator_id
      WHERE u.platform = $1
      AND (t.created_at IS NULL OR (t.created_at >= $2 AND t.created_at <= $3))
    `;

    const result = await this.db.query(query, [platform, startDate, endDate]);
    const row = result.rows[0];

    return {
      users: parseInt(row.users),
      transactions: parseInt(row.transactions),
      revenue: parseFloat(row.revenue),
      growthRate: await this.calculateGrowthRate(platform, startDate, endDate),
      averageTransactionValue: parseFloat(row.avg_transaction_value || '0')
    };
  }

  private async calculateGrowthRate(
    platform: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // Implementation for growth rate calculation
    return 15.2; // Placeholder
  }

  private async getMetricHistory(
    metric: string,
    period: 'daily' | 'weekly' | 'monthly',
    periods: number
  ): Promise<Array<{ period: string; value: number }>> {
    // Implementation for metric history retrieval
    return []; // Placeholder
  }

  private analyzeTrend(
    data: Array<{ period: string; value: number }>
  ): { direction: 'up' | 'down' | 'stable'; changePercentage: number } {
    if (data.length < 2) {
      return { direction: 'stable', changePercentage: 0 };
    }

    const latest = data[data.length - 1].value;
    const previous = data[data.length - 2].value;
    const changePercentage = ((latest - previous) / previous) * 100;

    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(changePercentage) > 5) {
      direction = changePercentage > 0 ? 'up' : 'down';
    }

    return { direction, changePercentage };
  }

  private async generateForecast(
    historicalData: Array<{ period: string; value: number }>,
    forecastPeriods: number
  ): Promise<Array<{ period: string; value: number }>> {
    // Simple linear regression forecast
    // In production, you might use more sophisticated ML models
    if (historicalData.length < 2) {
      return [];
    }

    const n = historicalData.length;
    const xSum = (n * (n + 1)) / 2;
    const ySum = historicalData.reduce((sum, item) => sum + item.value, 0);
    const xySum = historicalData.reduce((sum, item, index) => sum + item.value * (index + 1), 0);
    const x2Sum = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;

    const forecast = [];
    for (let i = 1; i <= forecastPeriods; i++) {
      const forecastValue = slope * (n + i) + intercept;
      forecast.push({
        period: `forecast_${i}`,
        value: Math.max(0, forecastValue) // Ensure non-negative values
      });
    }

    return forecast;
  }
}

export default AnalyticsService;