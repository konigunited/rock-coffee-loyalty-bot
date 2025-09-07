import Database from '../config/database';
import { User, CreateUserData, UpdateUserData, UserRole } from '../types/user.types';
import bcrypt from 'bcryptjs';

export class UserService {
  
  // Get user by Telegram ID
  async getByTelegramId(telegramId: number): Promise<User | null> {
    const sql = `
      SELECT id, telegram_id, username, full_name, role, is_active, created_at, updated_at
      FROM users
      WHERE telegram_id = $1 AND is_active = true
    `;
    
    return await Database.queryOne(sql, [telegramId]);
  }

  // Get user by ID
  async getById(userId: number): Promise<User | null> {
    const sql = `
      SELECT id, telegram_id, username, full_name, role, is_active, created_at, updated_at
      FROM users
      WHERE id = $1 AND is_active = true
    `;
    
    return await Database.queryOne(sql, [userId]);
  }

  // Create new user (admin only)
  async create(data: CreateUserData): Promise<number> {
    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : null;
    
    const sql = `
      INSERT INTO users (telegram_id, username, full_name, role, password_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const result = await Database.queryOne(sql, [
      data.telegram_id,
      data.username || null,
      data.full_name,
      data.role,
      hashedPassword
    ]);

    return result.id;
  }

  // Update user data
  async update(userId: number, data: UpdateUserData): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.username !== undefined) {
      fields.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }
    if (data.full_name !== undefined) {
      fields.push(`full_name = $${paramIndex++}`);
      values.push(data.full_name);
    }
    if (data.role !== undefined) {
      fields.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const sql = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
    `;
    
    await Database.query(sql, values);
  }

  // Check if user has required role
  hasRole(user: User, requiredRoles: UserRole[]): boolean {
    return requiredRoles.includes(user.role);
  }

  // Check if user can access barista features
  canAccessBarista(user: User): boolean {
    return ['barista', 'manager', 'admin'].includes(user.role);
  }

  // Check if user can access manager features
  canAccessManager(user: User): boolean {
    return ['manager', 'admin'].includes(user.role);
  }

  // Check if user is admin
  isAdmin(user: User): boolean {
    return user.role === 'admin';
  }

  // Get all staff members (manager/admin only)
  async getAllStaff(): Promise<User[]> {
    const sql = `
      SELECT id, telegram_id, username, full_name, role, is_active, created_at, updated_at
      FROM users
      WHERE role IN ('barista', 'manager', 'admin')
      ORDER BY role DESC, full_name ASC
    `;
    
    return await Database.query(sql);
  }

  // Get staff by role
  async getByRole(role: UserRole): Promise<User[]> {
    const sql = `
      SELECT id, telegram_id, username, full_name, role, is_active, created_at, updated_at
      FROM users
      WHERE role = $1 AND is_active = true
      ORDER BY full_name ASC
    `;
    
    return await Database.query(sql, [role]);
  }

  // Verify password for staff login
  async verifyPassword(userId: number, password: string): Promise<boolean> {
    const sql = `
      SELECT password_hash
      FROM users
      WHERE id = $1 AND is_active = true
    `;
    
    const user = await Database.queryOne(sql, [userId]);
    
    if (!user || !user.password_hash) {
      return false;
    }
    
    return await bcrypt.compare(password, user.password_hash);
  }

  // Update password
  async updatePassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const sql = `
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `;
    
    await Database.query(sql, [hashedPassword, userId]);
  }

  // Register new client through Telegram
  async registerClient(telegramId: number, username?: string, fullName?: string): Promise<User> {
    // Check if user already exists
    let user = await this.getByTelegramId(telegramId);
    
    if (user) {
      return user;
    }

    // Create new client user
    const userId = await this.create({
      telegram_id: telegramId,
      username: username,
      full_name: fullName || 'Client User',
      role: 'client'
    });

    const newUser = await this.getById(userId);
    if (!newUser) {
      throw new Error('Failed to create user');
    }

    return newUser;
  }

  // Deactivate user (soft delete)
  async deactivate(userId: number): Promise<void> {
    const sql = `
      UPDATE users 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `;
    
    await Database.query(sql, [userId]);
  }

  // Activate user
  async activate(userId: number): Promise<void> {
    const sql = `
      UPDATE users 
      SET is_active = true, updated_at = NOW()
      WHERE id = $1
    `;
    
    await Database.query(sql, [userId]);
  }

  // Check if telegram user is registered staff
  async isRegisteredStaff(telegramId: number): Promise<boolean> {
    const sql = `
      SELECT id
      FROM users
      WHERE telegram_id = $1 
        AND role IN ('barista', 'manager', 'admin') 
        AND is_active = true
    `;
    
    const user = await Database.queryOne(sql, [telegramId]);
    return !!user;
  }

  // Log user activity
  async logActivity(
    userId: number, 
    action: string, 
    targetType?: string, 
    targetId?: number, 
    details?: any,
    ipAddress?: string
  ): Promise<void> {
    const sql = `
      INSERT INTO activity_log (user_id, action, target_type, target_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await Database.query(sql, [
      userId,
      action,
      targetType || null,
      targetId || null,
      details ? JSON.stringify(details) : null,
      ipAddress || null
    ]);
  }

  // Get user activity log
  async getActivityLog(userId: number, limit: number = 50): Promise<any[]> {
    const sql = `
      SELECT *
      FROM activity_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    return await Database.query(sql, [userId, limit]);
  }

  // Get role hierarchy level (for permission checking)
  getRoleLevel(role: UserRole): number {
    const levels = {
      'client': 0,
      'barista': 1,
      'manager': 2,
      'admin': 3
    };
    return levels[role] || 0;
  }

  // Check if user can perform action on target user
  canManageUser(actorUser: User, targetUser: User): boolean {
    const actorLevel = this.getRoleLevel(actorUser.role);
    const targetLevel = this.getRoleLevel(targetUser.role);
    
    return actorLevel > targetLevel;
  }

  // Alias for getByRole (for compatibility with admin handler)
  async getUsersByRole(role: UserRole): Promise<User[]> {
    return await this.getByRole(role);
  }

  // Get user by telegram ID (alias for compatibility)
  async getUserById(telegramId: number): Promise<User | null> {
    return await this.getByTelegramId(telegramId);
  }

  // Add new user (for admin functions)
  async addUser(telegramId: number, username: string, fullName: string, role: UserRole, isActive: boolean = true): Promise<number> {
    const sql = `
      INSERT INTO users (telegram_id, username, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING id
    `;
    
    const result = await Database.queryOne(sql, [telegramId, username, fullName, role, isActive]);
    return result.id;
  }

  // Remove user (soft delete by telegram ID)
  async removeUser(telegramId: number): Promise<void> {
    const sql = `
      UPDATE users 
      SET is_active = false, updated_at = NOW()
      WHERE telegram_id = $1
    `;
    
    await Database.query(sql, [telegramId]);
  }
}