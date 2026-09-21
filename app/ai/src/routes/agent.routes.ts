/**
 * VYENFITA Agent Routes
 * 
 * @version 2.0.0
 */

import { Router } from 'express';
import { AgentController } from '../controllers/agent.controller';

export function createAgentRouter(): Router {
  const router = Router();
  const controller = new AgentController();

  // Templates (public read)
  router.get('/templates', (req, res) => controller.listTemplates(req, res));
  router.get('/templates/:templateId', (req, res) => controller.getTemplate(req, res));

  // Agent CRUD
  router.post('/', (req, res) => controller.create(req, res));
  router.get('/', (req, res) => controller.list(req, res));
  router.get('/:id', (req, res) => controller.get(req, res));
  router.put('/:id', (req, res) => controller.update(req, res));
  router.delete('/:id', (req, res) => controller.delete(req, res));
  router.post('/:id/pause', (req, res) => controller.pause(req, res));
  router.post('/:id/resume', (req, res) => controller.resume(req, res));

  // Runs
  router.post('/:id/run', (req, res) => controller.run(req, res));
  router.get('/:id/runs', (req, res) => controller.listRuns(req, res));
  router.get('/runs/:runId', (req, res) => controller.getRun(req, res));

  // Approval
  router.post('/steps/:stepId/approve', (req, res) => controller.approveStep(req, res));
  router.post('/steps/:stepId/reject', (req, res) => controller.rejectStep(req, res));

  return router;
}

export default createAgentRouter;
