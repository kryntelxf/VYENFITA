/**
 * VYENFITA Activity Log Service
 * 
 * Tracks user activities across the platform
 * - Login/Logout
 * - Application creation
 * - Workflow execution
 * - AI requests
 * - BI queries
 * - Settings changes
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

export interface ActivityLog {
  id: string;
  userId: string;
  tenantId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  duration?: number;
  status: 'success' | 'error' | 'pending';
  error?: string;
}

export class ActivityLogService {
  private logs: Map<string, ActivityLog>;

  constructor() {
    this.logs = new Map();
  }

  /**
   * Log an activity
   */
  log(activity: Omit<ActivityLog, 'id' | 'timestamp'>): ActivityLog {
    const log: ActivityLog = {
      id: uuidv4(),
      ...activity,
      timestamp: new Date(),
    };

    this.logs.set(log.id, log);
    return log;
  }

  /**
   * Get logs by user
   */
  getByUser(userId: string): ActivityLog[] {
    const result: ActivityLog[] = [];
    for (const log of this.logs.values()) {
      if (log.userId === userId) {
        result.push(log);
      }
    }
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get logs by tenant
   */
  getByTenant(tenantId: string): ActivityLog[] {
    const result: ActivityLog[] = [];
    for (const log of this.logs.values()) {
      if (log.tenantId === tenantId) {
        result.push(log);
      }
    }
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get logs by action
   */
  getByAction(action: string): ActivityLog[] {
    const result: ActivityLog[] = [];
    for (const log of this.logs.values()) {
      if (log.action === action) {
        result.push(log);
      }
    }
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get logs by time range
   */
  getByTimeRange(start: Date, end: Date): ActivityLog[] {
    const result: ActivityLog[] = [];
    for (const log of this.logs.values()) {
      if (log.timestamp >= start && log.timestamp <= end) {
        result.push(log);
      }
    }
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get recent logs
   */
  getRecent(limit: number = 100): ActivityLog[] {
    const result = Array.from(this.logs.values());
    return result
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get statistics
   */
  getStats(tenantId?: string): ActivityStats {
    const logs = tenantId ? this.getByTenant(tenantId) : Array.from(this.logs.values());

    const stats: ActivityStats = {
      total: logs.length,
      byAction: {},
      byStatus: { success: 0, error: 0, pending: 0 },
      byHour: {},
      byDay: {},
      uniqueUsers: new Set(),
    };

    for (const log of logs) {
      // By action
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

      // By status
      stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;

      // By hour
      const hour = log.timestamp.getHours();
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;

      // By day
      const day = log.timestamp.toDateString();
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;

      // Unique users
      stats.uniqueUsers.add(log.userId);
    }

    return stats;
  }

  /**
   * Clear old logs
   */
  clearOldLogs(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let count = 0;
    for (const [id, log] of this.logs) {
      if (now - log.timestamp.getTime() > maxAgeMs) {
        this.logs.delete(id);
        count++;
      }
    }
    return count;
  }
}

export interface ActivityStats {
  total: number;
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
  byHour: Record<number, number>;
  byDay: Record<string, number>;
  uniqueUsers: Set<string>;
      }
