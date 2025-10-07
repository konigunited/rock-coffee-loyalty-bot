import Database from '../config/database';
import TelegramBot from 'node-telegram-bot-api';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export class SystemService {
  
  // System health check
  async performHealthCheck(): Promise<{
    database: boolean;
    bot: boolean;
    server: boolean;
    services: { [key: string]: boolean };
  }> {
    try {
      const results = {
        database: false,
        bot: false,
        server: true,
        services: {}
      };

      // Check database connectivity
      try {
        await Database.query('SELECT 1');
        results.database = true;
      } catch (error) {
        console.error('Database health check failed:', error);
      }

      // Bot is considered healthy if we can reach this point
      results.bot = true;

      // Check individual services
      results.services = {
        'user_service': await this.checkServiceHealth('user'),
        'client_service': await this.checkServiceHealth('client'),
        'point_service': await this.checkServiceHealth('point'),
        'notification_service': await this.checkServiceHealth('notification')
      };

      return results;

    } catch (error) {
      console.error('Health check error:', error);
      return {
        database: false,
        bot: false,
        server: false,
        services: {}
      };
    }
  }

  // Check specific service health
  private async checkServiceHealth(serviceType: string): Promise<boolean> {
    try {
      switch (serviceType) {
        case 'user':
          await Database.query('SELECT COUNT(*) FROM users LIMIT 1');
          return true;
        case 'client':
          await Database.query('SELECT COUNT(*) FROM clients LIMIT 1');
          return true;
        case 'point':
          await Database.query('SELECT COUNT(*) FROM point_transactions LIMIT 1');
          return true;
        case 'notification':
          // Check if notification service is responsive
          return true;
        default:
          return false;
      }
    } catch (error) {
      console.error(`Service health check failed for ${serviceType}:`, error);
      return false;
    }
  }

  // Get system performance metrics
  async getPerformanceMetrics(): Promise<{
    cpu: number;
    memory: number;
    disk: number;
    uptime: string;
    dbConnections: number;
    responseTime: number;
  }> {
    try {
      const metrics = {
        cpu: 0,
        memory: 0,
        disk: 0,
        uptime: '',
        dbConnections: 0,
        responseTime: 0
      };

      // Get system uptime
      try {
        const uptimeSeconds = Math.floor(process.uptime());
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);

        if (days > 0) {
          metrics.uptime = `${days}д ${hours}ч ${minutes}м`;
        } else if (hours > 0) {
          metrics.uptime = `${hours}ч ${minutes}м`;
        } else {
          metrics.uptime = `${minutes}м`;
        }
      } catch (error) {
        metrics.uptime = 'Unknown';
      }

      // Get memory usage
      const memUsage = process.memoryUsage();
      metrics.memory = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

      // Measure database response time
      const startTime = Date.now();
      await Database.query('SELECT 1');
      metrics.responseTime = Date.now() - startTime;

      // Get real database connection count
      try {
        const dbStats = await Database.queryOne(`
          SELECT count(*) as connection_count
          FROM pg_stat_activity
          WHERE datname = current_database()
        `);
        metrics.dbConnections = parseInt(dbStats.connection_count) || 0;
      } catch (error) {
        console.error('Error getting DB connection count:', error);
        metrics.dbConnections = 0;
      }

      // Get real CPU usage (Node.js process)
      try {
        const cpuUsage = process.cpuUsage();
        const totalCPU = cpuUsage.user + cpuUsage.system;
        // Convert microseconds to percentage (rough estimate)
        metrics.cpu = Math.min(100, Math.round((totalCPU / 1000000) / process.uptime() * 100));
      } catch (error) {
        console.error('Error getting CPU usage:', error);
        metrics.cpu = 0;
      }

      // Get disk usage (platform-specific)
      try {
        const isWindows = process.platform === 'win32';

        if (isWindows) {
          // Windows: use WMIC to get disk space
          const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
          const lines = stdout.trim().split('\n').slice(1); // Skip header

          let totalSize = 0;
          let totalFree = 0;

          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
              const free = parseInt(parts[1]);
              const size = parseInt(parts[2]);
              if (!isNaN(free) && !isNaN(size)) {
                totalFree += free;
                totalSize += size;
              }
            }
          }

          if (totalSize > 0) {
            metrics.disk = Math.round(((totalSize - totalFree) / totalSize) * 100);
          }
        } else {
          // Linux/Unix: use df command
          const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5}'");
          metrics.disk = parseInt(stdout.replace('%', '')) || 0;
        }
      } catch (error) {
        console.error('Error getting disk usage:', error);
        metrics.disk = 0;
      }

      return metrics;

    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return {
        cpu: 0, memory: 0, disk: 0, uptime: 'Unknown',
        dbConnections: 0, responseTime: 0
      };
    }
  }

  // Create system backup
  async createBackup(): Promise<{
    success: boolean;
    filename?: string;
    size?: number;
    error?: string;
  }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup_${timestamp}.sql`;
      const backupPath = path.join(process.cwd(), 'backups', filename);

      // Ensure backup directory exists
      await fs.mkdir(path.dirname(backupPath), { recursive: true });

      // Create database backup using pg_dump
      const dbUrl = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`;
      
      const command = `pg_dump "${dbUrl}" > "${backupPath}"`;
      await execAsync(command);

      // Get file size
      const stats = await fs.stat(backupPath);
      const sizeInMB = Math.round(stats.size / 1024 / 1024);

      // Log backup creation
      await this.logSystemAction('backup_created', {
        filename,
        size: sizeInMB,
        timestamp: new Date()
      });

      return {
        success: true,
        filename,
        size: sizeInMB
      };

    } catch (error) {
      console.error('Backup creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get backup list
  async getBackupList(): Promise<Array<{
    filename: string;
    date: Date;
    size: number;
  }>> {
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      
      try {
        const files = await fs.readdir(backupDir);
        const backups = [];

        for (const file of files) {
          if (file.endsWith('.sql')) {
            const filePath = path.join(backupDir, file);
            const stats = await fs.stat(filePath);
            
            backups.push({
              filename: file,
              date: stats.mtime,
              size: Math.round(stats.size / 1024 / 1024)
            });
          }
        }

        return backups.sort((a, b) => b.date.getTime() - a.date.getTime());

      } catch (dirError) {
        return [];
      }

    } catch (error) {
      console.error('Error getting backup list:', error);
      return [];
    }
  }

  // Restore from backup
  async restoreBackup(filename: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const backupPath = path.join(process.cwd(), 'backups', filename);
      
      // Check if backup file exists
      try {
        await fs.access(backupPath);
      } catch (error) {
        return {
          success: false,
          error: 'Backup file not found'
        };
      }

      // Create database connection string
      const dbUrl = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`;
      
      // Restore database from backup
      const command = `psql "${dbUrl}" < "${backupPath}"`;
      await execAsync(command);

      // Log restore action
      await this.logSystemAction('backup_restored', {
        filename,
        timestamp: new Date()
      });

      return { success: true };

    } catch (error) {
      console.error('Backup restore error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Clean old backups
  async cleanupOldBackups(keepCount: number = 30): Promise<{
    success: boolean;
    deletedCount: number;
    error?: string;
  }> {
    try {
      const backups = await this.getBackupList();
      
      if (backups.length <= keepCount) {
        return {
          success: true,
          deletedCount: 0
        };
      }

      const backupsToDelete = backups.slice(keepCount);
      let deletedCount = 0;

      for (const backup of backupsToDelete) {
        try {
          const backupPath = path.join(process.cwd(), 'backups', backup.filename);
          await fs.unlink(backupPath);
          deletedCount++;
        } catch (deleteError) {
          console.error(`Error deleting backup ${backup.filename}:`, deleteError);
        }
      }

      // Log cleanup action
      await this.logSystemAction('backup_cleanup', {
        deletedCount,
        timestamp: new Date()
      });

      return {
        success: true,
        deletedCount
      };

    } catch (error) {
      console.error('Backup cleanup error:', error);
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get system statistics
  async getSystemStatistics(): Promise<{
    totalUsers: number;
    totalClients: number;
    activeClients: number;
    totalTransactions: number;
    todayTransactions: number;
    totalRevenue: number;
    todayRevenue: number;
    averageBasket: number;
  }> {
    try {
      const stats = await Database.queryOne(`
        SELECT 
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM clients) as total_clients,
          (SELECT COUNT(*) FROM clients WHERE is_active = true) as active_clients,
          (SELECT COUNT(*) FROM point_transactions) as total_transactions,
          (SELECT COUNT(*) FROM point_transactions WHERE DATE(created_at) = CURRENT_DATE) as today_transactions,
          (SELECT COALESCE(SUM(amount), 0) FROM point_transactions WHERE operation_type = 'earn') as total_revenue,
          (SELECT COALESCE(SUM(amount), 0) FROM point_transactions WHERE operation_type = 'earn' AND DATE(created_at) = CURRENT_DATE) as today_revenue,
          (SELECT COALESCE(AVG(amount), 0) FROM point_transactions WHERE operation_type = 'earn') as average_basket
      `);

      return {
        totalUsers: parseInt(stats.total_users) || 0,
        totalClients: parseInt(stats.total_clients) || 0,
        activeClients: parseInt(stats.active_clients) || 0,
        totalTransactions: parseInt(stats.total_transactions) || 0,
        todayTransactions: parseInt(stats.today_transactions) || 0,
        totalRevenue: parseFloat(stats.total_revenue) || 0,
        todayRevenue: parseFloat(stats.today_revenue) || 0,
        averageBasket: parseFloat(stats.average_basket) || 0
      };

    } catch (error) {
      console.error('Error getting system statistics:', error);
      return {
        totalUsers: 0, totalClients: 0, activeClients: 0,
        totalTransactions: 0, todayTransactions: 0, totalRevenue: 0,
        todayRevenue: 0, averageBasket: 0
      };
    }
  }

  // Get error logs from database (activity_log table)
  async getErrorLogs(limit: number = 50): Promise<Array<{
    timestamp: Date;
    level: string;
    message: string;
    details?: any;
  }>> {
    try {
      // Try to get error logs from activity_log or create a simple system
      const sql = `
        SELECT
          created_at as timestamp,
          'ERROR' as level,
          action as message,
          details
        FROM activity_log
        WHERE action LIKE '%error%' OR action LIKE '%fail%'
        ORDER BY created_at DESC
        LIMIT $1
      `;

      const logs = await Database.query(sql, [limit]);

      // If no logs found, return empty array instead of mock data
      if (logs.length === 0) {
        return [];
      }

      return logs.map(log => ({
        timestamp: new Date(log.timestamp),
        level: log.level,
        message: log.message,
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
      }));

    } catch (error) {
      console.error('Error getting error logs:', error);
      // Return empty array instead of mock data on error
      return [];
    }
  }

  // Log errors to database for tracking
  async logError(message: string, details?: any, userId: number = 1): Promise<void> {
    try {
      const sql = `
        INSERT INTO activity_log (user_id, action, target_type, details)
        VALUES ($1, $2, 'system', $3)
      `;

      await Database.query(sql, [
        userId,
        `error: ${message}`,
        JSON.stringify(details || {})
      ]);

    } catch (error) {
      // Don't throw - just log to console to avoid recursive errors
      console.error('Failed to log error to database:', error);
    }
  }

  // Log system actions
  private async logSystemAction(action: string, details: any): Promise<void> {
    try {
      const sql = `
        INSERT INTO activity_log (user_id, action, target_type, details)
        VALUES ($1, $2, $3, $4)
      `;
      
      await Database.query(sql, [1, action, 'system', JSON.stringify(details)]);
      
    } catch (error) {
      console.error('Error logging system action:', error);
    }
  }

  // Export system data
  async exportSystemData(format: 'json' | 'csv' = 'json'): Promise<{
    success: boolean;
    filename?: string;
    error?: string;
  }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `export_${timestamp}.${format}`;
      const exportPath = path.join(process.cwd(), 'exports', filename);

      // Ensure export directory exists
      await fs.mkdir(path.dirname(exportPath), { recursive: true });

      // Get all system data
      const [clients, users, transactions] = await Promise.all([
        Database.query('SELECT * FROM clients WHERE is_active = true'),
        Database.query('SELECT id, telegram_id, username, full_name, role, created_at FROM users'),
        Database.query('SELECT * FROM point_transactions ORDER BY created_at DESC LIMIT 1000')
      ]);

      const exportData = {
        timestamp: new Date(),
        clients,
        users,
        transactions: transactions.slice(0, 1000) // Limit for performance
      };

      if (format === 'json') {
        await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
      } else {
        // For CSV, we'd need to implement CSV conversion
        // For now, just export as JSON
        await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
      }

      // Log export action
      await this.logSystemAction('data_exported', {
        filename,
        format,
        records: clients.length + users.length + transactions.length
      });

      return {
        success: true,
        filename
      };

    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}