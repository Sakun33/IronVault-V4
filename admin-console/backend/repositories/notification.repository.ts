import { db } from '../services/database.service';

export interface Notification {
  notif_id: number;
  title: string;
  message: string;
  type: string;
  target_group?: string;
  target_criteria?: any;
  schedule_at?: Date;
  sent_at?: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNotificationInput {
  title: string;
  message: string;
  type: string;
  target_group?: string;
  target_criteria?: any;
  schedule_at?: Date;
}

export interface UpdateNotificationInput {
  title?: string;
  message?: string;
  type?: string;
  target_group?: string;
  target_criteria?: any;
  schedule_at?: Date;
  status?: string;
}

class NotificationRepository {
  async findAll(status?: string) {
    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params: any[] = [];

    if (status) {
      params.push(status);
      query += ` AND status = $1`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query<Notification>(query, params);
    return result.rows;
  }

  async findById(id: number): Promise<Notification | null> {
    const result = await db.query<Notification>(
      'SELECT * FROM notifications WHERE notif_id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const status = input.schedule_at ? 'scheduled' : 'draft';
    
    const result = await db.query<Notification>(
      `INSERT INTO notifications (title, message, type, target_group, target_criteria, schedule_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.title,
        input.message,
        input.type,
        input.target_group,
        JSON.stringify(input.target_criteria || {}),
        input.schedule_at,
        status
      ]
    );
    return result.rows[0];
  }

  async update(id: number, input: UpdateNotificationInput): Promise<Notification | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (input.title !== undefined) {
      params.push(input.title);
      updates.push(`title = $${paramCount++}`);
    }

    if (input.message !== undefined) {
      params.push(input.message);
      updates.push(`message = $${paramCount++}`);
    }

    if (input.type !== undefined) {
      params.push(input.type);
      updates.push(`type = $${paramCount++}`);
    }

    if (input.target_group !== undefined) {
      params.push(input.target_group);
      updates.push(`target_group = $${paramCount++}`);
    }

    if (input.target_criteria !== undefined) {
      params.push(JSON.stringify(input.target_criteria));
      updates.push(`target_criteria = $${paramCount++}`);
    }

    if (input.schedule_at !== undefined) {
      params.push(input.schedule_at);
      updates.push(`schedule_at = $${paramCount++}`);
    }

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramCount++}`);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query<Notification>(
      `UPDATE notifications SET ${updates.join(', ')} 
       WHERE notif_id = $${paramCount} RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM notifications WHERE notif_id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  async markAsSent(id: number): Promise<Notification | null> {
    const result = await db.query<Notification>(
      `UPDATE notifications 
       SET status = 'sent', sent_at = NOW(), updated_at = NOW()
       WHERE notif_id = $1 
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findScheduled(): Promise<Notification[]> {
    const result = await db.query<Notification>(
      `SELECT * FROM notifications
       WHERE status = 'scheduled' AND schedule_at <= NOW()
       ORDER BY schedule_at ASC`
    );
    return result.rows;
  }
}

export default new NotificationRepository();

