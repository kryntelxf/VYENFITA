/**
 * VYENFITA Test Data Factory
 * 
 * @version 1.0.0
 */

import { AuthService } from '../../lib/auth/auth.service';
import { prisma } from '../setup';

export interface TestTenant {
  tenantId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  email: string;
  password: string;
}

/**
 * Create a test tenant with owner user
 */
export async function createTestTenant(
  suffix: string = Math.random().toString(36).substring(7)
): Promise<TestTenant> {
  const email = `owner-${suffix}-${Date.now()}@test.com`;
  const password = 'Test1234';

  const result = await AuthService.register({
    email,
    password,
    name: `Test Owner ${suffix}`,
    tenantName: `Test Tenant ${suffix}`,
    ipAddress: '127.0.0.1',
    userAgent: 'jest-test',
  });

  return {
    tenantId: result.tenant.id,
    userId: result.user.id,
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    email,
    password,
  };
}

/**
 * Create a second user in the same tenant
 */
export async function createTestUserInTenant(
  tenantId: string,
  actorUserId: string,
  roleName: 'Editor' | 'Viewer' | 'Admin' = 'Editor'
): Promise<{ userId: string; email: string; password: string }> {
  const suffix = Math.random().toString(36).substring(7);
  const email = `user-${suffix}-${Date.now()}@test.com`;
  const password = 'Test1234';

  const role = await prisma.role.findFirst({
    where: { tenantId, name: roleName },
  });

  if (!role) {
    throw new Error(`Role ${roleName} not found in tenant ${tenantId}`);
  }

  // Dynamic import to avoid circular dependency
  const { TenantService } = await import('../../lib/tenant/tenant.service');

  const result = await TenantService.inviteMember({
    tenantId,
    invitedByUserId: actorUserId,
    email,
    roleId: role.id,
  });

  return { userId: result.userId, email, password };
}

/**
 * Create a test application
 */
export async function createTestApplication(
  tenantId: string,
  userId: string,
  name: string = 'Test Application'
): Promise<{ applicationId: string; slug: string }> {
  const { ApplicationService } = await import(
    '../../lib/application/application.service'
  );

  const app = await ApplicationService.create({
    tenantId,
    userId,
    name,
    description: 'Test application',
    spec: {
      metadata: { name, description: 'Test', version: '1.0.0' },
      entities: [],
      pages: [],
      roles: [],
    },
  });

  return { applicationId: app.id, slug: app.slug };
    }
