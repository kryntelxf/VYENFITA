import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createRateLimitingRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/limits', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      const plan = tenant?.plan || 'free';
      const LIMITS: Record<string, any> = {
        free: { requestsPerMin: 60, aiCallsPerDay: 100, maxConcurrent: 2 },
        starter: { requestsPerMin: 300, aiCallsPerDay: 5000, maxConcurrent: 10 },
        pro: { requestsPerMin: 1000, aiCallsPerDay: 50000, maxConcurrent: 50 },
        enterprise: { requestsPerMin: -1, aiCallsPerDay: -1, maxConcurrent: -1 },
      };
      return res.json({ success: true, data: { plan, limits: LIMITS[plan] || LIMITS.free } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/usage', async (req: Request, res: Response) => {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const usageCount = await prisma.usageRecord.count({ where: { userId: req.user!.userId, timestamp: { gte: today } } });
      const aiUsage = await prisma.usageRecord.aggregate({ where: { userId: req.user!.userId, timestamp: { gte: today }, service: { in: ['openai', 'anthropic'] } }, _sum: { quantity: true } });
      return res.json({ success: true, data: { today: { requests: usageCount, aiTokens: aiUsage._sum.quantity || 0 }, since: today.toISOString() } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/rate-limited-endpoints', (_req: Request, res: Response) => {
    const endpoints = [
      { path: '/api/v1/ai/chat', limit: '60/min', cost: 'tokens' },
      { path: '/api/v1/ai/generate-application', limit: '30/min', cost: 'tokens' },
      { path: '/api/v1/analytics/ask', limit: '30/min', cost: 'tokens' },
      { path: '/api/v1/auth/register', limit: '5/min', cost: 'free' },
      { path: '/api/v1/auth/login', limit: '10/min', cost: 'free' },
    ];
    return res.json({ success: true, data: endpoints, count: endpoints.length });
  });

  return router;
                  }
