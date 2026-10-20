import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createVersioningRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/applications/:id/versions', async (req: Request, res: Response) => {
    try {
      const app = await prisma.application.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null } });
      if (!app) return res.status(404).json({ success: false, error: 'Not found' });
      const versions = await prisma.applicationVersion.findMany({ where: { applicationId: app.id }, orderBy: { createdAt: 'desc' }, select: { id: true, version: true, changelog: true, isCurrent: true, createdAt: true } });
      return res.json({ success: true, data: versions, count: versions.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/applications/:id/versions/:versionId', async (req: Request, res: Response) => {
    try {
      const app = await prisma.application.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null } });
      if (!app) return res.status(404).json({ success: false, error: 'Not found' });
      const version = await prisma.applicationVersion.findFirst({ where: { id: req.params.versionId, applicationId: app.id } });
      if (!version) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: version });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/applications/:id/rollback/:versionId', async (req: Request, res: Response) => {
    try {
      const app = await prisma.application.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null } });
      if (!app) return res.status(404).json({ success: false, error: 'Not found' });
      const target = await prisma.applicationVersion.findFirst({ where: { id: req.params.versionId, applicationId: app.id } });
      if (!target) return res.status(404).json({ success: false, error: 'Not found' });
      
      const latest = await prisma.applicationVersion.findFirst({ where: { applicationId: app.id }, orderBy: { createdAt: 'desc' } });
      const [major, minor, patch] = latest ? latest.version.split('.').map(Number) : [1, 0, 0];
      const nextVersion = `${major}.${minor}.${patch + 1}`;

      const result = await prisma.$transaction(async (tx) => {
        await tx.applicationVersion.updateMany({ where: { applicationId: app.id }, data: { isCurrent: false } });
        const newVersion = await tx.applicationVersion.create({ data: { applicationId: app.id, version: nextVersion, spec: target.spec as any, changelog: `Rollback to ${target.version}`, createdBy: req.user!.userId, isCurrent: true } });
        const updated = await tx.application.update({ where: { id: app.id }, data: { currentVersionId: newVersion.id } });
        return { application: updated, version: newVersion };
      });
      return res.json({ success: true, data: result });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
  }
