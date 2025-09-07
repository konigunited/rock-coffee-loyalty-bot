// Point transaction types

export type PointTransactionType = 'earn' | 'spend' | 'adjust' | 'bonus';

export interface PointTransaction {
  id: number;
  client_id: number;
  operator_id: number;
  operation_type: PointTransactionType;
  points: number;
  amount?: number;
  description?: string;
  operator_name?: string;
  created_at: string;
}

export interface CreatePointTransactionData {
  client_id: number;
  operator_id: number;
  operation_type: PointTransactionType;
  points: number;
  amount?: number;
  description?: string;
}

export interface EarnPointsOperation {
  client_id: number;
  operator_id: number;
  points: number; // Direct points assignment (free system)
  amount?: number; // Optional amount for record keeping
  comment?: string;
}

export interface SpendPointsOperation {
  client_id: number;
  operator_id: number;
  points: number;
  comment?: string;
}

export interface PointsStatistics {
  total_earned: number;
  total_spent: number;
  transactions_count: number;
  clients_served: number;
}