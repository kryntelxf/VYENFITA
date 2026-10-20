import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createAIAgentsAdvancedRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/agents/:id/memory', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const agent = await prisma.agent.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
      if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });

      const runs = await prisma.agentRun.findMany({ where: { agentId: agent.id, tenantId, status: 'completed' }, orderBy: { startedAt: 'desc' }, take: 20 });
      return res.json({ success: true, data: runs.map(r => ({ runId: r.id, output: r.output, completedAt: r.completedAt })), count: runs.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/agents/:id/memory', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { content, importance = 0.5 } = req.body;
      if (!content) return res.status(400).json({ success: false, error: 'content is required' });

      const agent = await prisma.agent.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
      if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });

      const run = await prisma.agentRun.findFirst({ where: { agentId: agent.id, tenantId }, orderBy: { startedAt: 'desc' } });
      if (!run) return res.status(400).json({ success: false, error: 'Agent has no runs yet' });

      const step = await prisma.agentStep.create({ data: { runId: run.id, stepIndex: 9999, type: 'decision', decision: { content, importance, addedAt: new Date().toISOString() } as any, tokensUsed: 0, costUsd: 0, durationMs: 0 } });
      return res.status(201).json({ success: true, data: step });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/tools', (_req: Request, res: Response) => {
    const tools = [
      { name: 'http_request', description: 'HTTP call with SSRF protection', riskLevel: 'medium', requiresApproval: false },
      { name: 'get_current_time', description: 'Get current date/time', riskLevel: 'low', requiresApproval: false },
      { name: 'calculate', description: 'Math calculation', riskLevel: 'low', requiresApproval: false },
      { name: 'parse_json', description: 'Parse JSON string', riskLevel: 'low', requiresApproval: false },
      { name: 'string_ops', description: 'String operations', riskLevel: 'low', requiresApproval: false },
      { name: 'wait', description: 'Sleep (max 30s)', riskLevel: 'low', requiresApproval: false },
      { name: 'query_applications', description: 'Query tenant applications', riskLevel: 'low', requiresApproval: false },
      { name: 'query_workflow_executions', description: 'Query workflow executions', riskLevel: 'low', requiresApproval: false },
    ];
    return res.json({ success: true, data: tools, count: tools.length });
  });

  router.get('/agents/:id/stats', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const agent = await prisma.agent.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
      if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });

      const [totalRuns, completedRuns, failedRuns, runStats] = await Promise.all([
        prisma.agentRun.count({ where: { agentId: agent.id } }),
        prisma.agentRun.count({ where: { agentId: agent.id, status: 'completed' } }),
        prisma.agentRun.count({ where: { agentId: agent.id, status: 'failed' } }),
        prisma.agentRun.aggregate({ where: { agentId: agent.id }, _sum: { totalTokens: true, totalCostUsd: true }, _avg: { durationMs: true } }),
      ]);

      return res.json({ success: true, data: { totalRuns, completedRuns, failedRuns, successRate: totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0, totalTokens: runStats._sum.totalTokens || 0, totalCostUsd: runStats._sum.totalCostUsd || 0, averageDurationMs: runStats._avg.durationMs || 0 } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/agents/:id/clone', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const original = await prisma.agent.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
      if (!original) return res.status(404).json({ success: false, error: 'Agent not found' });

      const cloned = await prisma.agent.create({ data: { tenantId, name: `${original.name} (copy)`, description: original.description, icon: original.icon, category: original.category, systemPrompt: original.systemPrompt, model: original.model, temperature: original.temperature, maxSteps: original.maxSteps, maxTokensPerRun: original.maxTokensPerRun, maxDurationSeconds: original.maxDurationSeconds, allowedTools: original.allowedTools, requiresApproval: original.requiresApproval, approvalThreshold: original.approvalThreshold, triggers: original.triggers as any, status: 'active', createdBy: userId } });
      return res.status(201).json({ success: true, data: cloned });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
  }
