import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createOrganizationRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/departments', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      const settings = (tenant?.settings as any) || {};
      return res.json({ success: true, data: settings.departments || [] });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/departments', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'name required' });
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const departments = settings.departments || [];
      const newDept = { id: `dept-${Date.now()}`, name, description: description || null, createdAt: new Date().toISOString() };
      departments.push(newDept);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, departments } } });
      return res.status(201).json({ success: true, data: newDept });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/departments/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const departments = (settings.departments || []).filter((d: any) => d.id !== req.params.id);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, departments } } });
      return res.json({ success: true, message: 'Deleted' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/teams', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      return res.json({ success: true, data: (tenant?.settings as any)?.teams || [] });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/teams', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, departmentId, memberIds = [] } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'name required' });
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const teams = settings.teams || [];
      const newTeam = { id: `team-${Date.now()}`, name, departmentId: departmentId || null, memberIds, createdAt: new Date().toISOString() };
      teams.push(newTeam);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, teams } } });
      return res.status(201).json({ success: true, data: newTeam });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
        }
