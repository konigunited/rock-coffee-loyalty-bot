import Database from '../config/database';
import { BaristaClientView, ManagerClientView, CreateClientData, UpdateClientData, ClientSearchResult } from '../types/client.types';
import { UserRole } from '../types/user.types';
import { getDataAccessLevel } from '../config/permissions';

export class ClientService {
  
  // Search clients with role-based access control
  async search(query: string, userRole: UserRole): Promise<ClientSearchResult[]> {
    const accessLevel = getDataAccessLevel(userRole);
    
    if (accessLevel === 'none') {
      throw new Error('Access denied');
    }

    let sql: string;
    
    if (accessLevel === 'limited') {
      // Barista: search by card number, name, or phone but return limited data
      sql = `
        SELECT id, card_number, full_name, balance
        FROM barista_client_view 
        WHERE 
          card_number ILIKE $1 OR 
          full_name ILIKE $2
        ORDER BY full_name
        LIMIT 10
      `;
    } else {
      // Manager/Admin: full search capability
      sql = `
        SELECT id, card_number, full_name, balance
        FROM manager_client_view 
        WHERE 
          card_number ILIKE $1 OR 
          full_name ILIKE $2 OR
          phone ILIKE $1
        ORDER BY full_name
        LIMIT 10
      `;
    }
    
    return await Database.query(sql, [`%${query}%`, `%${query}%`]);
  }

  // Get client data with strict role-based access
  async getById(clientId: number, userRole: UserRole): Promise<BaristaClientView | ManagerClientView | null> {
    const accessLevel = getDataAccessLevel(userRole);
    
    if (accessLevel === 'none') {
      throw new Error('Access denied');
    }

    let sql: string;
    
    if (accessLevel === 'limited') {
      // Barista: limited data only
      sql = `
        SELECT id, card_number, full_name, balance, notes, last_visit, visit_count, is_active
        FROM barista_client_view 
        WHERE id = $1
      `;
    } else {
      // Manager/Admin: full data access
      sql = `
        SELECT *
        FROM manager_client_view 
        WHERE id = $1
      `;
    }
    
    return await Database.queryOne(sql, [clientId]);
  }

  // Barista-specific method for limited data access
  async getForBarista(clientId: number): Promise<BaristaClientView | null> {
    const sql = `
      SELECT id, card_number, full_name, balance, notes, last_visit, visit_count, is_active
      FROM barista_client_view 
      WHERE id = $1
    `;
    
    return await Database.queryOne(sql, [clientId]);
  }

  // Manager-specific method for full data access
  async getForManager(clientId: number): Promise<ManagerClientView | null> {
    const sql = `
      SELECT *
      FROM manager_client_view 
      WHERE id = $1
    `;
    
    return await Database.queryOne(sql, [clientId]);
  }

  // Search for barista (limited data)
  async searchForBarista(query: string): Promise<BaristaClientView[]> {
    const sql = `
      SELECT id, card_number, full_name, balance, notes, last_visit, visit_count, is_active
      FROM barista_client_view 
      WHERE 
        card_number ILIKE $1 OR 
        full_name ILIKE $2
      ORDER BY full_name
      LIMIT 10
    `;
    
    return await Database.query(sql, [`%${query}%`, `%${query}%`]);
  }

  // Create new client (manager/admin only)
  async create(data: CreateClientData, operatorId: number): Promise<number> {
    const sql = `
      INSERT INTO clients (
        telegram_id, card_number, full_name, phone, birth_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    
    // Convert birth_date format if needed
    let processedBirthDate = data.birth_date;
    if (data.birth_date) {
      // Convert DD.MM.YYYY to YYYY-MM-DD
      const [day, month, year] = data.birth_date.split('.');
      processedBirthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    const result = await Database.queryOne(sql, [
      data.telegram_id || null,
      data.card_number,
      data.full_name,
      data.phone || null,
      processedBirthDate || null,
      data.notes || null
    ]);

    // Log the creation (only if operator exists - not for self-registration)
    if (operatorId > 0) {
      await this.logAction(operatorId, 'create_client', result.id);
    }
    
    return result.id;
  }

  // Update client notes (accessible to barista)
  async updateNotes(clientId: number, notes: string, operatorId: number): Promise<void> {
    const sql = `
      UPDATE clients 
      SET notes = $1, updated_at = NOW() 
      WHERE id = $2 AND is_active = true
    `;
    
    await Database.query(sql, [notes, clientId]);
    
    // Log the action (only if operator exists)
    if (operatorId > 0) {
      await this.logAction(operatorId, 'update_notes', clientId, { notes });
    }
  }

  // Update full client data (manager/admin only)
  async updateFull(clientId: number, data: UpdateClientData, operatorId: number): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.full_name !== undefined) {
      fields.push(`full_name = $${paramIndex++}`);
      values.push(data.full_name);
    }
    if (data.phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(data.phone);
    }
    if (data.birth_date !== undefined) {
      fields.push(`birth_date = $${paramIndex++}`);
      values.push(data.birth_date);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push(`updated_at = NOW()`);
    values.push(clientId);

    const sql = `
      UPDATE clients 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} AND is_active = true
    `;
    
    await Database.query(sql, values);
    
    // Log the action (only if operator exists)
    if (operatorId > 0) {
      await this.logAction(operatorId, 'update_client', clientId, data);
    }
  }

  // Get client by card number
  async getByCardNumber(cardNumber: string): Promise<BaristaClientView | null> {
    const sql = `
      SELECT id, card_number, full_name, balance, notes, last_visit, visit_count, is_active
      FROM barista_client_view 
      WHERE card_number = $1
    `;
    
    return await Database.queryOne(sql, [cardNumber]);
  }

  // Get client by telegram ID
  async getByTelegramId(telegramId: number): Promise<BaristaClientView | null> {
    const sql = `
      SELECT id, card_number, full_name, balance, notes, last_visit, visit_count, is_active, phone, birth_date, total_spent, created_at
      FROM clients
      WHERE telegram_id = $1 AND is_active = true
    `;
    
    return await Database.queryOne(sql, [telegramId]);
  }

  // Get client by phone number
  async getByPhone(phone: string): Promise<BaristaClientView | null> {
    const sql = `
      SELECT id, card_number, full_name, balance, notes, last_visit, visit_count, is_active, phone, birth_date, total_spent, created_at
      FROM clients
      WHERE phone = $1 AND is_active = true
    `;
    
    return await Database.queryOne(sql, [phone]);
  }

  // Update specific client field
  async updateClientField(clientId: number, field: string, value: string | null): Promise<void> {
    const allowedFields = ['full_name', 'phone', 'birth_date'];
    
    if (!allowedFields.includes(field)) {
      throw new Error(`Field '${field}' is not allowed for update`);
    }

    const sql = `
      UPDATE clients 
      SET ${field} = $1, updated_at = NOW() 
      WHERE id = $2 AND is_active = true
    `;
    
    // Convert birth_date format if needed
    let processedValue = value;
    if (field === 'birth_date' && value) {
      // Convert DD.MM.YYYY to YYYY-MM-DD
      const [day, month, year] = value.split('.');
      processedValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    await Database.query(sql, [processedValue, clientId]);
  }

  // Generate unique card number
  async generateCardNumber(): Promise<string> {
    let cardNumber: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 100;
    
    while (!isUnique && attempts < maxAttempts) {
      cardNumber = Math.floor(10000 + Math.random() * 90000).toString();
      const existing = await this.getByCardNumber(cardNumber);
      isUnique = !existing;
      attempts++;
    }
    
    if (!isUnique) {
      throw new Error('Unable to generate unique card number after maximum attempts');
    }
    
    return cardNumber!;
  }

  // Log actions for audit trail
  private async logAction(userId: number, action: string, targetId?: number, details?: any): Promise<void> {
    const sql = `
      INSERT INTO activity_log (user_id, action, target_type, target_id, details)
      VALUES ($1, $2, 'client', $3, $4)
    `;
    
    await Database.query(sql, [userId, action, targetId, JSON.stringify(details || {})]);
  }

  // Get clients with birthdays soon (manager/admin only)
  async getBirthdayClients(): Promise<ManagerClientView[]> {
    const sql = `
      SELECT *
      FROM manager_client_view 
      WHERE is_birthday_soon = true
      ORDER BY birth_date
    `;
    
    return await Database.query(sql);
  }

  // Deactivate client (soft delete)
  async deactivate(clientId: number, operatorId: number): Promise<void> {
    const sql = `
      UPDATE clients 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `;
    
    await Database.query(sql, [clientId]);
    
    // Log the action (only if operator exists)
    if (operatorId > 0) {
      await this.logAction(operatorId, 'deactivate_client', clientId);
    }
  }
}