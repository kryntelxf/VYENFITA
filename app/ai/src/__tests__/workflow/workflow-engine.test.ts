/**
 * VYENFITA Workflow Engine Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { createTestTenant } from '../helpers/test-factory';
import { WorkflowService } from '../../lib/workflow/workflow.service';
import { getWorkflowEngine } from '../../lib/workflow/workflow-engine';
import { prisma } from '../setup';

describe('Workflow Engine', () => {
  it('should execute a simple workflow with set_variable step', async () => {
    const tenant = await createTestTenant('wf1');

    const workflow = await WorkflowService.create({
      tenantId: tenant.tenantId,
      userId: tenant.userId,
      name: 'Test Workflow',
      definition: {
        steps: [
          {
            id: 'step-1',
            name: 'Set Variable',
            type: 'set_variable',
            config: {
              variables: { greeting: 'Hello VYENFITA' },
            },
          },
        ],
      },
    });

    const engine = getWorkflowEngine();
    const result = await engine.execute(workflow.id, {
      tenantId: tenant.tenantId,
      userId: tenant.userId,
    });

    expect(result.status).toBe('completed');
    expect(result.stepsExecuted).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should persist execution to database', async () => {
    const tenant = await createTestTenant('wf2');

    const workflow = await WorkflowService.create({
      tenantId: tenant.tenantId,
      userId: tenant.userId,
      name: 'Persist Test',
      definition: {
        steps: [
          {
            id: 'step-1',
            type: 'set_variable',
            config: { variables: { x: 1 } },
          },
        ],
      },
    });

    const engine = getWorkflowEngine();
    const result = await engine.execute(workflow.id, {
      tenantId: tenant.tenantId,
      userId: tenant.userId,
    });

    const execution = await prisma.workflowExecution.findUnique({
      where: { id: result.executionId },
    });

    expect(execution).toBeDefined();
    expect(execution!.status).toBe('completed');
    expect(execution!.startedAt).toBeDefined();
    expect(execution!.completedAt).toBeDefined();
  });

  it('should reject execution from wrong tenant', async () => {
    const tenantA = await createTestTenant('wf-a');
    const tenantB = await createTestTenant('wf-b');

    const workflowA = await WorkflowService.create({
      tenantId: tenantA.tenantId,
      userId: tenantA.userId,
      name: 'A Workflow',
      definition: {
        steps: [
          {
            id: 'step-1',
            type: 'set_variable',
            config: { variables: { x: 1 } },
          },
        ],
      },
    });

    // Tenant B tries to execute Tenant A's workflow
    await expect(
      getWorkflowEngine().execute(workflowA.id, {
        tenantId: tenantB.tenantId,
        userId: tenantB.userId,
      })
    ).rejects.toThrow('Workflow not found');
  });

  it('should reject execution of non-existent workflow', async () => {
    const tenant = await createTestTenant('wf4');

    await expect(
      getWorkflowEngine().execute('00000000-0000-0000-0000-000000000000', {
        tenantId: tenant.tenantId,
      })
    ).rejects.toThrow('Workflow not found');
  });
});
