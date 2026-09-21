/**
 * VYENFITA Agent Controller
 * 
 * @version 3.0.0
 */

import { Request, Response } from 'express';
import { AgentService } from '../lib/agents/agent.service';
import { AGENT_TEMPLATES, getTemplate } from '../lib/agents/agent-templates';
import { AgentError } from '../lib/agents/agent.types';

export class AgentController {
  // ============================================================
  // TEMPLATES
  // ============================================================

  async listTemplates(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: AGENT_TEMPLATES,
      count: AGENT_TEMPLATES.length,
    });
  }

  async getTemplate(req: Request, res: Response): Promise<void> {
    const template = getTemplate(req.params.templateId);
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    res.json({ success: true, data: template });
  }

  // ============================================================
  // AGENTS CRUD
  // ============================================================

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const agent = await AgentService.create({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        ...req.body,
      });

      res.status(201).json({ success: true, data: agent });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const agents = await AgentService.list(
        req.user.tenantId,
        req.query.status as string
      );

      res.json({ success: true, data: agents, count: agents.length });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async get(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const agent = await AgentService.getById(req.params.id, req.user.tenantId);
      res.json({ success: true, data: agent });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const agent = await AgentService.update(
        req.params.id,
        req.user.tenantId,
        req.body
      );

      res.json({ success: true, data: agent });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      await AgentService.delete(req.params.id, req.user.tenantId);
      res.json({ success: true, message: 'Agent deleted' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async pause(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const agent = await AgentService.pause(req.params.id, req.user.tenantId);
      res.json({ success: true, data: agent });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async resume(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const agent = await AgentService.resume(req.params.id, req.user.tenantId);
      res.json({ success: true, data: agent });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ============================================================
  // RUNS
  // ============================================================

  async run(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { objective, context, constraints } = req.body;

      if (!objective || typeof objective !== 'string') {
        res.status(400).json({ success: false, error: 'objective is required' });
        return;
      }

      const run = await AgentService.run(req.params.id, req.user.tenantId, {
        objective,
        context,
        constraints,
      });

      res.status(201).json({ success: true, data: run });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listRuns(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const runs = await AgentService.listRuns(req.params.id, req.user.tenantId, limit);

      res.json({ success: true, data: runs, count: runs.length });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getRun(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const run = await AgentService.getRun(req.params.runId, req.user.tenantId);
      res.json({ success: true, data: run });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ============================================================
  // APPROVAL
  // ============================================================

  async approveStep(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { reason } = req.body;
      const result = await AgentService.approveStep(
        req.params.stepId,
        req.user.tenantId,
        req.user.userId,
        true,
        reason
      );

      res.json({ success: true, data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async rejectStep(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { reason } = req.body;
      const result = await AgentService.approveStep(
        req.params.stepId,
        req.user.tenantId,
        req.user.userId,
        false,
        reason
      );

      res.json({ success: true, data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ============================================================
  // ERROR HANDLER
  // ============================================================

  private handleError(error: unknown, res: Response): void {
    if (error instanceof AgentError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
  }
