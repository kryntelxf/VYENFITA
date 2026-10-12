/**
 * VYENFITA Queue Service Unit Tests
 * 
 * @version 1.0.0
 */

const mockQueueAdd = jest.fn();
const mockQueueGetJob = jest.fn();
const mockQueueGetWaitingCount = jest.fn().mockResolvedValue(0);
const mockQueueGetActiveCount = jest.fn().mockResolvedValue(0);
const mockQueueGetCompletedCount = jest.fn().mockResolvedValue(0);
const mockQueueGetFailedCount = jest.fn().mockResolvedValue(0);
const mockQueueGetDelayedCount = jest.fn().mockResolvedValue(0);
const mockQueueIsPaused = jest.fn().mockResolvedValue(false);
const mockQueuePause = jest.fn();
const mockQueueResume = jest.fn();
const mockQueueClose = jest.fn();
const mockQueueClean = jest.fn();
const mockQueueDrain = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getJob: mockQueueGetJob,
    getWaitingCount: mockQueueGetWaitingCount,
    getActiveCount: mockQueueGetActiveCount,
    getCompletedCount: mockQueueGetCompletedCount,
    getFailedCount: mockQueueGetFailedCount,
    getDelayedCount: mockQueueGetDelayedCount,
    isPaused: mockQueueIsPaused,
    pause: mockQueuePause,
    resume: mockQueueResume,
    close: mockQueueClose,
    clean: mockQueueClean,
    drain: mockQueueDrain,
  })),
  Worker: jest.fn(),
}));

const mockRedisOn = jest.fn();
const mockRedisQuit = jest.fn().mockResolvedValue(undefined);
const mockRedisPing = jest.fn().mockResolvedValue('PONG');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: mockRedisOn,
    quit: mockRedisQuit,
    ping: mockRedisPing,
  }));
});

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { QueueService, isQueueEnabled } from '../../../lib/queue/queue.service';
import { QUEUE_NAMES } from '../../../lib/queue/queue.constants';

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QueueService('redis://localhost:6379');
  });

  describe('constructor', () => {
    it('should initialize all queues', () => {
      expect(service).toBeDefined();
    });

    it('should register redis error handler', () => {
      expect(mockRedisOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisOn).toHaveBeenCalledWith('connect', expect.any(Function));
    });
  });

  describe('enqueueWorkflowExecute()', () => {
    it('should call queue.add with correct payload', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-123' });

      const jobId = await service.enqueueWorkflowExecute({
        workflowId: 'wf-1',
        executionId: 'exec-1',
        tenantId: 'tenant-1',
        triggerType: 'manual',
      });

      expect(jobId).toBe('job-123');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        QUEUE_NAMES.WORKFLOW_EXECUTE,
        expect.objectContaining({
          workflowId: 'wf-1',
          tenantId: 'tenant-1',
        }),
        expect.any(Object)
      );
    });

    it('should pass options', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-123' });

      await service.enqueueWorkflowExecute(
        {
          workflowId: 'wf-1',
          executionId: 'exec-1',
          tenantId: 'tenant-1',
          triggerType: 'manual',
        },
        { delay: 5000, priority: 1 }
      );

      expect(mockQueueAdd).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ delay: 5000, priority: 1 })
      );
    });
  });

  describe('enqueueAgentRun()', () => {
    it('should enqueue with correct type', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-agent' });

      await service.enqueueAgentRun({
        agentId: 'agent-1',
        runId: 'run-1',
        tenantId: 'tenant-1',
        objective: 'Test objective',
      });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        QUEUE_NAMES.AGENT_RUN,
        expect.objectContaining({ agentId: 'agent-1' }),
        expect.any(Object)
      );
    });
  });

  describe('enqueueRetentionCleanup()', () => {
    it('should enqueue with empty payload by default', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-retention' });

      await service.enqueueRetentionCleanup();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        QUEUE_NAMES.RETENTION_CLEANUP,
        {},
        expect.any(Object)
      );
    });

    it('should pass dryRun flag', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-retention' });

      await service.enqueueRetentionCleanup({ dryRun: true });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        expect.any(String),
        { dryRun: true },
        expect.any(Object)
      );
    });
  });

  describe('getQueueStats()', () => {
    it('should return stats for a queue', async () => {
      mockQueueGetWaitingCount.mockResolvedValue(5);
      mockQueueGetActiveCount.mockResolvedValue(2);
      mockQueueGetCompletedCount.mockResolvedValue(100);
      mockQueueGetFailedCount.mockResolvedValue(3);
      mockQueueGetDelayedCount.mockResolvedValue(1);
      mockQueueIsPaused.mockResolvedValue(false);

      const stats = await service.getQueueStats(QUEUE_NAMES.WORKFLOW_EXECUTE);

      expect(stats).toEqual({
        name: QUEUE_NAMES.WORKFLOW_EXECUTE,
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: false,
      });
    });
  });

  describe('getJobStatus()', () => {
    it('should return null for non-existent job', async () => {
      mockQueueGetJob.mockResolvedValue(null);

      const status = await service.getJobStatus(
        QUEUE_NAMES.WORKFLOW_EXECUTE,
        'missing'
      );
      expect(status).toBeNull();
    });

    it('should return job status', async () => {
      mockQueueGetJob.mockResolvedValue({
        id: 'job-1',
        getState: jest.fn().mockResolvedValue('completed'),
        progress: 100,
        data: { foo: 'bar' },
        returnvalue: { success: true },
        failedReason: null,
        attemptsMade: 1,
      });

      const status = await service.getJobStatus(
        QUEUE_NAMES.WORKFLOW_EXECUTE,
        'job-1'
      );

      expect(status?.state).toBe('completed');
      expect(status?.progress).toBe(100);
      expect(status?.attemptsMade).toBe(1);
    });
  });

  describe('pauseQueue() / resumeQueue()', () => {
    it('should pause a queue', async () => {
      await service.pauseQueue(QUEUE_NAMES.WORKFLOW_EXECUTE);
      expect(mockQueuePause).toHaveBeenCalled();
    });

    it('should resume a queue', async () => {
      await service.resumeQueue(QUEUE_NAMES.WORKFLOW_EXECUTE);
      expect(mockQueueResume).toHaveBeenCalled();
    });
  });

  describe('cleanQueue()', () => {
    it('should call clean for completed and failed', async () => {
      mockQueueClean
        .mockResolvedValueOnce([{ id: 'c1' }])
        .mockResolvedValueOnce([{ id: 'f1' }, { id: 'f2' }]);

      const result = await service.cleanQueue(QUEUE_NAMES.WORKFLOW_EXECUTE);

      expect(result.completed).toBe(1);
      expect(result.failed).toBe(2);
    });
  });

  describe('shutdown()', () => {
    it('should close all queues and redis', async () => {
      await service.shutdown();

      expect(mockQueueClose).toHaveBeenCalled();
      expect(mockRedisQuit).toHaveBeenCalled();
    });

    it('should be idempotent', async () => {
      await service.shutdown();
      await service.shutdown();

      expect(mockRedisQuit).toHaveBeenCalledTimes(1);
    });
  });

  describe('healthCheck()', () => {
    it('should return healthy when Redis responds PONG', async () => {
      const result = await service.healthCheck();
      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy on error', async () => {
      mockRedisPing.mockRejectedValueOnce(new Error('Redis down'));

      const result = await service.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Redis down');
    });
  });
});

describe('isQueueEnabled', () => {
  const originalEnv = process.env;

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return false when USE_BULLMQ not set', () => {
    delete process.env.USE_BULLMQ;
    expect(isQueueEnabled()).toBe(false);
  });

  it('should return true when USE_BULLMQ=true', () => {
    process.env.USE_BULLMQ = 'true';
    expect(isQueueEnabled()).toBe(true);
  });

  it('should return false when USE_BULLMQ=false', () => {
    process.env.USE_BULLMQ = 'false';
    expect(isQueueEnabled()).toBe(false);
  });
});
