/**
 * VYENFITA Test Database Cleaner
 * 
 * Cleans test database between tests.
 * Order matters: delete children before parents.
 * 
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';

export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  // Delete in correct order (FK constraints)
  await prisma.auditEvent.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.costRecord.deleteMany();
  await prisma.usageRecord.deleteMany();
  await prisma.deployment.deleteMany();
  await prisma.workflowExecution.deleteMany();
  await prisma.workflowVersion.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.applicationVersion.deleteMany();
  await prisma.environment.deleteMany();
  await prisma.application.deleteMany();
  await prisma.complianceEvidence.deleteMany();
  await prisma.complianceControl.deleteMany();
  await prisma.complianceFramework.deleteMany();
  await prisma.templateReview.deleteMany();
  await prisma.marketplaceTemplate.deleteMany();
  await prisma.secret.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
    }
