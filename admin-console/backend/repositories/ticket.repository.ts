import { db } from '../services/database.service';

export interface Ticket {
  ticket_id: number;
  customer_id?: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assigned_to?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTicketInput {
  customer_id?: number;
  subject: string;
  description: string;
  priority?: string;
}

export interface UpdateTicketInput {
  subject?: string;
  description?: string;
  status?: string;
  priority?: string;
  assigned_to?: number;
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  assigned_to?: number;
  customer_id?: number;
  page?: number;
  limit?: number;
}

class TicketRepository {
  async findAll(filters: TicketFilters = {}) {
    const {
      status = '',
      priority = '',
      assigned_to,
      customer_id,
      page = 1,
      limit = 50
    } = filters;

    let query = `
      SELECT t.*, c.email as customer_email, c.name as customer_name,
             a.username as assigned_to_name
      FROM support_tickets t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN admins a ON t.assigned_to = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      params.push(status);
      query += ` AND t.status = $${paramCount++}`;
    }

    if (priority) {
      params.push(priority);
      query += ` AND t.priority = $${paramCount++}`;
    }

    if (assigned_to) {
      params.push(assigned_to);
      query += ` AND t.assigned_to = $${paramCount++}`;
    }

    if (customer_id) {
      params.push(customer_id);
      query += ` AND t.customer_id = $${paramCount++}`;
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
    query += ` ORDER BY t.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;

    const result = await db.query(query, params);

    return {
      tickets: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async findById(id: number): Promise<Ticket | null> {
    const result = await db.query(
      `SELECT t.*, c.email as customer_email, c.name as customer_name,
              a.username as assigned_to_name
       FROM support_tickets t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN admins a ON t.assigned_to = a.id
       WHERE t.ticket_id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async create(input: CreateTicketInput): Promise<Ticket> {
    const result = await db.query<Ticket>(
      `INSERT INTO support_tickets (customer_id, subject, description, priority)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.customer_id, input.subject, input.description, input.priority || 'medium']
    );
    return result.rows[0];
  }

  async update(id: number, input: UpdateTicketInput): Promise<Ticket | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (input.subject !== undefined) {
      params.push(input.subject);
      updates.push(`subject = $${paramCount++}`);
    }

    if (input.description !== undefined) {
      params.push(input.description);
      updates.push(`description = $${paramCount++}`);
    }

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramCount++}`);
    }

    if (input.priority !== undefined) {
      params.push(input.priority);
      updates.push(`priority = $${paramCount++}`);
    }

    if (input.assigned_to !== undefined) {
      params.push(input.assigned_to);
      updates.push(`assigned_to = $${paramCount++}`);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query<Ticket>(
      `UPDATE support_tickets SET ${updates.join(', ')} 
       WHERE ticket_id = $${paramCount} RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM support_tickets WHERE ticket_id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  async assign(id: number, admin_id: number): Promise<Ticket | null> {
    const result = await db.query<Ticket>(
      `UPDATE support_tickets 
       SET assigned_to = $1, updated_at = NOW()
       WHERE ticket_id = $2 
       RETURNING *`,
      [admin_id, id]
    );
    return result.rows[0] || null;
  }

  async close(id: number): Promise<Ticket | null> {
    const result = await db.query<Ticket>(
      `UPDATE support_tickets 
       SET status = 'closed', updated_at = NOW()
       WHERE ticket_id = $1 
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }
}

export default new TicketRepository();

