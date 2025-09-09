import Database from '../config/database';

export interface FavoriteClient {
  id: number;
  user_id: number;
  client_id: number;
  added_at: Date;
  client_name?: string;
  client_card?: string;
  client_balance?: number;
  last_visit?: Date;
}

export interface ClientComment {
  id: number;
  client_id: number;
  user_id: number;
  comment: string;
  created_at: Date;
  updated_at: Date;
  author_name?: string;
}

export class FavoritesService {
  
  // Initialize database tables
  async initializeTables(): Promise<void> {
    try {
      // Create favorites table
      await Database.query(`
        CREATE TABLE IF NOT EXISTS client_favorites (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, client_id)
        )
      `);

      // Create comments table  
      await Database.query(`
        CREATE TABLE IF NOT EXISTS client_comments (
          id SERIAL PRIMARY KEY,
          client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          comment TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for better performance
      await Database.query(`
        CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON client_favorites(user_id);
        CREATE INDEX IF NOT EXISTS idx_favorites_client_id ON client_favorites(client_id);
        CREATE INDEX IF NOT EXISTS idx_comments_client_id ON client_comments(client_id);
        CREATE INDEX IF NOT EXISTS idx_comments_user_id ON client_comments(user_id);
      `);

    } catch (error) {
      console.error('Error initializing favorites/comments tables:', error);
    }
  }

  // Add client to favorites
  async addToFavorites(userId: number, clientId: number): Promise<void> {
    await Database.query(`
      INSERT INTO client_favorites (user_id, client_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, client_id) DO NOTHING
    `, [userId, clientId]);
  }

  // Remove client from favorites
  async removeFromFavorites(userId: number, clientId: number): Promise<void> {
    await Database.query(`
      DELETE FROM client_favorites 
      WHERE user_id = $1 AND client_id = $2
    `, [userId, clientId]);
  }

  // Check if client is in favorites
  async isFavorite(userId: number, clientId: number): Promise<boolean> {
    const result = await Database.queryOne(`
      SELECT id FROM client_favorites 
      WHERE user_id = $1 AND client_id = $2
    `, [userId, clientId]);
    
    return !!result;
  }

  // Get user's favorite clients
  async getFavoriteClients(userId: number): Promise<FavoriteClient[]> {
    const favorites = await Database.query(`
      SELECT 
        cf.id,
        cf.user_id,
        cf.client_id,
        cf.added_at,
        c.full_name as client_name,
        c.card_number as client_card,
        c.balance as client_balance,
        c.last_visit
      FROM client_favorites cf
      JOIN clients c ON cf.client_id = c.id
      WHERE cf.user_id = $1 AND c.is_active = true
      ORDER BY cf.added_at DESC
    `, [userId]);

    return favorites;
  }

  // Add comment to client
  async addComment(clientId: number, userId: number, comment: string): Promise<number> {
    const result = await Database.queryOne(`
      INSERT INTO client_comments (client_id, user_id, comment)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [clientId, userId, comment]);

    return result.id;
  }

  // Update comment
  async updateComment(commentId: number, userId: number, comment: string): Promise<void> {
    await Database.query(`
      UPDATE client_comments 
      SET comment = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
    `, [comment, commentId, userId]);
  }

  // Delete comment
  async deleteComment(commentId: number, userId: number): Promise<void> {
    await Database.query(`
      DELETE FROM client_comments 
      WHERE id = $1 AND user_id = $2
    `, [commentId, userId]);
  }

  // Get comments for client
  async getClientComments(clientId: number): Promise<ClientComment[]> {
    const comments = await Database.query(`
      SELECT 
        cc.id,
        cc.client_id,
        cc.user_id,
        cc.comment,
        cc.created_at,
        cc.updated_at,
        u.full_name as author_name
      FROM client_comments cc
      JOIN users u ON cc.user_id = u.id
      WHERE cc.client_id = $1
      ORDER BY cc.created_at DESC
    `, [clientId]);

    return comments;
  }

  // Get recent comments by user
  async getUserRecentComments(userId: number, limit: number = 5): Promise<ClientComment[]> {
    const comments = await Database.query(`
      SELECT 
        cc.id,
        cc.client_id,
        cc.user_id,
        cc.comment,
        cc.created_at,
        cc.updated_at,
        c.full_name as client_name,
        c.card_number as client_card
      FROM client_comments cc
      JOIN clients c ON cc.client_id = c.id
      WHERE cc.user_id = $1
      ORDER BY cc.created_at DESC
      LIMIT $2
    `, [userId, limit]);

    return comments;
  }

  // Get favorites count for user
  async getFavoritesCount(userId: number): Promise<number> {
    const result = await Database.queryOne(`
      SELECT COUNT(*) as count 
      FROM client_favorites 
      WHERE user_id = $1
    `, [userId]);

    return parseInt(result?.count) || 0;
  }

  // Get comments count for client
  async getClientCommentsCount(clientId: number): Promise<number> {
    const result = await Database.queryOne(`
      SELECT COUNT(*) as count 
      FROM client_comments 
      WHERE client_id = $1
    `, [clientId]);

    return parseInt(result?.count) || 0;
  }
}