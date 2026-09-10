/**
 * VYENFITA Test Setup
 * 
 * Global test configuration & database setup
 * 
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';

// Use separate test database
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for tests');
}

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-at-least-32-characters-long';

export const prisma = new PrismaClient({
  log: ['error'],
});

/**
 * Cleanup test database
 */
export async function cleanupDatabase(): Promise<void> {
  // Order matters: delete children before parents
  await prisma.auditEvent.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.workflowExecution.deleteMany();
  await prisma.workflowVersion.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.applicationVersion.deleteMany();
  await prisma.application.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Global setup
 */
beforeAll(async () => {
  await prisma.$connect();
});

/**
 * Global teardown
 */
afterAll(async () => {
  await disconnectDatabase();
});

/**
 * Cleanup before each test
 */
beforeEach(async () => {
  await cleanupDatabase();
});
