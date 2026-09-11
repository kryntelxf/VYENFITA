/**
 * VYENFITA Agent Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { AgentController } from '../controllers/agent.controller';

export function createAgentRouter(): Router {
  const router = Router();
  const controller = new AgentController();

  // List all agents
  router.get('/', (req, res) => controller.listAgents(req, res));

  // Get agent info
  router.get('/:agentName', (req, res) => controller.getAgent(req, res));

  // Execute agent
  router.post('/:agentName/execute', (req, res) => controller.executeAgent(req, res));

  return router;
}
