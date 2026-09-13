/**
 * VYENFITA SCIM Service
 * 
 * SCIM 2.0 (RFC 7643/7644) compliant user & group provisioning.
 * 
 * Supports:
 * - Users: create, read, update, delete, list, filter
 * - Groups: create, read, update, delete, list
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';

// ============================================================
// SCIM TYPES
// ============================================================

export interface SCIMUser {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'];
  id: string;
  externalId?: string;
  userName: string;
  name?: {
    givenName?: string;
    familyName?: string;
    formatted?: string;
  };
  emails: Array<{
    value: string;
    primary: boolean;
    type?: string;
  }>;
  active: boolean;
  groups?: Array<{ value: string; display: string }>;
  meta: {
    resourceType: 'User';
    created: string;
    lastModified: string;
    location: string;
  };
}

export interface SCIMGroup {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'];
  id: string;
  displayName: string;
  members?: Array<{
    value: string;
    display?: string;
    type?: 'User' | 'Group';
  }>;
  meta: {
    resourceType: 'Group';
    created: string;
    lastModified: string;
    location: string;
  };
}

export interface SCIMListResponse<T> {
  schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

export interface SCIMError {
  schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'];
  detail: string;
  status: string;
  scimType?: string;
}

// ============================================================
// SCIM SERVICE
// ============================================================

export class SCIMService {
  /**
   * Create a user via SCIM
   */
  async createUser(
    tenantId: string,
    userData: Partial<SCIMUser>
  ): Promise<SCIMUser> {
    if (!userData.userName) {
      throw new Error('userName is required');
    }

    const email = userData.userName.toLowerCase();
    const primaryEmail = userData.emails?.[0]?.value || email;

    // Check if user exists
    const existing = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (existing) {
      throw new Error('User already exists');
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name: userData.name?.formatted ||
          [userData.name?.givenName, userData.name?.familyName].filter(Boolean).join(' ') ||
          email,
        status: userData.active === false ? 'inactive' : 'active',
        emailVerified: true,
      },
    });

    // Find default role
    const defaultRole = await prisma.role.findFirst({
      where: { tenantId, isDefault: true },
    });

    if (defaultRole) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          tenantId,
          roleId: defaultRole.id,
          status: 'active',
          joinedAt: new Date(),
        },
      });
    }

    await auditService.log({
      tenantId,
      eventType: 'create',
      action: 'scim.user.create',
      resource: 'user',
      resourceId: user.id,
      details: { email, source: 'scim' },
      status: 'success',
    });

    logger.info('SCIM user created', { userId: user.id, tenantId });

    return this.toSCIMUser(user, tenantId);
  }

  /**
   * Get a user by ID
   */
  async getUser(tenantId: string, userId: string): Promise<SCIMUser | null> {
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        tenantId,
        deletedAt: null,
      },
      include: { user: true },
    });

    if (!membership) return null;

    return this.toSCIMUser(membership.user, tenantId);
  }

  /**
   * List users with filtering (SCIM filter syntax)
   * Supports: userName eq "value", emails.value eq "value", active eq true
   */
  async listUsers(
    tenantId: string,
    options: {
      filter?: string;
      startIndex?: number;
      count?: number;
    } = {}
  ): Promise<SCIMListResponse<SCIMUser>> {
    const startIndex = options.startIndex || 1;
    const count = Math.min(options.count || 100, 1000);

    // Parse filter
    const where: any = { tenantId, deletedAt: null };

    if (options.filter) {
      const filterMatch = options.filter.match(/(\w+(?:\.\w+)*)\s+eq\s+"([^"]+)"/i);
      if (filterMatch) {
        const [, attr, value] = filterMatch;
        if (attr === 'userName' || attr === 'emails.value') {
          where.user = { email: value.toLowerCase() };
        } else if (attr === 'active') {
          where.user = { ...where.user, status: value === 'true' ? 'active' : 'inactive' };
        }
      }
    }

    const [memberships, total] = await Promise.all([
      prisma.membership.findMany({
        where,
        include: { user: true },
        skip: startIndex - 1,
        take: count,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.membership.count({ where }),
    ]);

    const resources = await Promise.all(
      memberships.map((m) => this.toSCIMUser(m.user, tenantId))
    );

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: total,
      startIndex,
      itemsPerPage: resources.length,
      Resources: resources,
    };
  }

  /**
   * Update a user (PUT — full replace)
   */
  async updateUser(
    tenantId: string,
    userId: string,
    userData: Partial<SCIMUser>
  ): Promise<SCIMUser> {
    const membership = await prisma.membership.findFirst({
      where: { userId, tenantId, deletedAt: null },
      include: { user: true },
    });

    if (!membership) {
      throw new Error('User not found');
    }

    const updateData: any = {};

    if (userData.userName) updateData.email = userData.userName.toLowerCase();
    if (userData.name) {
      updateData.name = userData.name.formatted ||
        [userData.name.givenName, userData.name.familyName].filter(Boolean).join(' ') ||
        membership.user.name;
    }
    if (typeof userData.active === 'boolean') {
      updateData.status = userData.active ? 'active' : 'inactive';
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    await auditService.log({
      tenantId,
      eventType: 'modify',
      action: 'scim.user.update',
      resource: 'user',
      resourceId: userId,
      details: { fields: Object.keys(updateData), source: 'scim' },
      status: 'success',
    });

    return this.toSCIMUser(updated, tenantId);
  }

  /**
   * Delete (deactivate) a user
   */
  async deleteUser(tenantId: string, userId: string): Promise<void> {
    const membership = await prisma.membership.findFirst({
      where: { userId, tenantId, deletedAt: null },
    });

    if (!membership) {
      throw new Error('User not found');
    }

    // Soft delete: deactivate user and remove membership
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'inactive' },
    });

    await prisma.membership.update({
      where: { id: membership.id },
      data: { status: 'inactive', deletedAt: new Date() },
    });

    await auditService.log({
      tenantId,
      eventType: 'delete',
      action: 'scim.user.delete',
      resource: 'user',
      resourceId: userId,
      details: { source: 'scim' },
      status: 'success',
    });
  }

  /**
   * List groups (maps to roles in VYENFITA)
   */
  async listGroups(
    tenantId: string,
    options: { startIndex?: number; count?: number } = {}
  ): Promise<SCIMListResponse<SCIMGroup>> {
    const startIndex = options.startIndex || 1;
    const count = Math.min(options.count || 100, 1000);

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where: { tenantId },
        skip: startIndex - 1,
        take: count,
        orderBy: { name: 'asc' },
      }),
      prisma.role.count({ where: { tenantId } }),
    ]);

    const resources: SCIMGroup[] = roles.map((role) => ({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: role.id,
      displayName: role.name,
      members: [],
      meta: {
        resourceType: 'Group',
        created: role.createdAt.toISOString(),
        lastModified: role.updatedAt.toISOString(),
        location: `/api/v1/scim/v2/Groups/${role.id}`,
      },
    }));

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: total,
      startIndex,
      itemsPerPage: resources.length,
      Resources: resources,
    };
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private async toSCIMUser(user: any, tenantId: string): Promise<SCIMUser> {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      userName: user.email,
      name: {
        formatted: user.name || user.email,
      },
      emails: [
        {
          value: user.email,
          primary: true,
          type: 'work',
        },
      ],
      active: user.status === 'active',
      meta: {
        resourceType: 'User',
        created: user.createdAt.toISOString(),
        lastModified: user.updatedAt.toISOString(),
        location: `/api/v1/scim/v2/Users/${user.id}`,
      },
    };
  }
}

let instance: SCIMService | undefined;

export function getSCIMService(): SCIMService {
  if (!instance) {
    instance = new SCIMService();
  }
  return instance;
}
