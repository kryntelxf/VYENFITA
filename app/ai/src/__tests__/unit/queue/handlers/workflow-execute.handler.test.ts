/**
 * VYENFITA Workflow Execute Handler Unit Tests
 * 
 * @version 1.0.0
 */

jest.mock('../../../../lib/workflow/workflow-engine', () => ({
  getWorkflowEngine: jest.fn(),
}));

jest.mock('../../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { handleWorkflowExecute } from '../../../../lib/queue/handlers/workflow-execute.handler';
import { getWorkflowEngine } from '../../../../lib/workflow/workflow-engine';

const mockEngine = {
  execute: jest.fn(),
};

(getWorkflowEngine as jest.Mock).mockReturnValue(mockEngine);

describe('handleWorkflowExecute', () => {
  const mockJob: any = {
    id: 'job-1',
    updateProgress: jest.fn().mockResolvedValue(undefined),
  };

  const validPayload = {
    workflowId: 'wf-1',
    executionId: 'exec-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    triggerType: 'manual' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call engine.execute with correct params', async () => {
    mockEngine.execute.mockResolvedValue({
      executionId: 'exec-1',
      status: 'completed',
      stepsExecuted: 3,
      durationMs: 100,
    });

    const result = await handleWorkflowExecute(validPayload, mockJob);

    expect(mockEngine.execute).toHaveBeenCalledWith('wf-1', {
      tenantId: 'tenant-1',
      userId: 'user-1',
      input: {},
      triggerType: 'manual',
    });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('completed');
  });

  it('should mark success=false when status is not completed', async () => {
    mockEngine.execute.mockResolvedValue({
      executionId: 'exec-1',
      status: 'failed',
      stepsExecuted: 1,
      durationMs: 50,
    });

    const result = await handleWorkflowExecute(validPayload, mockJob);
    expect(result.success).toBe(false);
  });

  it('should throw on engine error (for retry)', async () => {
    mockEngine.execute.mockRejectedValue(new Error('Workflow not found'));

    await expect(handleWorkflowExecute(validPayload, mockJob)).rejects.toThrow(
      'Workflow not found'
    );
  });

  it('should pass input from payload', async () => {
    mockEngine.execute.mockResolvedValue({
      executionId: 'exec-1',
      status: 'completed',
      stepsExecuted: 1,
      durationMs: 10,
    });

    await handleWorkflowExecute(
      { ...validPayload, input: { foo: 'bar' } },
      mockJob
    );

    expect(mockEngine.execute).toHaveBeenCalledWith(
      'wf-1',
      expect.objectContaining({ input: { foo: 'bar' } })
    );
  });
});
