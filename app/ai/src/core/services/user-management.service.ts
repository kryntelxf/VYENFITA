/**
 * VYENFITA User Management Service
 * 
 * Manages users, roles, and permissions
 * - User CRUD operations
 * - Role management
 * - Permission management
 * - User authentication
 * - User sessions
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  tenantId: string;
  status: 'active' | 'inactive' | 'suspended';
  emailVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve' | 'manage';
  conditions?: string[];
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export class UserManagementService {
  private users: Map<string, User>;
  private roles: Map<string, Role>;
  private sessions: Map<string, Session>;
  private jwtSecret: string;

  constructor(jwtSecret: string = process.env.JWT_SECRET || 'vyenfita-secret-key') {
    this.users = new Map();
    this.roles = new Map();
    this.sessions = new Map();
    this.jwtSecret = jwtSecret;

    // Initialize default roles
    this.initializeDefaultRoles();
  }

  /**
   * Initialize default roles
   */
  private initializeDefaultRoles(): void {
    // Admin role
    this.roles.set('admin', {
      id: 'admin',
      name: 'Admin',
      description: 'Full access to all resources',
      permissions: [
        { id: 'perm-1', resource: '*', action: 'manage' },
      ],
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Editor role
    this.roles.set('editor', {
      id: 'editor',
      name: 'Editor',
      description: 'Can create and modify resources',
      permissions: [
        { id: 'perm-2', resource: 'applications', action: 'create' },
        { id: 'perm-3', resource: 'applications', action: 'read' },
        { id: 'perm-4', resource: 'applications', action: 'update' },
        { id: 'perm-5', resource: 'workflows', action: 'create' },
        { id: 'perm-6', resource: 'workflows', action: 'read' },
        { id: 'perm-7', resource: 'workflows', action: 'update' },
      ],
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Viewer role
    this.roles.set('viewer', {
      id: 'viewer',
      name: 'Viewer',
      description: 'Read-only access',
      permissions: [
        { id: 'perm-8', resource: 'applications', action: 'read' },
        { id: 'perm-9', resource: 'workflows', action: 'read' },
        { id: 'perm-10', resource: 'reports', action: 'read' },
      ],
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Create a new user
   */
  async createUser(
    email: string,
    password: string,
    name: string,
    tenantId: string,
    role: string = 'viewer'
  ): Promise<User> {
    // Check if user already exists
    for (const user of this.users.values()) {
      if (user.email === email) {
        throw new Error('User already exists');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user: User = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      name,
      role,
      tenantId,
      status: 'active',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    };

    this.users.set(user.id, user);
    return user;
  }

  /**
   * Authenticate a user
   */
  async authenticate(email: string, password: string): Promise<{ user: User; token: string }> {
    // Find user by email
    let foundUser: User | undefined;
    for (const user of this.users.values()) {
      if (user.email === email) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      throw new Error('Invalid credentials');
    }

    if (foundUser.status !== 'active') {
      throw new Error('Account is not active');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, foundUser.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    foundUser.lastLogin = new Date();
    this.users.set(foundUser.id, foundUser);

    // Create session
    const token = jwt.sign(
      { userId: foundUser.id, email: foundUser.email, tenantId: foundUser.tenantId, role: foundUser.role },
      this.jwtSecret,
      { expiresIn: '7d' }
    );

    const session: Session = {
      id: uuidv4(),
      userId: foundUser.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    this.sessions.set(session.id, session);

    return { user: foundUser, token };
  }

  /**
   * Validate a token
   */
  validateToken(token: string): { userId: string; email: string; tenantId: string; role: string } | null {
    try {
      return jwt.verify(token, this.jwtSecret) as any;
    } catch {
      return null;
    }
  }

  /**
   * Get a user by ID
   */
  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  /**
   * Get all users
   */
  getUsers(): User[] {
    return Array.from(this.users.values());
  }

  /**
   * Get users by tenant
   */
  getUsersByTenant(tenantId: string): User[] {
    const result: User[] = [];
    for (const user of this.users.values()) {
      if (user.tenantId === tenantId) {
        result.push(user);
      }
    }
    return result;
  }

  /**
   * Update a user
   */
  updateUser(id: string, updates: Partial<User>): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;

    if (updates.password) {
      updates.password = bcrypt.hashSync(updates.password, 10);
    }

    Object.assign(user, updates);
    user.updatedAt = new Date();
    this.users.set(id, user);
    return user;
  }

  /**
   * Delete a user
   */
  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }

  /**
   * Get a role by ID
   */
  getRole(id: string): Role | undefined {
    return this.roles.get(id);
  }

  /**
   * Get all roles
   */
  getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Create a new role
   */
  createRole(name: string, description: string, permissions: Permission[]): Role {
    const role: Role = {
      id: uuidv4(),
      name,
      description,
      permissions,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.roles.set(role.id, role);
    return role;
  }

  /**
   * Update a role
   */
  updateRole(id: string, updates: Partial<Role>): Role | undefined {
    const role = this.roles.get(id);
    if (!role) return undefined;

    Object.assign(role, updates);
    role.updatedAt = new Date();
    this.roles.set(id, role);
    return role;
  }

  /**
   * Delete a role
   */
  deleteRole(id: string): boolean {
    return this.roles.delete(id);
  }

  /**
   * Check if a user has permission
   */
  hasPermission(userId: string, resource: string, action: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    const role = this.roles.get(user.role);
    if (!role) return false;

    // Admin has all permissions
    if (role.id === 'admin') return true;

    for (const permission of role.permissions) {
      if (permission.resource === '*' || permission.resource === resource) {
        if (permission.action === 'manage' || permission.action === action) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get all sessions for a user
   */
  getSessions(userId: string): Session[] {
    const result: Session[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        result.push(session);
      }
    }
    return result;
  }

  /**
   * Revoke a session
   */
  revokeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Revoke all sessions for a user
   */
  revokeAllSessions(userId: string): number {
    let count = 0;
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Change password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) return false;

    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedAt = new Date();
    this.users.set(userId, user);

    // Revoke all sessions on password change
    this.revokeAllSessions(userId);

    return true;
  }

  /**
   * Reset password (admin only)
   */
  async resetPassword(userId: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedAt = new Date();
    this.users.set(userId, user);

    // Revoke all sessions on password reset
    this.revokeAllSessions(userId);

    return true;
  }
}
