/**
 * VYENFITA Retention Cleanup Handler Unit Tests
 * 
 * @version 1.0.0
 */

jest.mock('../../../../lib/retention/retention.service', () => ({
  RetentionService: {
    runCleanup: jest.fn(),
  },
}));

jest.mock('../../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { handleRetentionCleanup } from '../../../../lib/queue/handlers/retention-cleanup.handler';
import { RetentionService } from '../../../../lib/retention/retention.service';

const mockService = RetentionService as jest.Mocked<typeof RetentionService>;

describe('handleRetentionCleanup', () => {
  const mockJob: any = {
    id: 'job-1',
    updateProgress: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call RetentionService.runCleanup', async () => {
    (mockService.runCleanup as jest.Mock).mockResolvedValue({
      startedAt: '',
      completedAt: '',
      durationMs: 100,
      dryRun: false,
      results: [
        { entity: 'audit_events', retentionDays: 90, deleted: 5, durationMs: 50 },
      ],
      totalDeleted: 5,
      errors: [],
    });

    const result = await handleRetentionCleanup({}, mockJob);

    expect(mockService.runCleanup).toHaveBeenCalledWith({ dryRun: false });
    expect(result.success).toBe(true);
    expect(result.data?.totalDeleted).toBe(5);
  });

  it('should pass dryRun flag', async () => {
    (mockService.runCleanup as jest.Mock).mockResolvedValue({
      startedAt: '',
      completedAt: '',
      durationMs: 10,
      dryRun: true,
      results: [],
      totalDeleted: 0,
      errors: [],
    });

    await handleRetentionCleanup({ dryRun: true }, mockJob);

    expect(mockService.runCleanup).toHaveBeenCalledWith({ dryRun: true });
  });

  it('should mark success=false when errors present', async () => {
    (mockService.runCleanup as jest.Mock).mockResolvedValue({
      startedAt: '',
      completedAt: '',
      durationMs: 10,
      dryRun: false,
      results: [],
      totalDeleted: 0,
      errors: ['DB error on audit_events'],
    });

    const result = await handleRetentionCleanup({}, mockJob);

    expect(result.success).toBe(false);
    expect(result.data?.errors).toContain('DB error on audit_events');
  });

  it('should update job progress', async () => {
    (mockService.runCleanup as jest.Mock).mockResolvedValue({
      startedAt: '',
      completedAt: '',
      durationMs: 10,
      dryRun: false,
      results: [],
      totalDeleted: 0,
      errors: [],
    });

    await handleRetentionCleanup({}, mockJob);

    expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
  });

  it('should include durationMs in result', async () => {
    (mockService.runCleanup as jest.Mock).mockResolvedValue({
      startedAt: '',
      completedAt: '',
      durationMs: 10,
      dryRun: false,
      results: [],
      totalDeleted: 0,
      errors: [],
    });

    const result = await handleRetentionCleanup({}, mockJob);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
