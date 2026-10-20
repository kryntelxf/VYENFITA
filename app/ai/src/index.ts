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
import { createSSORouter } from './routes/sso.routes';
import { createObservabilityRouter } from './routes/observability.routes';
import { createDeploymentRouter } from './routes/deployment.routes';
import { createVersioningRouter } from './routes/versioning.routes';
import { createExportImportRouter } from './routes/export-import.routes';
import { createTenantRouter } from './routes/tenant.routes';
import { createAuditRouter } from './routes/audit.routes';
import { createSearchRouter } from './routes/search.routes';
import { createWebhookRouter } from './routes/webhook.routes';
import { createAnalyticsAdvancedRouter } from './routes/analytics-advanced.routes';
import { createBillingRouter } from './routes/billing.routes';
import { createOrganizationRouter } from './routes/organization.routes';
import { createCredentialsRouter } from './routes/credentials.routes';
import { createEnvironmentRouter } from './routes/environment.routes';
import { createPipelineRouter } from './routes/pipeline.routes';
import { createCommentsRouter } from './routes/comments.routes';
import { createDashboardRouter } from './routes/dashboard.routes';
import { createIntegrationsOAuthRouter } from './routes/integrations-oauth.routes';
import { createMonitoringRouter } from './routes/monitoring.routes';
import { createAIAgentsAdvancedRouter } from './routes/ai-agents-advanced.routes';
import { createMultiLanguageRouter } from './routes/multi-language.routes';
import { createDataExportRouter } from './routes/data-export.routes';
import { createNotificationsAdvancedRouter } from './routes/notifications-advanced.routes';
import { createRateLimitingRouter } from './routes/rate-limiting.routes';
import { createTenantQuotasRouter } from './routes/tenant-quotas.routes';
import { createUsageMetricsRouter } from './routes/usage-metrics.routes';
import { createScheduledTasksRouter } from './routes/scheduled-tasks.routes';
import { createFileStorageRouter } from './routes/file-storage.routes';
import { createAPIKeysRouter } from './routes/api-keys.routes';
import { createWebhooksOutboundRouter } from './routes/webhooks-outbound.routes';
import { createSupportTicketsRouter } from './routes/support-tickets.routes';

const app = express();
const port = parseInt(process.env.AI_SERVICE_PORT || '3001', 10);
const host = process.env.AI_SERVICE_HOST || '0.0.0.0';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

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
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password, tenantId } = req.body;
    if (!email || !password || !tenantId) return res.status(400).json({ error: 'Missing fields' });
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.passwordHash || !(await PasswordService.verify(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' });
    const membership = await prisma.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId } } });
    if (!membership) return res.status(401).json({ error: 'Not a member' });
    const tokens = TokenService.generateTokenPair({ userId: user.id, email: user.email, tenantId: membership.tenantId });
    await prisma.session.create({ data: { userId: user.id, token: tokens.accessToken, expiresAt: new Date(Date.now() + 30*24*60*60*1000) } });
    res.json({ success: true, data: { tokens: { accessToken: tokens.accessToken } } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.use('/', createObservabilityRouter());
app.use('/api/v1/applications', createApplicationRouter());
app.use('/api/v1/workflows', createWorkflowRouter());
app.use('/api/v1/ai', createAIRouter());
app.use('/api/v1/analytics', createAnalyticsRouter());
app.use('/api/v1/marketplace', createMarketplaceRouter());
app.use('/api/v1/agents', createAgentRouter());
app.use('/api/v1/integrations', createIntegrationRouter());
app.use('/api/v1', createSSORouter());
app.use('/api/v1/deployments', createDeploymentRouter());
app.use('/api/v1/versioning', createVersioningRouter());
app.use('/api/v1', createExportImportRouter());
app.use('/api/v1/tenant', createTenantRouter());
app.use('/api/v1/audit', createAuditRouter());
app.use('/api/v1/search', createSearchRouter());
app.use('/api/v1/webhooks', createWebhookRouter());
app.use('/api/v1/analytics-advanced', createAnalyticsAdvancedRouter());
app.use('/api/v1/billing', createBillingRouter());
app.use('/api/v1/organization', createOrganizationRouter());
app.use('/api/v1/credentials', createCredentialsRouter());
app.use('/api/v1/environments', createEnvironmentRouter());
app.use('/api/v1/pipelines', createPipelineRouter());
app.use('/api/v1/comments', createCommentsRouter());
app.use('/api/v1/dashboards', createDashboardRouter());
app.use('/api/v1/oauth', createIntegrationsOAuthRouter());
app.use('/api/v1/monitoring', createMonitoringRouter());

// NEW ROUTERS
app.use('/api/v1/agents-advanced', createAIAgentsAdvancedRouter());
app.use('/api/v1/i18n', createMultiLanguageRouter());
app.use('/api/v1/gdpr', createDataExportRouter());
app.use('/api/v1/notifications', createNotificationsAdvancedRouter());
app.use('/api/v1/rate-limits', createRateLimitingRouter());
app.use('/api/v1/quotas', createTenantQuotasRouter());
app.use('/api/v1/usage', createUsageMetricsRouter());
app.use('/api/v1/scheduled-tasks', createScheduledTasksRouter());
app.use('/api/v1/files', createFileStorageRouter());
app.use('/api/v1/api-keys', createAPIKeysRouter());
app.use('/api/v1/outbound-webhooks', createWebhooksOutboundRouter());
app.use('/api/v1/support', createSupportTicketsRouter());

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(port, host, () => {
  console.log(`🚀 VYENFITA API running on port ${port}`);
});
