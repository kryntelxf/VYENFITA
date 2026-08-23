/**
 * VYENFITA Workflow Routes
 */

import { Router } from 'express';
import { WorkflowController } from '../controllers/workflow.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import Joi from 'joi';

export function createWorkflowRouter(): Router {
  const router = Router();
  const controller = new WorkflowController();

  // All workflow routes require authentication
  router.use(AuthMiddleware.validate);

  // Execute workflow
  router.post(
    '/execute',
    ValidationMiddleware.validate(
      Joi.object({
        workflow: Joi.object().required(),
        variables: Joi.object().optional(),
        triggerData: Joi.object().optional(),
      })
    ),
    (req, res) => controller.executeWorkflow(req, res)
  );

  // Generate and execute workflow
  router.post(
    '/generate-and-execute',
    ValidationMiddleware.validate(
      Joi.object({
        description: Joi.string().min(1).required(),
        variables: Joi.object().optional(),
        triggerData: Joi.object().optional(),
      })
    ),
    (req, res) => controller.generateAndExecute(req, res)
  );

  // Get execution status
  router.get(
    '/executions/:executionId',
    (req, res) => controller.getExecution(req, res)
  );

  // List executions for a workflow
  router.get(
    '/executions/workflow/:workflowId',
    (req, res) => controller.listExecutions(req, res)
  );

  return router;
    }
