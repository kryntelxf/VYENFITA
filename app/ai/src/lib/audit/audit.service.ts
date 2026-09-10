/**
 * VYENFITA Audit Service
 * 
 * Persistent audit logging
 * - Event logging
 * - Query
 * - Retention
 * 
 * @version 1.0.0
 */

import { prisma } from '../database/client';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface AuditLogInput {
  tenantId?: string;
  userId?: string;
  eventType: 'auth' | 'access' | 'modify' | 'delete' | 'create' | 'security' | 'system';
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  details?: Record<string, any>;
  status?: 'success' | 'failure' | 'error';
  errorMessage?: string;
  duration?: number;
}

export interface AuditQueryFilter {
  tenantId?: string;
  userId?: string;
  eventType?: string;
  resource?: string;
  resourceId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

export class AuditService {
  private retentionDays: number;

  constructor() {
    this.retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10);
  }

  /**
   * Log an audit event (fire-and-forget with error swallowing)
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      await prisma.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          eventType: input.eventType,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          sessionId: input.sessionId,
          requestId: input.requestId,
          details: input.details || {},
          status: input.status || 'success',
          errorMessage: input.errorMessage,
          duration: input.duration,
        },
      });
    } catch (error) {
      // Audit failure should never break the main flow
      logger.error('Failed to write audit log', { error, input });
    }
  }

  /**
   * Query audit events
   */
  async query(
    filter: AuditQueryFilter,
    pagination: { page?: number; limit?: number } = {}
  ) {
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

    const page = pagination.page ?? 1;
    const limit = Math.min(pagination.limit ?? 50, 200);

    const [data, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Cleanup old events
   */
  async cleanup(): Promise<number> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.auditEvent.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    logger.info(`Audit cleanup: removed ${result.count} events older than ${cutoff.toISOString()}`);
    return result.count;
  }
}

export const auditService = new AuditService();
