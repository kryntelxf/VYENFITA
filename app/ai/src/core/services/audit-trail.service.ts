/**
 * VYENFITA Audit Trail Service
 * 
 * Comprehensive audit trail for compliance
 * - User actions
 * - System events
 * - Security events
 * - Data changes
 * - Access logs
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

export interface AuditEvent {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  ipAddress: string;
  userAgent: string;
  eventType: 'auth' | 'access' | 'modify' | 'delete' | 'create' | 'security' | 'system';
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  status: 'success' | 'failure' | 'error';
  errorMessage?: string;
  timestamp: Date;
  sessionId?: string;
  requestId?: string;
  duration?: number;
}

export interface AuditFilter {
  userId?: string;
  tenantId?: string;
  eventType?: AuditEvent['eventType'];
  status?: AuditEvent['status'];
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  byEventType: Record<string, number>;
  byStatus: Record<string, number>;
  byUser: Record<string, number>;
  byResource: Record<string, number>;
  period: {
    start: Date;
    end: Date;
  };
}

export class AuditTrailService {
  private events: Map<string, AuditEvent>;
  private retentionDays: number;

  constructor(retentionDays: number = 90) {
    this.events = new Map();
    this.retentionDays = retentionDays;
  }

  /**
   * Log an audit event
   */
  logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    const auditEvent: AuditEvent = {
      id: uuidv4(),
      ...event,
      timestamp: new Date(),
    };

    this.events.set(auditEvent.id, auditEvent);

    // Cleanup old events if needed
    this.cleanupOldEvents();

    return auditEvent;
  }

  /**
   * Get events with filters
   */
  getEvents(filter: AuditFilter): { events: AuditEvent[]; total: number } {
    let result = Array.from(this.events.values());

    // Apply filters
    if (filter.userId) {
      result = result.filter(e => e.userId === filter.userId);
    }
    if (filter.tenantId) {
      result = result.filter(e => e.tenantId === filter.tenantId);
    }
    if (filter.eventType) {
      result = result.filter(e => e.eventType === filter.eventType);
    }
    if (filter.status) {
      result = result.filter(e => e.status === filter.status);
    }
    if (filter.resource) {
      result = result.filter(e => e.resource === filter.resource);
    }
    if (filter.startDate) {
      result = result.filter(e => e.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      result = result.filter(e => e.timestamp <= filter.endDate!);
    }

    const total = result.length;

    // Sort by timestamp (newest first)
    result = result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (filter.limit) {
      const offset = filter.offset || 0;
      result = result.slice(offset, offset + filter.limit);
    }

    return { events: result, total };
  }

  /**
   * Get events for a specific user
   */
  getUserEvents(userId: string, limit: number = 100): AuditEvent[] {
    const { events } = this.getEvents({ userId, limit });
    return events;
  }

  /**
   * Get events for a specific tenant
   */
  getTenantEvents(tenantId: string, limit: number = 100): AuditEvent[] {
    const { events } = this.getEvents({ tenantId, limit });
    return events;
  }

  /**
   * Get events for a specific resource
   */
  getResourceEvents(resource: string, resourceId?: string, limit: number = 100): AuditEvent[] {
    const { events } = this.getEvents({ resource, limit });
    return events;
  }

  /**
   * Get audit summary
   */
  getSummary(tenantId: string, startDate?: Date, endDate?: Date): AuditSummary {
    const { events } = this.getEvents({
      tenantId,
      startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: endDate || new Date(),
    });

    const byEventType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byResource: Record<string, number> = {};

    for (const event of events) {
      byEventType[event.eventType] = (byEventType[event.eventType] || 0) + 1;
      byStatus[event.status] = (byStatus[event.status] || 0) + 1;
      byUser[event.userId] = (byUser[event.userId] || 0) + 1;
      byResource[event.resource] = (byResource[event.resource] || 0) + 1;
    }

    return {
      totalEvents: events.length,
      byEventType,
      byStatus,
      byUser,
      byResource,
      period: {
        start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate || new Date(),
      },
    };
  }

  /**
   * Clean up old events
   */
  private cleanupOldEvents(): void {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    let count = 0;

    for (const [id, event] of this.events) {
      if (event.timestamp < cutoff) {
        this.events.delete(id);
        count++;
      }
    }

    if (count > 0) {
      console.log(`Cleaned up ${count} old audit events`);
    }
  }

  /**
   * Get user activity summary
   */
  getUserActivitySummary(userId: string, days: number = 30): {
    totalEvents: number;
    lastActive: Date | null;
    actions: Record<string, number>;
    successRate: number;
    activeDays: number;
  } {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { events } = this.getEvents({ userId, startDate });

    const actions: Record<string, number> = {};
    let successCount = 0;
    const activeDays = new Set<string>();

    for (const event of events) {
      actions[event.action] = (actions[event.action] || 0) + 1;
      if (event.status === 'success') successCount++;
      activeDays.add(event.timestamp.toDateString());
    }

    const sorted = events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      totalEvents: events.length,
      lastActive: sorted.length > 0 ? sorted[0].timestamp : null,
      actions,
      successRate: events.length > 0 ? (successCount / events.length) * 100 : 0,
      activeDays: activeDays.size,
    };
  }

  /**
   * Get security event summary
   */
  getSecuritySummary(tenantId: string, days: number = 30): {
    totalSecurityEvents: number;
    failedLogins: number;
    successfulLogins: number;
    suspiciousEvents: number;
    uniqueUsers: number;
    topIPs: { ip: string; count: number }[];
  } {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { events } = this.getEvents({
      tenantId,
      eventType: 'security',
      startDate,
    });

    let failedLogins = 0;
    let successfulLogins = 0;
    let suspiciousEvents = 0;
    const userSet = new Set<string>();
    const ipMap: Record<string, number> = {};

    for (const event of events) {
      userSet.add(event.userId);
      ipMap[event.ipAddress] = (ipMap[event.ipAddress] || 0) + 1;

      if (event.action === 'login') {
        if (event.status === 'success') successfulLogins++;
        else failedLogins++;
      }

      if (event.action === 'suspicious_activity' || event.action === 'security_alert') {
        suspiciousEvents++;
      }
    }

    const topIPs = Object.entries(ipMap)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSecurityEvents: events.length,
      failedLogins,
      successfulLogins,
      suspiciousEvents,
      uniqueUsers: userSet.size,
      topIPs,
    };
  }
    }
