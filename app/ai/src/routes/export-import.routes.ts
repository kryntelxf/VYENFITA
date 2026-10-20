import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createExportImportRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/export/application/:id', async (req: Request, res: Response) => {
    try {
      const app = await prisma.application.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null }, include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } } });
      if (!app) return res.status(404).json({ success: false, error: 'Not found' });
      const currentVersion = app.versions[0];
      const exportData = { metadata: { exportedAt: new Date().toISOString(), format: 'vyenfita-export-v1' }, application: { name: app.name, description: app.description, slug: app.slug, status: app.status }, spec: currentVersion?.spec || null, version: currentVersion?.version || '1.0.0' };
      res.setHeader('Content-Disposition', `attachment; filename="vyenfita-app-${app.slug}.json"`);
      return res.json(exportData);
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/import/application', async (req: Request, res: Response) => {
    try {
      const { application, spec } = req.body;
      if (!application || !application.name) return res.status(400).json({ success: false, error: 'Missing name' });
      const slug = `${application.slug || application.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
      
      const result = await prisma.$transaction(async (tx) => {
        const newApp = await tx.application.create({ data: { tenantId: req.user!.tenantId, name: application.name, description: application.description || null, slug, status: 'draft' } });
        const newVersion = await tx.applicationVersion.create({ data: { applicationId: newApp.id, version: '1.0.0', spec: spec || {}, changelog: 'Imported', createdBy: req.user!.userId, isCurrent: true } });
        const updated = await tx.application.update({ where: { id: newApp.id }, data: { currentVersionId: newVersion.id } });
        return { application: updated, version: newVersion };
      });
      return res.status(201).json({ success: true, data: result });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/export/workflow/:id', async (req: Request, res: Response) => {
    try {
      const wf = await prisma.workflow.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null }, include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } } });
      if (!wf) return res.status(404).json({ success: false, error: 'Not found' });
      const currentVersion = wf.versions[0];
      return res.json({ metadata: { exportedAt: new Date().toISOString(), format: 'vyenfita-export-v1' }, workflow: { name: wf.name, description: wf.description, slug: wf.slug, status: wf.status, triggers: wf.triggers }, definition: currentVersion?.definition || null, version: currentVersion?.version || '1.0.0' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/import/workflow', async (req: Request, res: Response) => {
    try {
      const { workflow, definition } = req.body;
      if (!workflow || !workflow.name) return res.status(400).json({ success: false, error: 'Missing name' });
      const slug = `${workflow.slug || workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
      
      const result = await prisma.$transaction(async (tx) => {
        const newWf = await tx.workflow.create({ data: { tenantId: req.user!.tenantId, name: workflow.name, description: workflow.description || null, slug, status: 'draft', triggers: workflow.triggers || [] } });
        const newVersion = await tx.workflowVersion.create({ data: { workflowId: newWf.id, version: '1.0.0', definition: definition || {}, changelog: 'Imported', createdBy: req.user!.userId, isCurrent: true } });
        const updated = await tx.workflow.update({ where: { id: newWf.id }, data: { currentVersionId: newVersion.id } });
        return { workflow: updated, version: newVersion };
      });
      return res.status(201).json({ success: true, data: result });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
              }
