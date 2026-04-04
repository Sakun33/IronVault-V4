import { db } from '../services/database.service';

export interface AnalyticsRecord {
  record_id: number;
  customer_id?: number;
  metric: string;
  value: number;
  timestamp: Date;
  metadata?: any;
}

export interface CreateAnalyticsInput {
  customer_id?: number;
  metric: string;
  value: number;
  metadata?: any;
}

export interface AnalyticsFilters {
  customer_id?: number;
  metric?: string;
  start_date?: Date;
  end_date?: Date;
}

class AnalyticsRepository {
  async create(input: CreateAnalyticsInput): Promise<AnalyticsRecord> {
    const result = await db.query<AnalyticsRecord>(
      `INSERT INTO analytics (customer_id, metric, value, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.customer_id, input.metric, input.value, JSON.stringify(input.metadata || {})]
    );
    return result.rows[0];
  }

  async findByCustomer(customer_id: number, metric?: string): Promise<AnalyticsRecord[]> {
    let query = 'SELECT * FROM analytics WHERE customer_id = $1';
    const params: any[] = [customer_id];

    if (metric) {
      params.push(metric);
      query += ' AND metric = $2';
    }

    query += ' ORDER BY timestamp DESC LIMIT 100';

    const result = await db.query<AnalyticsRecord>(query, params);
    return result.rows;
  }

  async getMetricSum(metric: string, filters: AnalyticsFilters = {}): Promise<number> {
    let query = 'SELECT COALESCE(SUM(value), 0) as total FROM analytics WHERE metric = $1';
    const params: any[] = [metric];
    let paramCount = 2;

    if (filters.customer_id) {
      params.push(filters.customer_id);
      query += ` AND customer_id = $${paramCount++}`;
    }

    if (filters.start_date) {
      params.push(filters.start_date);
      query += ` AND timestamp >= $${paramCount++}`;
    }

    if (filters.end_date) {
      params.push(filters.end_date);
      query += ` AND timestamp <= $${paramCount++}`;
    }

    const result = await db.query(query, params);
    return parseFloat(result.rows[0].total);
  }

  async getMetricAverage(metric: string, filters: AnalyticsFilters = {}): Promise<number> {
    let query = 'SELECT COALESCE(AVG(value), 0) as average FROM analytics WHERE metric = $1';
    const params: any[] = [metric];
    let paramCount = 2;

    if (filters.customer_id) {
      params.push(filters.customer_id);
      query += ` AND customer_id = $${paramCount++}`;
    }

    if (filters.start_date) {
      params.push(filters.start_date);
      query += ` AND timestamp >= $${paramCount++}`;
    }

    if (filters.end_date) {
      params.push(filters.end_date);
      query += ` AND timestamp <= $${paramCount++}`;
    }

    const result = await db.query(query, params);
    return parseFloat(result.rows[0].average);
  }

  async getMetricsByTimeRange(
    metric: string,
    start_date: Date,
    end_date: Date
  ): Promise<{ date: string; value: number }[]> {
    const result = await db.query(
      `SELECT DATE(timestamp) as date, SUM(value) as value
       FROM analytics
       WHERE metric = $1 AND timestamp >= $2 AND timestamp <= $3
       GROUP BY DATE(timestamp)
       ORDER BY date ASC`,
      [metric, start_date, end_date]
    );
    return result.rows;
  }

  async getTopMetrics(limit: number = 10): Promise<{ metric: string; total: number }[]> {
    const result = await db.query(
      `SELECT metric, SUM(value) as total
       FROM analytics
       GROUP BY metric
       ORDER BY total DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}

export default new AnalyticsRepository();

