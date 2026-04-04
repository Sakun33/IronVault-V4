import { db } from './database.service';

/**
 * Analytics Service - KPI Calculations and Data Analysis
 */
class AnalyticsService {
  /**
   * Calculate Monthly Recurring Revenue (MRR)
   */
  async calculateMRR(): Promise<number> {
    try {
      const result = await db.query(`
        SELECT p.price, p.billing_cycle, COUNT(s.sub_id) as count
        FROM plans p
        LEFT JOIN subscriptions s ON p.plan_id = s.plan_id AND s.status = 'active'
        GROUP BY p.plan_id, p.price, p.billing_cycle
      `);

      let mrr = 0;
      result.rows.forEach(row => {
        const count = parseInt(row.count);
        const price = parseFloat(row.price);

        if (row.billing_cycle === 'monthly') {
          mrr += price * count;
        } else if (row.billing_cycle === 'yearly') {
          mrr += (price / 12) * count;
        }
        // Lifetime doesn't contribute to MRR
      });

      return parseFloat(mrr.toFixed(2));
    } catch (error) {
      console.error('MRR calculation error:', error);
      return 0;
    }
  }

  /**
   * Calculate Total Revenue
   */
  async calculateTotalRevenue(): Promise<number> {
    try {
      const result = await db.query(`
        SELECT p.price, p.billing_cycle, COUNT(s.sub_id) as count
        FROM plans p
        LEFT JOIN subscriptions s ON p.plan_id = s.plan_id
        GROUP BY p.plan_id, p.price, p.billing_cycle
      `);

      let totalRevenue = 0;
      result.rows.forEach(row => {
        const count = parseInt(row.count);
        const price = parseFloat(row.price);
        totalRevenue += price * count;
      });

      return parseFloat(totalRevenue.toFixed(2));
    } catch (error) {
      console.error('Total revenue calculation error:', error);
      return 0;
    }
  }

  /**
   * Calculate Churn Rate
   */
  async calculateChurnRate(): Promise<number> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active') as active_count,
          COUNT(*) FILTER (WHERE status = 'inactive') as inactive_count,
          COUNT(*) as total_count
        FROM customers
      `);

      const row = result.rows[0];
      const totalCount = parseInt(row.total_count);
      const inactiveCount = parseInt(row.inactive_count);

      if (totalCount === 0) return 0;

      const churnRate = (inactiveCount / totalCount) * 100;
      return parseFloat(churnRate.toFixed(2));
    } catch (error) {
      console.error('Churn rate calculation error:', error);
      return 0;
    }
  }

  /**
   * Get customer growth over time
   */
  async getCustomerGrowth(days: number = 30): Promise<{ date: string; count: number }[]> {
    try {
      const result = await db.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM customers
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

      return result.rows;
    } catch (error) {
      console.error('Customer growth error:', error);
      return [];
    }
  }

  /**
   * Get revenue by plan
   */
  async getRevenueByPlan(): Promise<{ plan: string; revenue: number; customer_count: number }[]> {
    try {
      const result = await db.query(`
        SELECT 
          p.name as plan,
          p.price * COUNT(s.sub_id) as revenue,
          COUNT(s.sub_id) as customer_count
        FROM plans p
        LEFT JOIN subscriptions s ON p.plan_id = s.plan_id AND s.status = 'active'
        GROUP BY p.plan_id, p.name, p.price
        ORDER BY revenue DESC
      `);

      return result.rows.map(row => ({
        plan: row.plan,
        revenue: parseFloat(row.revenue || 0),
        customer_count: parseInt(row.customer_count)
      }));
    } catch (error) {
      console.error('Revenue by plan error:', error);
      return [];
    }
  }

  /**
   * Get customer distribution by region
   */
  async getCustomersByRegion(): Promise<{ region: string; count: number }[]> {
    try {
      const result = await db.query(`
        SELECT region, COUNT(*) as count
        FROM customers
        WHERE region IS NOT NULL
        GROUP BY region
        ORDER BY count DESC
      `);

      return result.rows.map(row => ({
        region: row.region,
        count: parseInt(row.count)
      }));
    } catch (error) {
      console.error('Customers by region error:', error);
      return [];
    }
  }

  /**
   * Get plan distribution
   */
  async getPlanDistribution(): Promise<{ name: string; count: number; percentage: number }[]> {
    try {
      const result = await db.query(`
        SELECT p.name, COUNT(s.sub_id) as count
        FROM plans p
        LEFT JOIN subscriptions s ON p.plan_id = s.plan_id AND s.status = 'active'
        GROUP BY p.name
        ORDER BY count DESC
      `);

      const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

      return result.rows.map(row => {
        const count = parseInt(row.count);
        return {
          name: row.name,
          count,
          percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0
        };
      });
    } catch (error) {
      console.error('Plan distribution error:', error);
      return [];
    }
  }

  /**
   * Get active user stats
   */
  async getActiveUserStats(days: number = 7): Promise<{ date: string; users: number }[]> {
    try {
      const result = await db.query(`
        SELECT DATE(last_active) as date, COUNT(DISTINCT id) as users
        FROM customers
        WHERE last_active >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(last_active)
        ORDER BY date ASC
      `);

      return result.rows.map(row => ({
        date: row.date,
        users: parseInt(row.users)
      }));
    } catch (error) {
      console.error('Active users error:', error);
      return [];
    }
  }

  /**
   * Get top customers by value
   */
  async getTopCustomers(limit: number = 10): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          c.id, c.email, c.name, c.region, c.created_at,
          p.name as plan_name, p.price as plan_price
        FROM customers c
        LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
        LEFT JOIN plans p ON s.plan_id = p.plan_id
        WHERE p.price IS NOT NULL
        ORDER BY p.price DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      console.error('Top customers error:', error);
      return [];
    }
  }

  /**
   * Get retention rate
   */
  async getRetentionRate(days: number = 30): Promise<number> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE last_active >= NOW() - INTERVAL '${days} days') as active_last_period,
          COUNT(*) as total_customers
        FROM customers
        WHERE created_at < NOW() - INTERVAL '${days} days'
      `);

      const row = result.rows[0];
      const activeLastPeriod = parseInt(row.active_last_period);
      const totalCustomers = parseInt(row.total_customers);

      if (totalCustomers === 0) return 0;

      const retentionRate = (activeLastPeriod / totalCustomers) * 100;
      return parseFloat(retentionRate.toFixed(2));
    } catch (error) {
      console.error('Retention rate error:', error);
      return 0;
    }
  }

  /**
   * Get lifetime value (LTV) estimate
   */
  async getAverageLTV(): Promise<number> {
    try {
      const mrr = await this.calculateMRR();
      const churnRate = await this.calculateChurnRate();

      if (churnRate === 0) return 0;

      // Simple LTV calculation: MRR / Churn Rate
      const ltv = (mrr / (churnRate / 100));
      return parseFloat(ltv.toFixed(2));
    } catch (error) {
      console.error('LTV calculation error:', error);
      return 0;
    }
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 10): Promise<any[]> {
    try {
      // Get recent customers
      const recentCustomers = await db.query(`
        SELECT 'customer_signup' as type, email, name, created_at as timestamp
        FROM customers
        ORDER BY created_at DESC
        LIMIT $1
      `, [Math.floor(limit / 2)]);

      // Get recent subscriptions
      const recentSubscriptions = await db.query(`
        SELECT 'subscription_created' as type, c.email, c.name, s.start_date as timestamp, p.name as plan_name
        FROM subscriptions s
        JOIN customers c ON s.customer_id = c.id
        JOIN plans p ON s.plan_id = p.plan_id
        ORDER BY s.start_date DESC
        LIMIT $1
      `, [Math.floor(limit / 2)]);

      // Combine and sort
      const activities = [...recentCustomers.rows, ...recentSubscriptions.rows]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      return activities;
    } catch (error) {
      console.error('Recent activity error:', error);
      return [];
    }
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(): Promise<any> {
    try {
      const [
        customerStats,
        mrr,
        totalRevenue,
        churnRate,
        newSignups,
        planDistribution,
        customersByRegion,
        revenueByPlan,
        recentActivity
      ] = await Promise.all([
        db.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'active\') as active FROM customers'),
        this.calculateMRR(),
        this.calculateTotalRevenue(),
        this.calculateChurnRate(),
        db.query('SELECT COUNT(*) as count FROM customers WHERE created_at >= NOW() - INTERVAL \'24 hours\''),
        this.getPlanDistribution(),
        this.getCustomersByRegion(),
        this.getRevenueByPlan(),
        this.getRecentActivity()
      ]);

      const stats = customerStats.rows[0];

      return {
        totalCustomers: parseInt(stats.total),
        activeCustomers: parseInt(stats.active),
        mrr,
        totalRevenue,
        churnRate,
        newSignups: parseInt(newSignups.rows[0].count),
        planDistribution,
        customersByRegion,
        revenueByPlan,
        recentActivity
      };
    } catch (error) {
      console.error('Dashboard data error:', error);
      throw error;
    }
  }
}

export default new AnalyticsService();

