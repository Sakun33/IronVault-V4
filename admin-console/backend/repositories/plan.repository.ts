import { db } from '../services/database.service';

export interface Plan {
  plan_id: number;
  name: string;
  price: number;
  billing_cycle: string;
  features?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePlanInput {
  name: string;
  price: number;
  billing_cycle: string;
  features?: string;
}

export interface UpdatePlanInput {
  name?: string;
  price?: number;
  billing_cycle?: string;
  features?: string;
  is_active?: boolean;
}

class PlanRepository {
  async findAll(): Promise<Plan[]> {
    const result = await db.query<Plan>(
      'SELECT * FROM plans ORDER BY price ASC'
    );
    return result.rows;
  }

  async findActive(): Promise<Plan[]> {
    const result = await db.query<Plan>(
      'SELECT * FROM plans WHERE is_active = true ORDER BY price ASC'
    );
    return result.rows;
  }

  async findById(id: number): Promise<Plan | null> {
    const result = await db.query<Plan>(
      'SELECT * FROM plans WHERE plan_id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(input: CreatePlanInput): Promise<Plan> {
    const result = await db.query<Plan>(
      `INSERT INTO plans (name, price, billing_cycle, features)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.name, input.price, input.billing_cycle, input.features]
    );
    return result.rows[0];
  }

  async update(id: number, input: UpdatePlanInput): Promise<Plan | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      updates.push(`name = $${paramCount++}`);
    }

    if (input.price !== undefined) {
      params.push(input.price);
      updates.push(`price = $${paramCount++}`);
    }

    if (input.billing_cycle !== undefined) {
      params.push(input.billing_cycle);
      updates.push(`billing_cycle = $${paramCount++}`);
    }

    if (input.features !== undefined) {
      params.push(input.features);
      updates.push(`features = $${paramCount++}`);
    }

    if (input.is_active !== undefined) {
      params.push(input.is_active);
      updates.push(`is_active = $${paramCount++}`);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query<Plan>(
      `UPDATE plans SET ${updates.join(', ')} WHERE plan_id = $${paramCount} RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM plans WHERE plan_id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  async getCustomerCount(id: number): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM subscriptions
       WHERE plan_id = $1 AND status = 'active'`,
      [id]
    );
    return parseInt(result.rows[0].count);
  }
}

export default new PlanRepository();

