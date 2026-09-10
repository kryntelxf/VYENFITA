/**
 * VYENFITA Audit Repository
 * 
 * Data access for AuditEvent model
 * 
 * @version 1.0.0
 */

import { AuditEvent } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient, TransactionClient } from '../client';

export interface CreateAuditEventInput {
  tenantId?: string;
  userId?: string;
  eventType: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  details?: Record<string, any>;
  status?: string;
  errorMessage?: string;
  duration?: number;
}

export interface AuditFilter {
  tenantId?: string;
  userId?: string;
  eventType?: string;
  resource?: string;
  resourceId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

export class AuditRepository extends BaseRepository<
  AuditEvent,
  CreateAuditEventInput,
  never,
  any
> {
  protected modelName = 'AuditEvent';

  protected getModel(client: PrismaClient | TransactionClient): any {
    return client.auditEvent;
  }

  /**
   * Query audit events with filters
   */
  async query(
    filter: AuditFilter,
    options?: { page?: number; limit?: number },
    tx?: TransactionClient
  ): Promise<any> {
    const where: any = {};

    if (filter.tenantId) where.tenantId = filter.tenantId;
    if (filter.userId) where.userId = filter.userId;
    if (filter.eventType) where.eventType = filter.eventType;
    if (filter.resource) where.resource = filter.resource;
    if (filter.resourceId) where.resourceId = filter.resourceId;
    if (filter.status) where.status = filter.status;

    if (filter.startDate || filter.endDate) {
      where.timestamp = {};
      if (filter.startDate) where.timestamp.gte = filter.startDate;
      if (filter.endDate) where.timestamp.lte = filter.endDate;
    }

    return this.findMany(where, {
      pagination: {
        page: options?.page,
        limit: options?.limit,
      },
      sort: { field: 'timestamp', direction: 'desc' },
    }, tx);
  }

  /**
   * Get recent events for a tenant
   */
  async getRecentByTenant(
    tenantId: string,
    limit: number = 100,
    tx?: TransactionClient
  ): Promise<AuditEvent[]> {
    const client = tx || PrismaClient;
    return this.getModel(client).findMany({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get events for a specific resource
   */
  async getByResource(
    resource: string,
    resourceId: string,
    tx?: TransactionClient
  ): Promise<AuditEvent[]> {
    const client = tx || PrismaClient;
    return this.getModel(client).findMany({
      where: { resource, resourceId },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Count events by type
   */
  async countByType(
    tenantId: string,
    eventType: string,
    startDate?: Date,
    endDate?: Date,
    tx?: TransactionClient
  ): Promise<number> {
    const where: any = { tenantId, eventType };
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }
    return this.count(where, tx);
  }

  /**
   * Delete old events (retention policy)
   */
  async deleteOlderThan(
    cutoffDate: Date,
    tx?: TransactionClient
  ): Promise<{ count: number }> {
    return this.deleteMany({ timestamp: { lt: cutoffDate } } as any, tx);
  }
}

export const auditRepository = new AuditRepository();
