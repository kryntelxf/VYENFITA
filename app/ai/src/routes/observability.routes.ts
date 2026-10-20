import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createObservabilityRouter(): Router {
  const router = Router();
  const startTime = Date.now();
  let requestCount = 0;

  router.use((_req, _res, next) => { requestCount++; next(); });

  router.get('/health/liveness', (_req: Request, res: Response) => {
    return res.json({ status: 'alive', uptimeSeconds: Math.floor((Date.now() - startTime) / 1000), timestamp: new Date().toISOString() });
  });

  router.get('/health/readiness', async (_req: Request, res: Response) => {
    const checks: Record<string, string> = {};
    let allOk = true;
    try { await prisma.$queryRaw`SELECT 1`; checks.database = 'ok'; } 
    catch { checks.database = 'fail'; allOk = false; }
    return res.status(allOk ? 200 : 503).json({ status: allOk ? 'ready' : 'not_ready', checks, timestamp: new Date().toISOString() });
  });

  router.get('/metrics', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(`# HELP vyenfita_requests_total Total requests\n# TYPE vyenfita_requests_total counter\nvyenfita_requests_total ${requestCount}\n# HELP vyenfita_uptime_seconds Uptime\n# TYPE vyenfita_uptime_seconds gauge\nvyenfita_uptime_seconds ${Math.floor((Date.now() - startTime) / 1000)}\n`);
  });

  router.get('/debug/traces', authenticate, (_req: Request, res: Response) => {
    return res.json({ success: true, data: { enabled: process.env.OTEL_ENABLED === 'true', mode: 'in-memory', requestCount, uptimeSeconds: Math.floor((Date.now() - startTime) / 1000) } });
  });

  return router;
                      }
