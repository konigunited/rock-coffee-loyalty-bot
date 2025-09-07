import Database from '../config/database';
import { 
  PointTransaction, 
  CreatePointTransactionData, 
  EarnPointsOperation, 
  SpendPointsOperation,
  PointsStatistics
} from '../types/point.types';
import { ClientService } from './client.service';

export class PointService {
  private clientService: ClientService;

  constructor() {
    this.clientService = new ClientService();
  }

  // Earn points for purchase
  async earnPoints(operation: EarnPointsOperation): Promise<PointTransaction> {
    // Use direct points assignment (free points system)
    let pointsToEarn: number;
    
    if (operation.points && operation.points > 0) {
      // Direct points assignment (free system)
      pointsToEarn = operation.points;
    } else {
      throw new Error('Points must be provided and positive');
    }
    
    if (pointsToEarn <= 0) {
      throw new Error('Points to earn must be positive');
    }

    return await Database.transaction(async (client) => {
      // 1. Create point transaction record
      const transactionSql = `
        INSERT INTO point_transactions (client_id, operator_id, operation_type, points, amount, description)
        VALUES ($1, $2, 'earn', $3, $4, $5)
        RETURNING *
      `;
      
      const transactionResult = await client.query(transactionSql, [
        operation.client_id,
        operation.operator_id,
        pointsToEarn,
        operation.amount || 0,
        operation.comment || `Начислено ${pointsToEarn} баллов`
      ]);

      // Manually update client balance and visit count
      const updateClientSql = `
        UPDATE clients 
        SET balance = balance + $1, 
            visit_count = visit_count + 1,
            last_visit = NOW(),
            updated_at = NOW()
        WHERE id = $2
      `;
      await client.query(updateClientSql, [pointsToEarn, operation.client_id]);
      
      return transactionResult.rows[0];
    });
  }

  // Spend points for discount
  async spendPoints(operation: SpendPointsOperation): Promise<PointTransaction> {
    // Check if client has enough points
    const client = await this.clientService.getForBarista(operation.client_id);
    
    if (!client) {
      throw new Error('Client not found');
    }
    
    if (client.balance < operation.points) {
      throw new Error(`Insufficient points. Available: ${client.balance}, requested: ${operation.points}`);
    }

    return await Database.transaction(async (client) => {
      // 1. Create point transaction record (negative points for spending)
      const transactionSql = `
        INSERT INTO point_transactions (client_id, operator_id, operation_type, points, description)
        VALUES ($1, $2, 'spend', $3, $4)
        RETURNING *
      `;
      
      const transactionResult = await client.query(transactionSql, [
        operation.client_id,
        operation.operator_id,
        -operation.points, // Negative value for spending
        operation.comment || `Списано ${operation.points} баллов`
      ]);

      // Manually update client balance and visit count
      const updateClientSql = `
        UPDATE clients 
        SET balance = balance - $1,
            visit_count = visit_count + 1,
            last_visit = NOW(),
            updated_at = NOW()
        WHERE id = $2
      `;
      await client.query(updateClientSql, [operation.points, operation.client_id]);
      
      return transactionResult.rows[0];
    });
  }

  // Manual points adjustment (admin/manager only)
  async adjustPoints(
    clientId: number, 
    operatorId: number, 
    pointsDelta: number, 
    comment: string
  ): Promise<PointTransaction> {
    const transactionSql = `
      INSERT INTO point_transactions (client_id, operator_id, operation_type, points, description)
      VALUES ($1, $2, 'adjust', $3, $4)
      RETURNING *
    `;
    
    const result = await Database.transaction(async (client) => {
      const transactionResult = await client.query(transactionSql, [
        clientId,
        operatorId,
        pointsDelta,
        comment
      ]);

      // Manually update client balance
      const updateClientSql = `
        UPDATE clients 
        SET balance = balance + $1,
            updated_at = NOW()
        WHERE id = $2
      `;
      await client.query(updateClientSql, [pointsDelta, clientId]);

      return transactionResult.rows[0];
    });

    return result;
  }

  // Give bonus points (admin/manager only)
  async giveBonusPoints(
    clientId: number, 
    operatorId: number, 
    points: number, 
    comment: string
  ): Promise<PointTransaction> {
    const transactionSql = `
      INSERT INTO point_transactions (client_id, operator_id, operation_type, points, description)
      VALUES ($1, $2, 'bonus', $3, $4)
      RETURNING *
    `;
    
    const result = await Database.transaction(async (client) => {
      const transactionResult = await client.query(transactionSql, [
        clientId,
        operatorId,
        points,
        comment
      ]);

      // Manually update client balance
      const updateClientSql = `
        UPDATE clients 
        SET balance = balance + $1,
            updated_at = NOW()
        WHERE id = $2
      `;
      await client.query(updateClientSql, [points, clientId]);

      return transactionResult.rows[0];
    });

    return result;
  }

  // Get client's transaction history
  async getClientTransactions(
    clientId: number, 
    limit: number = 50
  ): Promise<PointTransaction[]> {
    const sql = `
      SELECT 
        pt.*,
        u.full_name as operator_name
      FROM point_transactions pt
      JOIN users u ON pt.operator_id = u.id
      WHERE pt.client_id = $1
      ORDER BY pt.created_at DESC
      LIMIT $2
    `;
    
    return await Database.query(sql, [clientId, limit]);
  }

  // Get barista's statistics for a date range
  async getBaristaStats(
    operatorId: number, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<PointsStatistics> {
    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate || new Date(new Date().setHours(23, 59, 59, 999));

    const sql = `
      SELECT 
        COALESCE(SUM(CASE WHEN operation_type = 'earn' THEN points ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN operation_type = 'spend' THEN ABS(points) ELSE 0 END), 0) as total_spent,
        COUNT(*) as transactions_count,
        COUNT(DISTINCT client_id) as clients_served
      FROM point_transactions
      WHERE operator_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND operation_type IN ('earn', 'spend')
    `;
    
    const result = await Database.queryOne(sql, [operatorId, start, end]);
    
    return {
      total_earned: parseInt(result.total_earned) || 0,
      total_spent: parseInt(result.total_spent) || 0,
      transactions_count: parseInt(result.transactions_count) || 0,
      clients_served: parseInt(result.clients_served) || 0
    };
  }

  // Get recent transactions for barista view
  async getRecentTransactions(
    operatorId: number, 
    limit: number = 20
  ): Promise<any[]> {
    const sql = `
      SELECT 
        pt.*,
        c.card_number,
        c.full_name as client_name
      FROM point_transactions pt
      JOIN clients c ON pt.client_id = c.id
      WHERE pt.operator_id = $1
      ORDER BY pt.created_at DESC
      LIMIT $2
    `;
    
    return await Database.query(sql, [operatorId, limit]);
  }

  // Calculate points for purchase amount (not used in free system)
  calculateEarnPoints(amount: number): number {
    return 0; // Free system - no automatic calculation
  }

  // Calculate discount amount from points (not used in free system) 
  calculateDiscountAmount(points: number): number {
    return 0; // Free system - no automatic discount calculation
  }

  // Get total statistics for manager/admin
  async getTotalStats(startDate?: Date, endDate?: Date): Promise<any> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate || new Date();

    const sql = `
      SELECT 
        COALESCE(SUM(CASE WHEN operation_type = 'earn' THEN points ELSE 0 END), 0) as total_points_earned,
        COALESCE(SUM(CASE WHEN operation_type = 'spend' THEN ABS(points) ELSE 0 END), 0) as total_points_spent,
        COALESCE(SUM(CASE WHEN operation_type = 'earn' THEN amount ELSE 0 END), 0) as total_revenue,
        COUNT(*) as total_transactions,
        COUNT(DISTINCT client_id) as unique_clients,
        COUNT(DISTINCT operator_id) as active_operators
      FROM point_transactions
      WHERE created_at >= $1 
        AND created_at <= $2
        AND operation_type IN ('earn', 'spend')
    `;
    
    return await Database.queryOne(sql, [start, end]);
  }

  // Validate transaction before processing
  private async validateTransaction(data: CreatePointTransactionData): Promise<void> {
    // Check if client exists and is active
    const client = await this.clientService.getForBarista(data.client_id);
    if (!client) {
      throw new Error('Client not found or inactive');
    }

    // For spending, check sufficient balance
    if (data.operation_type === 'spend' && Math.abs(data.points) > client.balance) {
      throw new Error('Insufficient points balance');
    }

    // Validate points amount
    if (data.points === 0) {
      throw new Error('Points amount cannot be zero');
    }

    // No validation needed for amount in free system
  }
}