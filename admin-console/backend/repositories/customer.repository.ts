import { db } from '../services/database.service';

export interface Customer {
  id: number;
  email: string;
  name?: string;
  region?: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  last_active?: Date;
}

export interface CreateCustomerInput {
  email: string;
  name?: string;
  region?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  region?: string;
  status?: string;
}

export interface CustomerFilters {
  search?: string;
  status?: string;
  region?: string;
  page?: number;
  limit?: number;
}

class CustomerRepository {
  async findAll(filters: CustomerFilters = {}) {
    const {
      search = '',
      status = '',
      region = '',
      page = 1,
      limit = 50
    } = filters;

    let query = 'SELECT * FROM customers WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      query += ` AND (email ILIKE $${paramCount} OR name ILIKE $${paramCount + 1})`;
      paramCount += 2;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${paramCount}`;
      paramCount++;
    }

    if (region) {
      params.push(region);
      query += ` AND region = $${paramCount}`;
      paramCount++;
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM (${query}) as filtered`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;

    const result = await db.query<Customer>(query, params);

    return {
      customers: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async findById(id: number): Promise<Customer | null> {
    const result = await db.query<Customer>(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const result = await db.query<Customer>(
      'SELECT * FROM customers WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async create(input: CreateCustomerInput): Promise<Customer> {
    const result = await db.query<Customer>(
      `INSERT INTO customers (email, name, region, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [input.email, input.name, input.region]
    );
    return result.rows[0];
  }

  async update(id: number, input: UpdateCustomerInput): Promise<Customer | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      updates.push(`name = $${paramCount++}`);
    }

    if (input.region !== undefined) {
      params.push(input.region);
      updates.push(`region = $${paramCount++}`);
    }

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramCount++}`);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query<Customer>(
      `UPDATE customers SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM customers WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  async upsert(email: string, data: Partial<CreateCustomerInput>): Promise<Customer> {
    const result = await db.query<Customer>(
      `INSERT INTO customers (email, name, region, last_active, status)
       VALUES ($1, $2, $3, NOW(), 'active')
       ON CONFLICT (email)
       DO UPDATE SET last_active = NOW(), updated_at = NOW()
       RETURNING *`,
      [email, data.name || email, data.region]
    );
    return result.rows[0];
  }

  async updateLastActive(id: number): Promise<void> {
    await db.query(
      'UPDATE customers SET last_active = NOW() WHERE id = $1',
      [id]
    );
  }
}

export default new CustomerRepository();

