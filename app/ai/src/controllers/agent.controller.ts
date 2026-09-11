/**
 * VYENFITA Agent Controller
 * 
 * Endpoints for invoking AI agents.
 * 
 * @version 2.0.0
 */

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getAgentRegistry } from '../lib/agents/agent-registry';

export class AgentController {
  /**
   * List all agents
   * GET /api/v1/agents
   */
  async listAgents(req: Request, res: Response): Promise<void> {
    try {
      const registry = getAgentRegistry();
      res.json({
        success: true,
        data: registry.list(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to list agents',
      });
    }
  }

  /**
   * Get a specific agent's info
   * GET /api/v1/agents/:agentName
   */
  async getAgent(req: Request, res: Response): Promise<void> {
    try {
      const registry = getAgentRegistry();
      const agent = registry.get(req.params.agentName);

      if (!agent) {
        res.status(404).json({
          success: false,
          error: `Agent "${req.params.agentName}" not found`,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          name: agent.name,
          description: agent.description,
          capabilities: agent.capabilities,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get agent',
      });
    }
  }

  /**
   * Execute an agent
   * POST /api/v1/agents/:agentName/execute
   */
  async executeAgent(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const registry = getAgentRegistry();
      const agent = registry.get(req.params.agentName);

      if (!agent) {
        res.status(404).json({
          success: false,
          error: `Agent "${req.params.agentName}" not found`,
        });
        return;
      }

      const input = req.body?.input;
      if (!input) {
        res.status(400).json({
          success: false,
          error: 'input is required',
        });
        return;
      }

      const result = await agent.execute({
        agent: agent.name,
        input,
        context: {
          tenantId: req.user.tenantId,
          userId: req.user.userId,
          requestId: randomUUID(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      const statusCode = result.success ? 200 : 422;

      res.status(statusCode).json({
        success: result.success,
        data: result.output,
        meta: {
          agent: result.agent,
          confidence: result.confidence,
          reasoning: result.reasoning,
          durationMs: result.durationMs,
          tokensUsed: result.tokensUsed,
          costUsd: result.costUsd,
          requiresApproval: result.requiresApproval,
          approvalToken: result.approvalToken,
        },
        error: result.error,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent execution failed';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }
}
