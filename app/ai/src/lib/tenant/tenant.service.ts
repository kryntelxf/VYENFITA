/**
 * VYENFITA Tenant Service
 * 
 * Business logic for tenants:
 * - Get current tenant
 * - Update tenant
 * - Get tenant stats
 * - Member management (invite, remove, change role)
 * 
 * @version 1.0.0
 */

import { prisma, withTransaction } from '../database/client';
import { tenantRepository } from '../database/repositories/tenant.repository';
import { userRepository } from '../database/repositories/user.repository';
import { membershipRepository } from '../database/repositories/membership.repository';
import { roleRepository } from '../database/repositories/role.repository';
import { auditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { v4 as uuidv4 } from 'uuid';

export interface InviteMemberParams {
  tenantId: string;
  invitedByUserId: string;
  email: string;
  roleId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateMemberRoleParams {
  tenantId: string;
  actorUserId: string;
  targetUserId: string;
  roleId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateTenantParams {
  tenantId: string;
  actorUserId: string;
  name?: string;
  description?: string;
  settings?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class TenantService {
  /**
   * Get tenant details
   */
  static async getById(tenantId: string): Promise<any> {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant || tenant.deletedAt) {
      throw new Error('Tenant not found');
    }
    return tenant;
  }

  /**
   * Update tenant
   */
  static async update(params: UpdateTenantParams): Promise<any> {
    const tenant = await tenantRepository.findById(params.tenantId);
    if (!tenant || tenant.deletedAt) {
      throw new Error('Tenant not found');
    }

    const updateData: any = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.settings !== undefined) updateData.settings = params.settings;

    const updated = await tenantRepository.update(params.tenantId, updateData);

    await auditService.log({
      tenantId: params.tenantId,
      userId: params.actorUserId,
      eventType: 'modify',
      action: 'tenant.update',
      resource: 'tenant',
      resourceId: params.tenantId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: { fields: Object.keys(updateData) },
      status: 'success',
    });

    return updated;
  }

  /**
   * Get tenant statistics
   */
  static async getStats(tenantId: string): Promise<any> {
    const [members, applications, workflows, audits] = await Promise.all([
      membershipRepository.countByTenant(tenantId),
      prisma.application.count({ where: { tenantId, deletedAt: null } }),
      prisma.workflow.count({ where: { tenantId, deletedAt: null } }),
      prisma.auditEvent.count({ where: { tenantId } }),
    ]);

    return {
      members,
      applications,
      workflows,
      auditEvents: audits,
    };
  }

  /**
   * List tenant members
   */
  static async listMembers(tenantId: string): Promise<any[]> {
    return membershipRepository.findByTenant(tenantId);
  }

  /**
   * Invite a member (creates user if not exists, adds membership)
   */
  static async inviteMember(params: InviteMemberParams): Promise<any> {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(params.email)) {
      throw new Error('Invalid email format');
    }

    // Verify role belongs to tenant (or is system role)
    const role = await roleRepository.findById(params.roleId);
    if (!role) {
      throw new Error('Role not found');
    }
    if (role.tenantId && role.tenantId !== params.tenantId) {
      throw new Error('Role does not belong to this tenant');
    }

    const result = await withTransaction(async (tx) => {
      // Find or create user
      let user = await tx.user.findUnique({
        where: { email: params.email.toLowerCase() },
      });

      let isNewUser = false;
      if (!user) {
        // Create user with random temporary password
        const tempPassword = uuidv4();
        const passwordHash = await PasswordService.hash(tempPassword);

        user = await tx.user.create({
          data: {
            email: params.email.toLowerCase(),
            passwordHash,
            name: params.email.split('@')[0],
            status: 'active',
            emailVerified: false,
          },
        });
        isNewUser = true;
      }

      // Check existing membership
      const existingMembership = await tx.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId: params.tenantId,
          },
        },
      });

      if (existingMembership && !existingMembership.deletedAt) {
        throw new Error('User is already a member of this tenant');
      }

      // Create or restore membership
      const membership = existingMembership
        ? await tx.membership.update({
            where: { id: existingMembership.id },
            data: {
              roleId: params.roleId,
              status: 'active',
              invitedBy: params.invitedByUserId,
              invitedAt: new Date(),
              joinedAt: new Date(),
              deletedAt: null,
            },
          })
        : await tx.membership.create({
            data: {
              userId: user.id,
              tenantId: params.tenantId,
              roleId: params.roleId,
              status: 'active',
              invitedBy: params.invitedByUserId,
              invitedAt: new Date(),
              joinedAt: new Date(),
            },
          });

      return { user, membership, isNewUser };
    });

    await auditService.log({
      tenantId: params.tenantId,
      userId: params.invitedByUserId,
      eventType: 'create',
      action: 'membership.invite',
      resource: 'membership',
      resourceId: result.membership.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: {
        email: params.email,
        roleId: params.roleId,
        isNewUser: result.isNewUser,
      },
      status: 'success',
    });

    return {
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      roleId: params.roleId,
      isNewUser: result.isNewUser,
    };
  }

  /**
   * Update member role
   */
  static async updateMemberRole(params: UpdateMemberRoleParams): Promise<any> {
    const membership = await membershipRepository.findOne({
      userId: params.targetUserId,
      tenantId: params.tenantId,
      deletedAt: null,
    } as any);

    if (!membership) {
      throw new Error('Membership not found');
    }

    const role = await roleRepository.findById(params.roleId);
    if (!role) {
      throw new Error('Role not found');
    }
    if (role.tenantId && role.tenantId !== params.tenantId) {
      throw new Error('Role does not belong to this tenant');
    }

    // Prevent changing owner role
    const currentRole = await roleRepository.findById(membership.roleId);
    if (currentRole?.name === 'Owner') {
      throw new Error('Cannot change role of tenant owner');
    }

    const updated = await membershipRepository.update(membership.id, {
      roleId: params.roleId,
    } as any);

    await auditService.log({
      tenantId: params.tenantId,
      userId: params.actorUserId,
      eventType: 'modify',
      action: 'membership.update_role',
      resource: 'membership',
      resourceId: membership.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: {
        targetUserId: params.targetUserId,
        oldRoleId: membership.roleId,
        newRoleId: params.roleId,
      },
      status: 'success',
    });

    return updated;
  }

  /**
   * Remove member
   */
  static async removeMember(
    tenantId: string,
    actorUserId: string,
    targetUserId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (actorUserId === targetUserId) {
      throw new Error('Cannot remove yourself from tenant');
    }

    const membership = await membershipRepository.findOne({
      userId: targetUserId,
      tenantId,
      deletedAt: null,
    } as any);

    if (!membership) {
      throw new Error('Membership not found');
    }

    const role = await roleRepository.findById(membership.roleId);
    if (role?.name === 'Owner') {
      throw new Error('Cannot remove tenant owner');
    }

    await membershipRepository.softDelete(membership.id);

    await auditService.log({
      tenantId,
      userId: actorUserId,
      eventType: 'delete',
      action: 'membership.remove',
      resource: 'membership',
      resourceId: membership.id,
      ipAddress,
      userAgent,
      details: { targetUserId },
      status: 'success',
    });
  }

  /**
   * List all roles available in tenant
   */
  static async listRoles(tenantId: string): Promise<any[]> {
    const roles = await roleRepository.findByTenant(tenantId);

    return roles.map((role: any) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isDefault: role.isDefault,
      permissions: role.permissions.map(
        (rp: any) => `${rp.permission.resource}:${rp.permission.action}`
      ),
    }));
  }

  /**
   * List all available permissions (system-wide)
   */
  static async listPermissions(): Promise<any[]> {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });

    return permissions.map((p) => ({
      id: p.id,
      resource: p.resource,
      action: p.action,
      description: p.description,
      key: `${p.resource}:${p.action}`,
    }));
  }

  /**
   * Create custom role
   */
  static async createRole(
    tenantId: string,
    actorUserId: string,
    name: string,
    description: string,
    permissions: string[],
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    if (!name || name.length < 1 || name.length > 100) {
      throw new Error('Role name must be between 1 and 100 characters');
    }

    // Prevent reserved names
    const reserved = ['Owner', 'Admin', 'Editor', 'Viewer'];
    if (reserved.includes(name)) {
      throw new Error(`Role name "${name}" is reserved`);
    }

    // Verify permissions exist
    const permissionRecords = await prisma.permission.findMany();
    const permissionMap = new Map(
      permissionRecords.map((p) => [`${p.resource}:${p.action}`, p.id])
    );

    const invalidPermissions = permissions.filter((p) => !permissionMap.has(p));
    if (invalidPermissions.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }

    // Check name uniqueness
    const existing = await roleRepository.findByName(tenantId, name);
    if (existing) {
      throw new Error('Role name already exists in this tenant');
    }

    const role = await withTransaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          tenantId,
          name,
          description,
          isSystem: false,
          isDefault: false,
        },
      });

      for (const permKey of permissions) {
        const permId = permissionMap.get(permKey);
        if (permId) {
          await tx.rolePermission.create({
            data: {
              roleId: newRole.id,
              permissionId: permId,
            },
          });
        }
      }

      return newRole;
    });

    await auditService.log({
      tenantId,
      userId: actorUserId,
      eventType: 'create',
      action: 'role.create',
      resource: 'role',
      resourceId: role.id,
      ipAddress,
      userAgent,
      details: { name, permissions },
      status: 'success',
    });

    return role;
  }

  /**
   * Delete custom role
   */
  static async deleteRole(
    tenantId: string,
    actorUserId: string,
    roleId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const role = await roleRepository.findById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }
    if (role.tenantId !== tenantId) {
      throw new Error('Role does not belong to this tenant');
    }
    if (role.isSystem) {
      throw new Error('Cannot delete system role');
    }

    // Check no members use this role
    const membersCount = await prisma.membership.count({
      where: { roleId, deletedAt: null },
    });
    if (membersCount > 0) {
      throw new Error(`Cannot delete role: ${membersCount} member(s) still use it`);
    }

    await prisma.role.delete({ where: { id: roleId } });

    await auditService.log({
      tenantId,
      userId: actorUserId,
      eventType: 'delete',
      action: 'role.delete',
      resource: 'role',
      resourceId: roleId,
      ipAddress,
      userAgent,
      details: { name: role.name },
      status: 'success',
    });
  }
  }
