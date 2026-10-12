/**
 * VYENFITA Retention Service Unit Tests
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    auditEvent: { count: jest.fn(), deleteMany: jest.fn() },
    workflowExecution: { count: jest.fn(), deleteMany: jest.fn() },
    agentStep: { count: jest.fn(), deleteMany: jest.fn() },
    agentRun: { findMany: jest.fn() },
    session: { count: jest.fn(), deleteMany: jest.fn() },
    oAuthState: { count: jest.fn(), deleteMany: jest.fn() },
    user: { count: jest.fn() },
  },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../lib/observability/metrics.service', () => ({
  getMetrics: jest.fn(() => ({
    incrementCounter: jest.fn(),
  })),
}));

jest.mock('../../../lib/gdpr/data-deletion.service', () => ({
  DataDeletionService: {
    processExpiredDeletions: jest.fn().mockResolvedValue({
      processed: 0,
      anonymized: [],
      errors: [],
    }),
  },
}));

import { RetentionService } from '../../../lib/retention/retention.service';
import { DataDeletionService } from '../../../lib/gdpr/data-deletion.service';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('RetentionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RetentionService.setConfig({
      auditEvents: 90,
      workflowExecutions: 30,
      agentSteps: 90,
      sessionsGraceDays: 30,
      oauthStatesGraceMinutes: 60,
      deletedUsersGraceDays: 30,
    });

    (mockPrisma.auditEvent.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.auditEvent.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.workflowExecution.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.workflowExecution.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.agentRun.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.agentStep.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.agentStep.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.session.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.oAuthState.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.oAuthState.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.user.count as jest.Mock).mockResolvedValue(0);
  });

  describe('getConfig() / setConfig()', () => {
    it('should return default config', () => {
      const config = RetentionService.getConfig();
      expect(config.auditEvents).toBe(90);
      expect(config.workflowExecutions).toBe(30);
      expect(config.sessionsGraceDays).toBe(30);
    });

    it('should merge partial config', () => {
      RetentionService.setConfig({ auditEvents: 30 });
      const config = RetentionService.getConfig();
      expect(config.auditEvents).toBe(30);
      expect(config.workflowExecutions).toBe(30);
    });
  });

  describe('cleanupAuditEvents()', () => {
    it('should delete old audit events', async () => {
      (mockPrisma.auditEvent.deleteMany as jest.Mock).mockResolvedValue({ count: 42 });

      const result = await RetentionService.cleanupAuditEvents(false);

      expect(result.entity).toBe('audit_events');
      expect(result.deleted).toBe(42);
      expect(mockPrisma.auditEvent.deleteMany).toHaveBeenCalled();
    });

    it('should count only on dry-run', async () => {
      (mockPrisma.auditEvent.count as jest.Mock).mockResolvedValue(100);

      const result = await RetentionService.cleanupAuditEvents(true);

      expect(result.deleted).toBe(100);
      expect(mockPrisma.auditEvent.deleteMany).not.toHaveBeenCalled();
    });

    it('should use correct cutoff date', async () => {
      (mockPrisma.auditEvent.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      await RetentionService.cleanupAuditEvents(false);

      const callArg = (mockPrisma.auditEvent.deleteMany as jest.Mock).mock.calls[0][0];
      const cutoff = callArg.where.timestamp.lt as Date;
      const expectedCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;

      expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(5000);
    });

    it('should return error on failure', async () => {
      (mockPrisma.auditEvent.deleteMany as jest.Mock).mockRejectedValue(
        new Error('DB error')
      );

      const result = await RetentionService.cleanupAuditEvents(false);

      expect(result.error).toBe('DB error');
      expect(result.deleted).toBe(0);
    });
  });

  describe('cleanupWorkflowExecutions()', () => {
    it('should delete old executions', async () => {
      (mockPrisma.workflowExecution.deleteMany as jest.Mock).mockResolvedValue({ count: 20 });

      const result = await RetentionService.cleanupWorkflowExecutions(false);

      expect(result.entity).toBe('workflow_executions');
      expect(result.deleted).toBe(20);
    });
  });

  describe('cleanupAgentSteps()', () => {
    it('should return 0 when no old runs', async () => {
      (mockPrisma.agentRun.findMany as jest.Mock).mockResolvedValue([]);

      const result = await RetentionService.cleanupAgentSteps(false);

      expect(result.deleted).toBe(0);
      expect(mockPrisma.agentStep.deleteMany).not.toHaveBeenCalled();
    });

    it('should delete steps for old runs', async () => {
      (mockPrisma.agentRun.findMany as jest.Mock).mockResolvedValue([
        { id: 'run-1' },
        { id: 'run-2' },
      ]);
      (mockPrisma.agentStep.deleteMany as jest.Mock).mockResolvedValue({ count: 15 });

      const result = await RetentionService.cleanupAgentSteps(false);

      expect(result.deleted).toBe(15);
      const callArg = (mockPrisma.agentStep.deleteMany as jest.Mock).mock.calls[0][0];
      expect(callArg.where.runId.in).toEqual(['run-1', 'run-2']);
    });
  });

  describe('cleanupSessions()', () => {
    it('should delete old sessions', async () => {
      (mockPrisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 30 });

      const result = await RetentionService.cleanupSessions(false);

      expect(result.deleted).toBe(30);
      expect(result.entity).toBe('sessions');
    });
  });

  describe('cleanupOAuthStates()', () => {
    it('should delete expired OAuth states', async () => {
      (mockPrisma.oAuthState.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await RetentionService.cleanupOAuthStates(false);

      expect(result.deleted).toBe(5);
      expect(result.entity).toBe('oauth_states');
    });
  });

  describe('cleanupDeletedUsers()', () => {
    it('should delegate to DataDeletionService', async () => {
      (DataDeletionService.processExpiredDeletions as jest.Mock).mockResolvedValue({
        processed: 3,
        anonymized: ['u1', 'u2', 'u3'],
        errors: [],
      });

      const result = await RetentionService.cleanupDeletedUsers(false);

      expect(result.deleted).toBe(3);
      expect(result.entity).toBe('deleted_users');
    });

    it('should count only on dry-run', async () => {
      (mockPrisma.user.count as jest.Mock).mockResolvedValue(7);

      const result = await RetentionService.cleanupDeletedUsers(true);

      expect(result.deleted).toBe(7);
      expect(DataDeletionService.processExpiredDeletions).not.toHaveBeenCalled();
    });

    it('should include errors from deletion service', async () => {
      (DataDeletionService.processExpiredDeletions as jest.Mock).mockResolvedValue({
        processed: 2,
        anonymized: ['u1'],
        errors: ['u2: DB error'],
      });

      const result = await RetentionService.cleanupDeletedUsers(false);

      expect(result.deleted).toBe(1);
      expect(result.error).toContain('u2');
    });
  });

  describe('runCleanup()', () => {
    it('should run all cleanup tasks', async () => {
      const report = await RetentionService.runCleanup();

      expect(report.results.length).toBe(6);
      expect(report.results.map((r) => r.entity)).toEqual([
        'audit_events',
        'workflow_executions',
        'agent_steps',
        'sessions',
        'oauth_states',
        'deleted_users',
      ]);
      expect(report.dryRun).toBe(false);
      expect(report.startedAt).toBeDefined();
      expect(report.completedAt).toBeDefined();
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should sum total deleted', async () => {
      (mockPrisma.auditEvent.deleteMany as jest.Mock).mockResolvedValue({ count: 10 });
      (mockPrisma.workflowExecution.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });
      (mockPrisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });

      const report = await RetentionService.runCleanup();

      expect(report.totalDeleted).toBe(18);
    });

    it('should continue if one task fails', async () => {
      (mockPrisma.auditEvent.deleteMany as jest.Mock).mockRejectedValue(
        new Error('audit failed')
      );
      (mockPrisma.workflowExecution.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const report = await RetentionService.runCleanup();

      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.totalDeleted).toBe(5);
    });

    it('should pass dryRun flag through', async () => {
      const report = await RetentionService.runCleanup({ dryRun: true });

      expect(report.dryRun).toBe(true);
      expect(mockPrisma.auditEvent.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.auditEvent.count).toHaveBeenCalled();
    });
  });
});
