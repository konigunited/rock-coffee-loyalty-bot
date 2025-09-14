import Database from '../config/database';
import { User, CreateUserData, UpdateUserData, UserRole } from '../types/user.types';
import { UserService } from './user.service';

export class StaffService {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // Get staff performance statistics
  async getStaffPerformance(startDate?: Date, endDate?: Date): Promise<any[]> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate || new Date();

    const sql = `
      SELECT 
        u.id,
        u.full_name,
        u.role,
        COALESCE(stats.transactions_count, 0) as transactions_count,
        COALESCE(stats.clients_served, 0) as clients_served,
        COALESCE(stats.points_earned, 0) as points_earned,
        COALESCE(stats.points_spent, 0) as points_spent,
        COALESCE(stats.total_revenue, 0) as total_revenue
      FROM users u
      LEFT JOIN (
        SELECT 
          pt.operator_id,
          COUNT(*) as transactions_count,
          COUNT(DISTINCT pt.client_id) as clients_served,
          COALESCE(SUM(CASE WHEN pt.operation_type = 'earn' THEN pt.points ELSE 0 END), 0) as points_earned,
          COALESCE(SUM(CASE WHEN pt.operation_type = 'spend' THEN ABS(pt.points) ELSE 0 END), 0) as points_spent,
          COALESCE(SUM(CASE WHEN pt.operation_type = 'earn' THEN pt.amount ELSE 0 END), 0) as total_revenue
        FROM point_transactions pt
        WHERE pt.created_at >= $1 AND pt.created_at <= $2
          AND pt.operation_type IN ('earn', 'spend')
        GROUP BY pt.operator_id
      ) stats ON u.id = stats.operator_id
      WHERE u.role IN ('barista', 'manager') AND u.is_active = true
      ORDER BY stats.transactions_count DESC NULLS LAST
    `;

    return await Database.query(sql, [start, end]);
  }

  // Get daily activity for staff
  async getDailyActivity(date: Date): Promise<any[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sql = `
      SELECT 
        u.id,
        u.full_name,
        u.role,
        COUNT(pt.id) as transactions_today,
        COUNT(DISTINCT pt.client_id) as clients_served_today,
        SUM(CASE WHEN pt.operation_type = 'earn' THEN pt.points ELSE 0 END) as points_earned_today,
        SUM(CASE WHEN pt.operation_type = 'spend' THEN ABS(pt.points) ELSE 0 END) as points_spent_today,
        SUM(CASE WHEN pt.operation_type = 'earn' THEN pt.amount ELSE 0 END) as revenue_today
      FROM users u
      LEFT JOIN point_transactions pt ON u.id = pt.operator_id
        AND pt.created_at >= $1 AND pt.created_at <= $2
        AND pt.operation_type IN ('earn', 'spend')
      WHERE u.role IN ('barista', 'manager') AND u.is_active = true
      GROUP BY u.id, u.full_name, u.role
      ORDER BY transactions_today DESC
    `;

    return await Database.query(sql, [startOfDay, endOfDay]);
  }

  // Create new staff member
  async createStaffMember(data: CreateUserData, createdBy: number): Promise<number> {
    // Validate that only managers/admins can create staff
    const creator = await this.userService.getById(createdBy);
    if (!creator || !this.userService.canAccessManager(creator)) {
      throw new Error('Insufficient permissions to create staff member');
    }

    // Create the user
    const userId = await this.userService.create(data);

    // Log the creation
    await this.userService.logActivity(
      createdBy, 
      'create_staff', 
      'user', 
      userId, 
      { role: data.role, full_name: data.full_name }
    );

    return userId;
  }

  // Update staff member
  async updateStaffMember(staffId: number, data: UpdateUserData, updatedBy: number): Promise<void> {
    // Validate permissions
    const updater = await this.userService.getById(updatedBy);
    const staff = await this.userService.getById(staffId);

    if (!updater || !staff) {
      throw new Error('User not found');
    }

    if (!this.userService.canManageUser(updater, staff)) {
      throw new Error('Insufficient permissions to update this staff member');
    }

    // Extra safeguard: only admins can change roles of users. Prevent managers from changing roles.
    if (data.role !== undefined && updater.role !== 'admin') {
      throw new Error('Only administrators can change user roles');
    }

    await this.userService.update(staffId, data);

    // Log the update
    await this.userService.logActivity(
      updatedBy,
      'update_staff',
      'user',
      staffId,
      data
    );
  }

  // Deactivate staff member
  async deactivateStaffMember(staffId: number, deactivatedBy: number, reason?: string): Promise<void> {
    // Validate permissions
    const deactivator = await this.userService.getById(deactivatedBy);
    const staff = await this.userService.getById(staffId);

    if (!deactivator || !staff) {
      throw new Error('User not found');
    }

    // Additional rule: managers are allowed to deactivate only baristas (not other managers)
    if (deactivator.role === 'manager' && staff.role === 'manager') {
      throw new Error('Insufficient permissions to deactivate this staff member');
    }

    if (!this.userService.canManageUser(deactivator, staff)) {
      throw new Error('Insufficient permissions to deactivate this staff member');
    }

    await this.userService.deactivate(staffId);

    // Log the deactivation
    await this.userService.logActivity(
      deactivatedBy,
      'deactivate_staff',
      'user',
      staffId,
      { reason: reason || 'No reason provided' }
    );
  }

  // Get staff member details with performance
  async getStaffDetails(staffId: number): Promise<any> {
    const sql = `
      SELECT 
        u.*,
        COALESCE(stats.total_transactions, 0) as total_transactions,
        COALESCE(stats.total_clients_served, 0) as total_clients_served,
        COALESCE(stats.total_points_earned, 0) as total_points_earned,
        COALESCE(stats.total_revenue, 0) as total_revenue,
        COALESCE(stats.last_transaction_date, null) as last_transaction_date
      FROM users u
      LEFT JOIN (
        SELECT 
          pt.operator_id,
          COUNT(*) as total_transactions,
          COUNT(DISTINCT pt.client_id) as total_clients_served,
          SUM(CASE WHEN pt.operation_type = 'earn' THEN pt.points ELSE 0 END) as total_points_earned,
          SUM(CASE WHEN pt.operation_type = 'earn' THEN pt.amount ELSE 0 END) as total_revenue,
          MAX(pt.created_at) as last_transaction_date
        FROM point_transactions pt
        WHERE pt.operation_type IN ('earn', 'spend')
        GROUP BY pt.operator_id
      ) stats ON u.id = stats.operator_id
      WHERE u.id = $1 AND u.role IN ('barista', 'manager', 'admin')
    `;

    return await Database.queryOne(sql, [staffId]);
  }

  // Get staff working hours (basic implementation)
  async getWorkingHours(staffId: number, date: Date): Promise<any> {
    // This is a simple implementation based on transaction times
    // In a real system, you'd have a separate time tracking system
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sql = `
      SELECT 
        MIN(created_at) as first_transaction,
        MAX(created_at) as last_transaction,
        COUNT(*) as total_transactions
      FROM point_transactions
      WHERE operator_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND operation_type IN ('earn', 'spend')
    `;

    const result = await Database.queryOne(sql, [staffId, startOfDay, endOfDay]);

    if (!result.first_transaction) {
      return {
        worked: false,
        first_transaction: null,
        last_transaction: null,
        estimated_hours: 0,
        total_transactions: 0
      };
    }

    const firstTransaction = new Date(result.first_transaction);
    const lastTransaction = new Date(result.last_transaction);
    const timeDiff = lastTransaction.getTime() - firstTransaction.getTime();
    const estimatedHours = timeDiff / (1000 * 60 * 60); // Convert to hours

    return {
      worked: true,
      first_transaction: firstTransaction,
      last_transaction: lastTransaction,
      estimated_hours: Math.round(estimatedHours * 100) / 100, // Round to 2 decimal places
      total_transactions: parseInt(result.total_transactions)
    };
  }

  // Get top performing staff
  async getTopPerformers(period: 'week' | 'month' = 'month', limit: number = 5): Promise<any[]> {
    let startDate: Date;
    
    if (period === 'week') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const sql = `
      SELECT 
        u.id,
        u.full_name,
        u.role,
        COUNT(*) as transactions_count,
        COUNT(DISTINCT pt.client_id) as clients_served,
        SUM(CASE WHEN pt.operation_type = 'earn' THEN pt.amount ELSE 0 END) as total_revenue,
        ROUND(AVG(CASE WHEN pt.operation_type = 'earn' THEN pt.amount ELSE NULL END), 2) as avg_transaction_value
      FROM users u
      INNER JOIN point_transactions pt ON u.id = pt.operator_id
      WHERE u.role IN ('barista', 'manager') 
        AND u.is_active = true
        AND pt.created_at >= $1
        AND pt.operation_type IN ('earn', 'spend')
      GROUP BY u.id, u.full_name, u.role
      ORDER BY total_revenue DESC
      LIMIT $2
    `;

    return await Database.query(sql, [startDate, limit]);
  }

  // Generate staff report
  async generateStaffReport(startDate: Date, endDate: Date): Promise<any> {
    const performance = await this.getStaffPerformance(startDate, endDate);
    const topPerformers = await this.getTopPerformers('month', 10);

    // Calculate totals
    const totals = performance.reduce((acc, staff) => {
      acc.totalTransactions += parseInt(staff.transactions_count);
      acc.totalClientsServed += parseInt(staff.clients_served);
      acc.totalRevenue += parseFloat(staff.total_revenue);
      return acc;
    }, { totalTransactions: 0, totalClientsServed: 0, totalRevenue: 0 });

    return {
      period: {
        start: startDate,
        end: endDate
      },
      totals,
      staff_performance: performance,
      top_performers: topPerformers,
      active_staff_count: performance.filter(s => parseInt(s.transactions_count) > 0).length,
      total_staff_count: performance.length
    };
  }
}