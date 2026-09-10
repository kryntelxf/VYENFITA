/**
 * VYENFITA Workflow Execution Controller
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { getWorkflowEngine } from '../lib/workflow/workflow-engine';
import { prisma } from '../lib/database/client';

export class WorkflowExecutionController {
  /**
   * Execute workflow
   * POST /api/v1/workflows/:id/execute
   */
  async execute(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const workflowId = req.params.id;
      const { input, variables } = req.body;

      const engine = getWorkflowEngine();

      const result = await engine.execute(workflowId, {
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        input: input || {},
        variables: variables || {},
        triggerType: 'manual',
      });

      const statusCode = result.status === 'completed' ? 200 : 422;

      res.status(statusCode).json({
        success: result.status === 'completed',
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution failed';
      const isNotFound = message.includes('not found');

      res.status(isNotFound ? 404 : 500).json({
        success: false,
        error: isNotFound ? message : 'Workflow execution failed',
      });
    }
  }

  /**
   * Cancel execution
   * POST /api/v1/workflows/executions/:executionId/cancel
   */
  async cancel(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const engine = getWorkflowEngine();
      await engine.cancel(req.params.executionId, req.user.tenantId);

      res.json({ success: true, message: 'Execution cancelled' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cancel failed';
      const isNotFound = message.includes('not found');
      const isInvalid = message.includes('Cannot cancel');

      res.status(isNotFound ? 404 : isInvalid ? 400 : 500).json({
        success: false,
        error: message,
      });
    }
  }

  /**
   * Get execution
   * GET /api/v1/workflows/executions/:executionId
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const execution = await prisma.workflowExecution.findFirst({
        where: {
          id: req.params.executionId,
          tenantId: req.user.tenantId,
        },
      });

      if (!execution) {
        res.status(404).json({ success: false, error: 'Execution not found' });
        return;
      }

      res.json({ success: true, data: execution });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get execution' });
    }
  }

  /**
   * List executions for a workflow
   * GET /api/v1/workflows/:id/executions
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const workflowId = req.params.id;
      const { status, page = '1', limit = '20' } = req.query;

      // Verify workflow belongs to tenant
      const workflow = await prisma.workflow.findFirst({
        where: { id: workflowId, tenantId: req.user.tenantId, deletedAt: null },
      });

      if (!workflow) {
        res.status(404).json({ success: false, error: 'Workflow not found' });
        return;
      }

      const where: any = { workflowId, tenantId: req.user.tenantId };
      if (status) where.status = status;

      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);

      const [executions, total] = await Promise.all([
        prisma.workflowExecution.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.workflowExecution.count({ where }),
      ]);

      res.json({
        success: true,
        data: executions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to list executions' });
    }
  }
          }
