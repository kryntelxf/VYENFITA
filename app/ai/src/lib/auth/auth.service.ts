/**
 * VYENFITA Authentication Service
 * 
 * Complete authentication flow:
 * - Register
 * - Login
 * - Logout
 * - Refresh token
 * - Password reset
 * 
 * @version 1.0.0
 */

import { prisma, withTransaction } from '../database/client';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { auditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  tenantSlug?: string;
  tenantName?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export class AuthService {
  /**
   * Register a new user with a new tenant
   */
  static async register(input: RegisterInput): Promise<AuthResult> {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password
    const passwordValidation = PasswordService.validate(input.password);
    if (!passwordValidation.valid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await PasswordService.hash(input.password);

    // Generate tenant slug if not provided
    const tenantSlug = input.tenantSlug || this.generateSlug(input.tenantName || input.email);
    const tenantName = input.tenantName || `${input.name}'s Organization`;

    // Check tenant slug uniqueness
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (existingTenant) {
      throw new Error('Tenant slug already exists');
    }

    // Create user, tenant, membership, role in transaction
    const result = await withTransaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name,
          emailVerified: false,
          status: 'active',
        },
      });

      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          slug: tenantSlug,
          name: tenantName,
          plan: 'free',
          status: 'active',
        },
      });

      // Create Owner role for this tenant (copy of system Owner role)
      const systemOwnerRole = await tx.role.findFirst({
        where: { tenantId: null, name: 'Owner' },
      });
      if (!systemOwnerRole) {
        throw new Error('System Owner role not found');
      }

      // Create tenant-specific Owner role
      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Owner',
          description: 'Full access to tenant, including billing',
          isSystem: false,
          isDefault: false,
        },
      });

      // Copy permissions from system Owner role
      const systemPermissions = await tx.rolePermission.findMany({
        where: { roleId: systemOwnerRole.id },
      });
      if (systemPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: systemPermissions.map((p) => ({
            roleId: ownerRole.id,
            permissionId: p.permissionId,
          })),
        });
      }

      // Create membership
      await tx.membership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: ownerRole.id,
          status: 'active',
          joinedAt: new Date(),
        },
      });

      return { user, tenant, role: ownerRole };
    });

    // Get permissions
    const permissions = await this.getRolePermissions(result.role.id);

    // Generate tokens
    const tokens = TokenService.generateTokenPair({
      userId: result.user.id,
      email: result.user.email,
      tenantId: result.tenant.id,
      roleId: result.role.id,
    });

    // Create session
    await SessionService.create({
      userId: result.user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.refreshExpiresIn * 1000),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    // Audit log
    await auditService.log({
      tenantId: result.tenant.id,
      userId: result.user.id,
      eventType: 'auth',
      action: 'register',
      resource: 'user',
      resourceId: result.user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      status: 'success',
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        emailVerified: result.user.emailVerified,
      },
      tenant: {
        id: result.tenant.id,
        slug: result.tenant.slug,
        name: result.tenant.name,
      },
      role: {
        id: result.role.id,
        name: result.role.name,
        permissions,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  /**
   * Login user
   */
  static async login(input: LoginInput): Promise<AuthResult> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    // Use constant-time response to prevent user enumeration
    if (!user || !user.passwordHash) {
      await PasswordService.verify('dummy', '$2a$12$dummy.hash.for.timing.attack.prevention');
      await auditService.log({
        tenantId: input.tenantId,
        eventType: 'auth',
        action: 'login',
        resource: 'user',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        status: 'failure',
        errorMessage: 'Invalid credentials',
      });
      throw new Error('Invalid credentials');
    }

    if (user.deletedAt) {
      throw new Error('Account has been deleted');
    }

    if (user.status !== 'active') {
      throw new Error('Account is not active');
    }

    // Verify password
    const passwordValid = await PasswordService.verify(input.password, user.passwordHash);
    if (!passwordValid) {
      await auditService.log({
        tenantId: input.tenantId,
        userId: user.id,
        eventType: 'auth',
        action: 'login',
        resource: 'user',
        resourceId: user.id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        status: 'failure',
        errorMessage: 'Invalid credentials',
      });
      throw new Error('Invalid credentials');
    }

    // Find membership
    const membership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: input.tenantId,
        },
      },
      include: {
        tenant: true,
        role: true,
      },
    });

    if (!membership || membership.deletedAt) {
      throw new Error('User is not a member of this tenant');
    }

    if (membership.status !== 'active') {
      throw new Error('Membership is not active');
    }

    if (membership.tenant.status !== 'active' || membership.tenant.deletedAt) {
      throw new Error('Tenant is not active');
    }

    // Get permissions
    const permissions = await this.getRolePermissions(membership.roleId);

    // Generate tokens
    const tokens = TokenService.generateTokenPair({
      userId: user.id,
      email: user.email,
      tenantId: membership.tenantId,
      roleId: membership.roleId,
    });

    // Create session
    await SessionService.create({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.refreshExpiresIn * 1000),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Audit log
    await auditService.log({
      tenantId: membership.tenantId,
      userId: user.id,
      eventType: 'auth',
      action: 'login',
      resource: 'user',
      resourceId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      status: 'success',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
      tenant: {
        id: membership.tenant.id,
        slug: membership.tenant.slug,
        name: membership.tenant.name,
      },
      role: {
        id: membership.role.id,
        name: membership.role.name,
        permissions,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  /**
   * Logout user (revoke current session)
   */
  static async logout(accessToken: string, userId: string, tenantId: string): Promise<void> {
    await SessionService.revoke(accessToken);

    await auditService.log({
      tenantId,
      userId,
      eventType: 'auth',
      action: 'logout',
      resource: 'user',
      resourceId: userId,
      status: 'success',
    });
  }

  /**
   * Refresh access token
   */
  static async refresh(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    // Verify refresh token
    const payload = TokenService.verifyRefreshToken(refreshToken);

    // Find session
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: {
        user: {
          include: {
            memberships: {
              where: { deletedAt: null },
              include: { role: true, tenant: true },
            },
          },
        },
      },
    });

    if (!session) {
      throw new Error('Invalid refresh token');
    }

    if (session.revokedAt) {
      // Possible token reuse attack - revoke all user sessions
      await SessionService.revokeAllForUser(payload.userId);
      throw new Error('Token has been revoked');
    }

    if (new Date() > session.expiresAt) {
      throw new Error('Refresh token expired');
    }

    // Get first active membership
    const membership = session.user.memberships.find(
      (m) => m.status === 'active' && m.tenant.status === 'active'
    );

    if (!membership) {
      throw new Error('No active membership found');
    }

    // Generate new tokens
    const tokens = TokenService.generateTokenPair({
      userId: session.user.id,
      email: session.user.email,
      tenantId: membership.tenantId,
      roleId: membership.roleId,
    });

    // Revoke old session
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Create new session
    await SessionService.create({
      userId: session.user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.refreshExpiresIn * 1000),
      ipAddress,
      userAgent,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  /**
   * Change password
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new Error('User not found');
    }

    const valid = await PasswordService.verify(currentPassword, user.passwordHash);
    if (!valid) {
      throw new Error('Current password is incorrect');
    }

    const validation = PasswordService.validate(newPassword);
    if (!validation.valid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    const newHash = await PasswordService.hash(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all sessions
    await SessionService.revokeAllForUser(userId);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private static async getRolePermissions(roleId: string): Promise<string[]> {
    const permissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });

    return permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`);
  }

  private static generateSlug(input: string): string {
    const base = input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    // Add random suffix to ensure uniqueness
    const suffix = uuidv4().substring(0, 8);
    return `${base}-${suffix}`;
  }
      }
