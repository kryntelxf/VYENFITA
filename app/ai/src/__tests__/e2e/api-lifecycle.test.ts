/**
 * VYENFITA E2E API Lifecycle Tests
 * 
 * Tests the full HTTP request → response cycle.
 * Uses the actual Express app.
 * 
 * @version 1.0.0
 */

import '../setup';
import request from 'supertest';
import express from 'express';
import { createAuthRouter } from '../../routes/auth.routes';
import { createApplicationRouter } from '../../routes/application.routes';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { TenantMiddleware } from '../../middleware/tenant.middleware';

// Build a minimal test app
function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.use('/api/v1/auth', createAuthRouter());

  const protectedMiddleware = [AuthMiddleware.validate, TenantMiddleware.enforce];
  app.use('/api/v1/applications', ...protectedMiddleware, createApplicationRouter());

  return app;
}

describe('E2E: API Lifecycle', () => {
  const app = buildTestApp();

  it('should complete register → create app → list apps flow', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // 1. Register
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-${suffix}@test.com`,
        password: 'TestPass123',
        name: 'E2E User',
        tenantName: 'E2E Tenant',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.success).toBe(true);

    const { tokens, tenant } = registerRes.body.data;
    const accessToken = tokens.accessToken;

    // 2. Create application
    const createRes = await request(app)
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-Id', tenant.id)
      .send({
        name: 'E2E Test App',
        description: 'Created during E2E test',
        spec: { metadata: {}, entities: [], pages: [], roles: [] },
      });

    expect([200, 201]).toContain(createRes.status);
    const applicationId = createRes.body.data.id;
    expect(applicationId).toBeDefined();

    // 3. List applications
    const listRes = await request(app)
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-Id', tenant.id);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toBeDefined();
    expect(Array.isArray(listRes.body.data)).toBe(true);
  });

  it('should reject request without Authorization header', async () => {
    const res = await request(app).get('/api/v1/applications');
    expect(res.status).toBe(401);
  });

  it('should reject request with invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/applications')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });

  it('should reject request with mismatched X-Tenant-Id', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Register tenant A
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-${suffix}@test.com`,
        password: 'TestPass123',
        name: 'E2E User',
      });

    const token = registerRes.body.data.tokens.accessToken;
    const otherTenantId = '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', otherTenantId);

    // Should reject (403) because header tenant doesn't match JWT tenant
    expect([401, 403]).toContain(res.status);
  });
});
