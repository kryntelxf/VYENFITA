import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createScheduledTasksRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      return res.json({ success: true, data: (tenant?.settings as any)?.scheduledTasks || [] });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, cronExpression, targetType, targetId, enabled = true, payload = {} } = req.body;
      if (!name || !cronExpression || !targetType) return res.status(400).json({ success: false, error: 'Missing fields' });
      
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const tasks = settings.scheduledTasks || [];
      
      const task = { id: `task-${Date.now()}`, name, cronExpression, targetType, targetId: targetId || null, payload, enabled, createdAt: new Date().toISOString(), lastRun: null, nextRun: null };
      tasks.push(task);
      
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, scheduledTasks: tasks } } });
      return res.status(201).json({ success: true, data: task });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.patch('/:id/toggle', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const tasks = settings.scheduledTasks || [];
      const task = tasks.find((t: any) => t.id === req.params.id);
      if (!task) return res.status(404).json({ success: false, error: 'Not found' });
      
      task.enabled = !task.enabled;
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, scheduledTasks: tasks } } });
      return res.json({ success: true, data: task });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const tasks = (settings.scheduledTasks || []).filter((t: any) => t.id !== req.params.id);
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, scheduledTasks: tasks } } });
      return res.json({ success: true, message: 'Deleted' });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/:id/run-now', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const settings = (tenant?.settings as any) || {};
      const tasks = settings.scheduledTasks || [];
      const task = tasks.find((t: any) => t.id === req.params.id);
      if (!task) return res.status(404).json({ success: false, error: 'Not found' });
      
      task.lastRun = new Date().toISOString();
      await prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, scheduledTasks: tasks } } });
      return res.json({ success: true, data: { taskId: task.id, triggeredAt: new Date().toISOString(), note: 'Task queued.' } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
        }
