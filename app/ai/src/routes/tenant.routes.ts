/**
 * VYENFITA Tenant Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { TenantController } from '../controllers/tenant.controller';
import { PermissionMiddleware } from '../middleware/permission.middleware';

export function createTenantRouter(): Router {
  const router = Router();
  const controller = new TenantController();

  // Tenant info & settings
  router.get('/', (req, res) => controller.get(req, res));
  router.put(
    '/',
    PermissionMiddleware.require('settings:update'),
    (req, res) => controller.update(req, res)
  );

  router.get('/stats', (req, res) => controller.stats(req, res));

  // Members
  router.get(
    '/members',
    PermissionMiddleware.require('user:read'),
    (req, res) => controller.listMembers(req, res)
  );

  router.post(
    '/members/invite',
    PermissionMiddleware.require('user:invite'),
    (req, res) => controller.inviteMember(req, res)
  );

  router.put(
    '/members/:userId/role',
    PermissionMiddleware.require('user:update'),
    (req, res) => controller.updateMemberRole(req, res)
  );

  router.delete(
    '/members/:userId',
    PermissionMiddleware.require('user:delete'),
    (req, res) => controller.removeMember(req, res)
  );

  // Roles & permissions
  router.get('/roles', (req, res) => controller.listRoles(req, res));
  router.get('/permissions', (req, res) => controller.listPermissions(req, res));

  router.post(
    '/roles',
    PermissionMiddleware.require('role:create'),
    (req, res) => controller.createRole(req, res)
  );

  router.delete(
    '/roles/:roleId',
    PermissionMiddleware.require('role:delete'),
    (req, res) => controller.deleteRole(req, res)
  );

  return router;
}
