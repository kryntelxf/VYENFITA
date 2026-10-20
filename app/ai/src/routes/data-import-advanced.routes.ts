import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createDataImportAdvancedRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.post('/users', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { users } = req.body;
      if (!Array.isArray(users)) return res.status(400).json({ success: false, error: 'users[] required' });

      const viewerRole = await prisma.role.findFirst({ where: { tenantId, name: 'Viewer' } });
      if (!viewerRole) return res.status(500).json({ success: false, error: 'Viewer role not found' });

      const results: any[] = [];
      for (const u of users) {
        try {
          if (!u.email) { results.push({ email: null, success: false, error: 'email required' }); continue; }
          let user = await prisma.user.findUnique({ where: { email: u.email.toLowerCase() } });
          if (!user) user = await prisma.user.create({ data: { email: u.email.toLowerCase(), name: u.name || null, status: 'active' } });
          
          const existing = await prisma.membership.findFirst({ where: { userId: user.id, tenantId, deletedAt: null } });
          if (existing) { results.push({ email: u.email, success: false, error: 'already exists' }); continue; }
          
          await prisma.membership.create({ data: { userId: user.id, tenantId, roleId: viewerRole.id, status: 'active', joinedAt: new Date() } });
          results.push({ email: u.email, success: true });
        } catch (e) { results.push({ email: u.email, success: false, error: 'Failed' }); }
      }
      return res.json({ success: true, data: { imported: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/applications', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { applications } = req.body;
      if (!Array.isArray(applications)) return res.status(400).json({ success: false, error: 'applications[] required' });

      const results: any[] = [];
      for (const a of applications) {
        try {
          if (!a.name) { results.push({ name: null, success: false, error: 'name required' }); continue; }
          const slug = `${a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await prisma.application.create({ data: { tenantId, name: a.name, description: a.description || null, slug, status: 'draft' } });
          results.push({ name: a.name, success: true });
        } catch (e) { results.push({ name: a.name, success: false, error: 'Failed' }); }
      }
      return res.json({ success: true, data: { imported: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const { type, data } = req.body;
      if (!type || !Array.isArray(data)) return res.status(400).json({ success: false, error: 'type and data[] required' });
      const errors: any[] = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (type === 'users' && !row.email) errors.push({ row: i, error: 'email required' });
        if (type === 'applications' && !row.name) errors.push({ row: i, error: 'name required' });
      }
      return res.json({ success: true, data: { type, total: data.length, valid: data.length - errors.length, errors } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
                                                   }
