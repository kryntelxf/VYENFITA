import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database/client';
import { authenticate } from '../lib/auth/middleware';

export function createTenantRouter(): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenant = await prisma.tenant.findFirst({ where: { id: req.user!.tenantId, deletedAt: null } });
      if (!tenant) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: tenant });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.patch('/', async (req: Request, res: Response) => {
    try {
      const { name, description, settings } = req.body;
      const updated = await prisma.tenant.update({ where: { id: req.user!.tenantId }, data: { ...(name !== undefined && { name }), ...(description !== undefined && { description }), ...(settings !== undefined && { settings }) } });
      return res.json({ success: true, data: updated });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const [members, applications, workflows, deployments, auditEvents] = await Promise.all([
        prisma.membership.count({ where: { tenantId, deletedAt: null } }),
        prisma.application.count({ where: { tenantId, deletedAt: null } }),
        prisma.workflow.count({ where: { tenantId, deletedAt: null } }),
        prisma.deployment.count({ where: { tenantId } }),
        prisma.auditEvent.count({ where: { tenantId } }),
      ]);
      return res.json({ success: true, data: { members, applications, workflows, deployments, auditEvents } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/members', async (req: Request, res: Response) => {
    try {
      const members = await prisma.membership.findMany({ where: { tenantId: req.user!.tenantId, deletedAt: null }, include: { user: true, role: true } });
      return res.json({ success: true, data: members.map(m => ({ userId: m.userId, email: m.user.email, name: m.user.name, roleId: m.roleId, roleName: m.role.name, status: m.status })), count: members.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/members/invite', async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { email, roleId } = req.body;
      if (!email || !roleId) return res.status(400).json({ success: false, error: 'Missing fields' });
      const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
      if (!role) return res.status(400).json({ success: false, error: 'Invalid role' });
      
      let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user) user = await prisma.user.create({ data: { email: email.toLowerCase(), status: 'active', name: email.split('@')[0] } });
      
      const membership = await prisma.membership.create({ data: { userId: user.id, tenantId, roleId: role.id, status: 'active', invitedBy: req.user!.userId, invitedAt: new Date(), joinedAt: new Date() } });
      return res.status(201).json({ success: true, data: { email: user.email, roleName: role.name, status: membership.status } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.get('/roles', async (req: Request, res: Response) => {
    try {
      const roles = await prisma.role.findMany({ where: { tenantId: req.user!.tenantId }, include: { permissions: { include: { permission: true } } }, orderBy: { name: 'asc' } });
      return res.json({ success: true, data: roles.map(r => ({ id: r.id, name: r.name, isSystem: r.isSystem, permissions: r.permissions.map(p => `${p.permission.resource}:${p.permission.action}`) })), count: roles.length });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  return router;
        }
