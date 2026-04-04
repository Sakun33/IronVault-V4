import { Pool, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Database Service - PostgreSQL Connection Pool Management
 * Provides a centralized database connection and query execution
 */
class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool;

  private constructor() {
    // Support DATABASE_URL (Replit) or individual env vars
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } else {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'securevault_admin',
        user: process.env.DB_USER || 'securevault_admin_user',
        password: process.env.DB_PASSWORD || 'changeme123',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    console.log('✓ Database connection pool initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Execute a query
   */
  public async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      if (process.env.NODE_ENV === 'development' && duration > 1000) {
        console.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
      }
      
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  public async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Test database connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('✓ Database connection test successful');
      return true;
    } catch (error) {
      console.error('✗ Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Close all connections
   */
  public async close(): Promise<void> {
    await this.pool.end();
    console.log('✓ Database connection pool closed');
  }

  /**
   * Get pool statistics
   */
  public getStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

export default DatabaseService;
export const db = DatabaseService.getInstance();

