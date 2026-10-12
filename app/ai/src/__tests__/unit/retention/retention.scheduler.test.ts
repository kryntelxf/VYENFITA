/**
 * VYENFITA Retention Scheduler Unit Tests
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/retention/retention.service', () => ({
  RetentionService: {
    runCleanup: jest.fn().mockResolvedValue({
      startedAt: '',
      completedAt: '',
      durationMs: 10,
      dryRun: false,
      results: [],
      totalDeleted: 0,
      errors: [],
    }),
  },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { RetentionScheduler } from '../../../lib/retention/retention.scheduler';
import { RetentionService } from '../../../lib/retention/retention.service';

const mockService = RetentionService as jest.Mocked<typeof RetentionService>;

describe('RetentionScheduler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
  });

  describe('start()', () => {
    it('should not start when RETENTION_ENABLED=false', () => {
      process.env.RETENTION_ENABLED = 'false';
      const scheduler = new RetentionScheduler();

      scheduler.start();

      expect(scheduler.isActive()).toBe(false);
    });

    it('should set active state on start', () => {
      const scheduler = new RetentionScheduler();
      scheduler.start(60000);
      expect(scheduler.isActive()).toBe(true);
      scheduler.stop();
    });

    it('should warn if already running', () => {
      const scheduler = new RetentionScheduler();
      scheduler.start(60000);
      scheduler.start(60000);
      expect(scheduler.isActive()).toBe(true);
      scheduler.stop();
    });

    it('should schedule initial run after startup delay', async () => {
      const scheduler = new RetentionScheduler();
      scheduler.start(60000);

      jest.advanceTimersByTime(61000);
      await Promise.resolve();

      expect(mockService.runCleanup).toHaveBeenCalled();

      scheduler.stop();
    });

    it('should schedule recurring runs', async () => {
      const scheduler = new RetentionScheduler();
      scheduler.start(60000);

      jest.advanceTimersByTime(61000);
      await Promise.resolve();
      jest.advanceTimersByTime(60000);
      await Promise.resolve();

      expect(mockService.runCleanup).toHaveBeenCalledTimes(2);

      scheduler.stop();
    });
  });

  describe('stop()', () => {
    it('should stop scheduled runs', () => {
      const scheduler = new RetentionScheduler();
      scheduler.start(60000);
      scheduler.stop();

      expect(scheduler.isActive()).toBe(false);
    });

    it('should be safe to call when not running', () => {
      const scheduler = new RetentionScheduler();
      expect(() => scheduler.stop()).not.toThrow();
    });
  });

  describe('runOnce()', () => {
    it('should run cleanup directly', async () => {
      const scheduler = new RetentionScheduler();
      await scheduler.runOnce();

      expect(mockService.runCleanup).toHaveBeenCalled();
    });

    it('should prevent concurrent runs', async () => {
      let resolveCleanup: () => void = () => {};
      (mockService.runCleanup as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCleanup = () =>
              resolve({
                startedAt: '',
                completedAt: '',
                durationMs: 0,
                dryRun: false,
                results: [],
                totalDeleted: 0,
                errors: [],
              });
          })
      );

      const scheduler = new RetentionScheduler();
      const promise1 = scheduler.runOnce();
      const promise2 = scheduler.runOnce();

      resolveCleanup();
      await Promise.all([promise1, promise2]);

      expect(mockService.runCleanup).toHaveBeenCalledTimes(1);
    });

    it('should pass dryRun option', async () => {
      const scheduler = new RetentionScheduler();
      await scheduler.runOnce({ dryRun: true });

      expect(mockService.runCleanup).toHaveBeenCalledWith({ dryRun: true });
    });
  });
});
