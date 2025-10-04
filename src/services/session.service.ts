/**
 * Session Service
 *
 * Manages user sessions in PostgreSQL database instead of in-memory Map
 * Provides persistent session storage that survives server restarts
 */

import Database from '../config/database';

export interface SessionData {
  waitingFor?: string;
  clientId?: number;
  tempData?: any;
  [key: string]: any;
}

export class SessionService {
  private readonly SESSION_TTL_HOURS = 2; // Session expires after 2 hours of inactivity

  /**
   * Get session data for user
   */
  async get(userId: number): Promise<SessionData> {
    try {
      const sql = `
        SELECT data, expires_at
        FROM sessions
        WHERE user_id = $1 AND expires_at > NOW()
      `;

      const result = await Database.queryOne(sql, [userId]);

      if (!result) {
        // No session found or expired - return empty session
        return {};
      }

      // Extend session expiration on access
      await this.extendSession(userId);

      return result.data || {};

    } catch (error) {
      console.error('Error getting session:', error);
      return {};
    }
  }

  /**
   * Set session data for user
   */
  async set(userId: number, data: SessionData): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.SESSION_TTL_HOURS);

      const sql = `
        INSERT INTO sessions (user_id, data, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id)
        DO UPDATE SET
          data = $2,
          expires_at = $3,
          updated_at = NOW()
      `;

      await Database.query(sql, [userId, JSON.stringify(data), expiresAt]);

    } catch (error) {
      console.error('Error setting session:', error);
      throw error;
    }
  }

  /**
   * Update specific field in session
   */
  async update(userId: number, updates: Partial<SessionData>): Promise<void> {
    try {
      // Get current session
      const currentData = await this.get(userId);

      // Merge with updates
      const newData = { ...currentData, ...updates };

      // Save back
      await this.set(userId, newData);

    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  /**
   * Delete session for user
   */
  async delete(userId: number): Promise<void> {
    try {
      const sql = `DELETE FROM sessions WHERE user_id = $1`;
      await Database.query(sql, [userId]);

    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Clear specific session field
   */
  async clearField(userId: number, field: string): Promise<void> {
    try {
      const currentData = await this.get(userId);
      delete currentData[field];
      await this.set(userId, currentData);

    } catch (error) {
      console.error('Error clearing session field:', error);
      throw error;
    }
  }

  /**
   * Extend session expiration
   */
  private async extendSession(userId: number): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.SESSION_TTL_HOURS);

      const sql = `
        UPDATE sessions
        SET expires_at = $1, updated_at = NOW()
        WHERE user_id = $2
      `;

      await Database.query(sql, [expiresAt, userId]);

    } catch (error) {
      console.error('Error extending session:', error);
    }
  }

  /**
   * Cleanup expired sessions (should be called periodically)
   */
  async cleanupExpired(): Promise<number> {
    try {
      const sql = `
        DELETE FROM sessions
        WHERE expires_at < NOW()
        RETURNING id
      `;

      const deleted = await Database.query(sql);
      const count = deleted.length;

      if (count > 0) {
        console.log(`🧹 Cleaned up ${count} expired sessions`);
      }

      return count;

    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get all active sessions count
   */
  async getActiveCount(): Promise<number> {
    try {
      const sql = `
        SELECT COUNT(*) as count
        FROM sessions
        WHERE expires_at > NOW()
      `;

      const result = await Database.queryOne(sql);
      return parseInt(result.count) || 0;

    } catch (error) {
      console.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  /**
   * Check if session exists and is valid
   */
  async exists(userId: number): Promise<boolean> {
    try {
      const sql = `
        SELECT 1
        FROM sessions
        WHERE user_id = $1 AND expires_at > NOW()
        LIMIT 1
      `;

      const result = await Database.queryOne(sql, [userId]);
      return !!result;

    } catch (error) {
      console.error('Error checking session existence:', error);
      return false;
    }
  }
}
