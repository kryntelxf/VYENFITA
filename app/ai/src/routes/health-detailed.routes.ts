import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';

const processStart = Date.now();

export function createHealthDetailedRouter(): Router {
  const router = Router();

  router.get('/health/deep', async (_req: Request, res: Response) => {
    const checks: Record<string, any> = {};
    const dbStart = Date.now();
    try { await prisma.$queryRaw`SELECT 1`; checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }; } 
    catch (e) { checks.database = { status: 'fail' }; }

    const mem = process.memoryUsage();
    checks.memory = { status: mem.heapUsed / mem.heapTotal > 0.9 ? 'warn' : 'ok', heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024), heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024) };
    checks.uptime = { status: 'ok', seconds: Math.floor((Date.now() - processStart) / 1000) };
    checks.env = { status: process.env.JWT_SECRET && process.env.ENCRYPTION_KEY ? 'ok' : 'fail', hasJWTSecret: !!process.env.JWT_SECRET, hasEncryptionKey: !!process.env.ENCRYPTION_KEY };

    const allOk = Object.values(checks).every((c: any) => c.status === 'ok');
    return res.status(allOk ? 200 : 503).json({ status: allOk ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() });
  });

  router.get('/version', (_req: Request, res: Response) => {
    return res.json({ version: process.env.SERVICE_VERSION || '4.0.0', nodeVersion: process.version, env: process.env.NODE_ENV || 'development', uptimeSeconds: Math.floor((Date.now() - processStart) / 1000) });
  });

  router.get('/info', (_req: Request, res: Response) => {
    return res.json({ service: 'vyenfita-ai', version: process.env.SERVICE_VERSION || '4.0.0', modules: ['auth', 'applications', 'workflows', 'ai', 'analytics', 'marketplace', 'agents', 'integrations', 'sso', 'observability', 'deployment', 'versioning', 'export-import', 'tenant', 'audit', 'search', 'webhooks', 'analytics-advanced', 'billing', 'organization', 'credentials', 'environment', 'pipeline', 'comments', 'dashboard', 'oauth', 'monitoring', 'agents-advanced', 'i18n', 'gdpr', 'notifications', 'rate-limits', 'quotas', 'usage', 'scheduled-tasks', 'files', 'api-keys', 'outbound-webhooks', 'support', 'plugins', 'marketplace-advanced', 'analytics-export', 'data-import'] });
  });

  return router;
}
