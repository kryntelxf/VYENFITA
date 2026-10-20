/**
 * VYENFITA Agent Routes (Minimal)
 *
 * CRUD + run endpoints for AI agents.
 * Tenant isolation enforced via JWT.
 *
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

// ============================================================
// STATIC TEMPLATES
// ============================================================

const AGENT_TEMPLATES = [
  {
    id: 'sales-assistant',
    name: 'Sales Assistant',
    description: 'Analyzes sales pipeline, identifies at-risk deals, drafts outreach',
    category: 'sales',
    icon: '💼',
    allowedTools: ['query_applications', 'http_request', 'calculate'],
    systemPrompt: 'You are a sales assistant. Analyze data and suggest next actions.',
  },
  {
    id: 'support-triage',
    name: 'Support Triage',
    description: 'Categorizes tickets, assesses priority, suggests responses',
    category: 'support',
    icon: '🎫',
    allowedTools: ['query_applications', 'http_request', 'string_ops'],
    systemPrompt: 'You triage support tickets. Categorize and prioritize.',
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    description: 'Analyzes internal data, generates insights',
    category: 'analytics',
    icon: '📊',
    allowedTools: ['query_applications', 'calculate', 'parse_json'],
    systemPrompt: 'You analyze business data and surface insights.',
  },
  {
    id: 'operations-monitor',
    name: 'Operations Monitor',
    description: 'Monitors system health, detects issues',
    category: 'operations',
    icon: '🔍',
    allowedTools: ['query_applications', 'http_request'],
    systemPrompt: 'You monitor systems and flag anomalies.',
  },
  {
    id: 'content-writer',
    name: 'Content Writer',
    description: 'Drafts marketing content, emails, docs',
    category: 'marketing',
    icon: '✍️',
    allowedTools: ['string_ops'],
    systemPrompt: 'You draft high-quality content.',
  },
];

// ============================================================
// HELPERS
// ============================================================

async function getAgentForTenant(id: string, tenantId: string): Promise<any | null> {
  return prisma.agent.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
}

async function getRunForTenant(runId: string, tenantId: string): Promise<any | null> {
  return prisma.agentRun.findFirst({
    where: { id: runId, tenantId },
  });
}

// ============================================================
// ROUTER
// ============================================================

export function createAgentRouter(): Router {
  const router = Router();

  // ============================================================
  // TEMPLATES — LIST (public, no auth)
  // ============================================================
  router.get('/templates', (_req: Request, res: Response) => {
    return res.json({
      success: true,
      data: AGENT_TEMPLATES,
      count: AGENT_TEMPLATES.length,
    });
  });

  // Everything below requires auth
  router.use(authenticate);

  // ============================================================
  // AGENTS — LIST
  // ============================================================
  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const status = req.query.status as string | undefined;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);

      const where: any = { tenantId, deletedAt: null };
      if (status) where.status = status;

      const [agents, total] = await Promise.all([
        prisma.agent.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.agent.count({ where }),
      ]);

      return res.json({
        success: true,
        data: agents,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // AGENTS — CREATE
  // ============================================================
  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const {
        name, description, icon, category = 'custom', systemPrompt,
        model = 'gpt-4o-mini', temperature = 0.3, maxSteps = 20,
        maxTokensPerRun = 100000, maxDurationSeconds = 300,
        allowedTools = [], requiresApproval = true,
        approvalThreshold = 'high', triggers = [], templateId,
      } = req.body;

      if (!name || typeof name !== 'string') return res.status(400).json({ success: false, error: 'name is required' });
      if (name.length > 255) return res.status(400).json({ success: false, error: 'name too long' });

      let finalPrompt = systemPrompt;
      let finalTools = allowedTools;
      let finalCategory = category;
      let finalIcon = icon;

      if (templateId) {
        const tpl = AGENT_TEMPLATES.find((t) => t.id === templateId);
        if (tpl) {
          finalPrompt = finalPrompt || tpl.systemPrompt;
          finalTools = finalTools.length > 0 ? finalTools : tpl.allowedTools;
          finalCategory = category === 'custom' ? tpl.category : category;
          finalIcon = finalIcon || tpl.icon;
        }
      }

      if (!finalPrompt) return res.status(400).json({ success: false, error: 'systemPrompt is required' });

      const agent = await prisma.agent.create({
        data: {
          tenantId, name, description: description || 'Custom agent',
          icon: finalIcon || null, category: finalCategory,
          systemPrompt: finalPrompt, model, temperature, maxSteps,
          maxTokensPerRun, maxDurationSeconds, allowedTools: finalTools,
          requiresApproval, approvalThreshold, triggers: triggers || [],
          status: 'active', createdBy: userId,
        },
      });

      return res.status(201).json({ success: true, data: agent });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // AGENTS — GET BY ID
  // ============================================================
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const agent = await getAgentForTenant(req.params.id, req.user!.tenantId);
      if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
      return res.json({ success: true, data: agent });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // AGENTS — UPDATE
  // ============================================================
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const agent = await getAgentForTenant(req.params.id, req.user!.tenantId);
      if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });

      const { name, description, icon, category, systemPrompt, model, temperature, maxSteps, maxTokensPerRun, maxDurationSeconds, allowedTools, requiresApproval, approvalThreshold, triggers, status } = req.body;

      const updated = await prisma.agent.update({
        where: { id: agent.id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(icon !== undefined && { icon }),
          ...(category !== undefined && { category }),
          ...(systemPrompt !== undefined && { systemPrompt }),
          ...(model !== undefined && { model }),
          ...(temperature !== undefined && { temperature }),
          ...(maxSteps !== undefined && { maxSteps }),
          ...(maxTokensPerRun !== undefined && { maxTokensPerRun }),
          ...(maxDurationSeconds !== undefined && { maxDurationSeconds }),
          ...(allowedTools !== undefined && { allowedTools }),
          ...(requiresApproval !== undefined && { requiresApproval }),
          ...(approvalThreshold !== undefined && { approvalThreshold }),
          ...(triggers !== undefined && { triggers }),
          ...(status !== undefined && { status }),
        },
      });

      return res.json({ success: true, data: updated });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // AGENTS — DELETE (soft)
  // ============================================================
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const agent = await getAgentForTenant(req.params.id, req.user!.tenantId);
      if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });

      await prisma.agent.update({
        where: { id: agent.id },
        data: { deletedAt: new Date(), status: 'archived' },
      });

      return res.json({ success: true, message: 'Agent deleted' });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // AGENTS — RUN
  // ============================================================
  router.post('/:id/run', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const agent = await getAgentForTenant(req.params.id, tenantId);
      
      if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
      if (agent.status !== 'active') return res.status(400).json({ success: false, error: `Agent is not active (status: ${agent.status})` });

      const { objective, context } = req.body;
      if (!objective || typeof objective !== 'string') return res.status(400).json({ success: false, error: 'objective is required' });

      const run = await prisma.agentRun.create({
        data: {
          agentId: agent.id, tenantId, userId, status: 'running',
          input: { objective, context: context || {} }, startedAt: new Date(),
          metadata: { agentName: agent.name, model: agent.model },
        },
      });

      const hasAI = !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY;

      if (!hasAI) {
        await prisma.agentRun.update({
          where: { id: run.id },
          data: {
            status: 'completed',
            output: {
              result: `[MOCK] Agent "${agent.name}" processed objective: "${objective}". Set OPENAI_API_KEY to enable live execution.`,
              reasoning: 'Mock execution', actions: [], confidence: 0.5,
            },
            completedAt: new Date(), durationMs: 100,
          },
        });

        return res.status(201).json({
          success: true,
          data: { runId: run.id, status: 'completed', mock: true, message: 'Agent run completed (mock mode)' },
        });
      }

      return res.status(202).json({
        success: true,
        data: { runId: run.id, status: 'running', message: 'Agent run queued. Poll GET /runs/:runId for status.' },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // AGENTS — LIST RUNS
  // ============================================================
  router.get('/:id/runs', async (req: Request, res: Response) => {
    try {
      const agent = await getAgentForTenant(req.params.id, req.user!.tenantId);
      if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });

      const page = parseInt(req.query.page as string || '1', 10);
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);

      const [runs, total] = await Promise.all([
        prisma.agentRun.findMany({
          where: { agentId: agent.id, tenantId: req.user!.tenantId },
          orderBy: { startedAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.agentRun.count({ where: { agentId: agent.id, tenantId: req.user!.tenantId } }),
      ]);

      return res.json({
        success: true, data: runs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  // ============================================================
  // AGENTS — GET RUN BY ID
  // ============================================================
  router.get('/:id/runs/:runId', async (req: Request, res: Response) => {
    try {
      const agent = await getAgentForTenant(req.params.id, req.user!.tenantId);
      if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });

      const run = await getRunForTenant(req.params.runId, req.user!.tenantId);
      if (!run || run.agentId !== agent.id) return res.status(404).json({ success: false, error: 'Run not found' });

      const steps = await prisma.agentStep.findMany({
        where: { runId: run.id }, orderBy: { stepIndex: 'asc' },
      });

      return res.json({ success: true, data: { ...run, steps } });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed' });
    }
  });

  return router;
    }
