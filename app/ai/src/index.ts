import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './lib/database/client';
import { PasswordService } from './lib/auth/password';
import { TokenService } from './lib/auth/token';
import { createApplicationRouter } from './routes/application.routes';

const app = express();
const port = parseInt(process.env.AI_SERVICE_PORT || '3001', 10);
const host = process.env.AI_SERVICE_HOST || '0.0.0.0';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'minimal-with-auth-and-apps' });
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

// MOUNT APPLICATION ROUTES
app.use('/api/v1/applications', createApplicationRouter());

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(port, host, () => {
  console.log(`🚀 VYENFITA API running on port ${port}`);
});
