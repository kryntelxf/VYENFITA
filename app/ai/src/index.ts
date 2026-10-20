import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './lib/database/client';
import { PasswordService } from './lib/auth/password';
import { TokenService } from './lib/auth/token';
import { createApplicationRouter } from './routes/application.routes';
import { createWorkflowRouter } from './routes/workflow.routes';
import { createAIRouter } from './routes/ai.routes';
import { createAnalyticsRouter } from './routes/analytics.routes';
import { createMarketplaceRouter } from './routes/marketplace.routes';
import { createAgentRouter } from './routes/agent.routes';
import { createIntegrationRouter } from './routes/integration.routes';

const app = express();
const port = parseInt(process.env.AI_SERVICE_PORT || '3001', 10);
const host = process.env.AI_SERVICE_HOST || '0.0.0.0';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'all-modules-loaded' });
});

app.get('/health/liveness', (_req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

app.get('/health/readiness', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', checks: { database: 'ok' } });
  } catch (error: any) {
    res.status(503).json({ status: 'not_ready', error: error.message });
  }
});

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('# HELP vyenfita_up\n# TYPE vyenfita_up gauge\nvyenfita_up 1\n');
});

app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, name, tenantName } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
    if (!PasswordService.validate(password).valid) return res.status(400).json({ error: 'Weak password' });

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'Email exists' });

    const passwordHash = await PasswordService.hash(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: email.toLowerCase(), passwordHash, name, status: 'active' } });
      const tenant = await tx.tenant.create({ data: { slug: `tenant-${user.id.substring(0,8)}-${Date.now()}`, name: tenantName || `${name}'s Org`, plan: 'free', status: 'active' } });
      const role = await tx.role.create({ data: { tenantId: tenant.id, name: 'Owner', isSystem: false, isDefault: false } });
      await tx.membership.create({ data: { userId: user.id, tenantId: tenant.id, roleId: role.id, status: 'active', joinedAt: new Date() } });
      return { user, tenant };
    });

    const tokens = TokenService.generateTokenPair({ userId: result.user.id, email: result.user.email, tenantId: result.tenant.id });
    await prisma.session.create({ data: { userId: result.user.id, token: tokens.accessToken, expiresAt: new Date(Date.now() + 30*24*60*60*1000) } });

    res.status(201).json({ success: true, data: { user: { id: result.user.id }, tenant: { id: result.tenant.id }, tokens: { accessToken: tokens.accessToken } } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password, tenantId } = req.body;
    if (!email || !password || !tenantId) return res.status(400).json({ error: 'Missing fields' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.passwordHash || !(await PasswordService.verify(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const membership = await prisma.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId } } });
    if (!membership) return res.status(401).json({ error: 'Not a member' });

    const tokens = TokenService.generateTokenPair({ userId: user.id, email: user.email, tenantId: membership.tenantId });
    await prisma.session.create({ data: { userId: user.id, token: tokens.accessToken, expiresAt: new Date(Date.now() + 30*24*60*60*1000) } });

    res.json({ success: true, data: { tokens: { accessToken: tokens.accessToken } } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// MODULE ROUTES
// ============================================================
app.use('/api/v1/applications', createApplicationRouter());
app.use('/api/v1/workflows', createWorkflowRouter());
app.use('/api/v1/ai', createAIRouter());
app.use('/api/v1/analytics', createAnalyticsRouter());
app.use('/api/v1/marketplace', createMarketplaceRouter());
app.use('/api/v1/agents', createAgentRouter());
app.use('/api/v1/integrations', createIntegrationRouter());

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(port, host, () => {
  console.log(`🚀 VYENFITA API running on port ${port}`);
});
