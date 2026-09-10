/**
 * VYENFITA Build Service Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { createTestTenant, createTestApplication } from '../helpers/test-factory';
import { BuildService } from '../../lib/deployment/build.service';
import { ApplicationService } from '../../lib/application/application.service';
import { prisma } from '../setup';

describe('Build Service', () => {
  it('should build an artifact from a version', async () => {
    const tenant = await createTestTenant('build1');
    const app = await createTestApplication(
      tenant.tenantId,
      tenant.userId,
      'Build Test App'
    );

    // Get current version
    const application = await prisma.application.findUnique({
      where: { id: app.applicationId },
    });

    expect(application?.currentVersionId).toBeDefined();

    const logEntries: any[] = [];
    const artifact = await BuildService.build(
      {
        applicationId: app.applicationId,
        versionId: application!.currentVersionId!,
        applicationName: application!.name,
        environmentName: 'development',
      },
      (entry) => logEntries.push(entry)
    );

    expect(artifact).toBeDefined();
    expect(artifact.id).toBeDefined();
    expect(artifact.checksum).toBeDefined();
    expect(artifact.sizeBytes).toBeGreaterThan(0);
    expect(logEntries.length).toBeGreaterThan(0);

    // Cleanup
    await BuildService.cleanup(artifact.id);
  });

  it('should reject build with wrong application', async () => {
    const tenantA = await createTestTenant('build-a');
    const tenantB = await createTestTenant('build-b');

    const appA = await createTestApplication(
      tenantA.tenantId,
      tenantA.userId,
      'App A'
    );

    const appB = await createTestApplication(
      tenantB.tenantId,
      tenantB.userId,
      'App B'
    );

    const applicationA = await prisma.application.findUnique({
      where: { id: appA.applicationId },
    });

    // Try to build appA's version but with appB's ID
    await expect(
      BuildService.build(
        {
          applicationId: appB.applicationId,
          versionId: applicationA!.currentVersionId!,
          applicationName: 'Test',
          environmentName: 'dev',
        },
        () => {}
      )
    ).rejects.toThrow('does not belong');
  });
});
