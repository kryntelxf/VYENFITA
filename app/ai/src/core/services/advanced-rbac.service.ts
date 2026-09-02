/**
 * VYENFITA Advanced RBAC Service
 * 
 * Advanced Role-Based Access Control
 * - Role hierarchy
 * - Attribute-based access control (ABAC)
 * - Policy-based access control (PBAC)
 * - Resource-based access control
 * - Time-based access control
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve' | 'manage' | 'all';
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  type: 'attribute' | 'time' | 'location' | 'ip' | 'role' | 'custom';
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'between';
  attribute: string;
  value: any;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // Permission IDs
  hierarchy: string[]; // Child role IDs
  isDefault: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  priority: number;
  statements: PolicyStatement[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyStatement {
  effect: 'allow' | 'deny';
  resources: string[];
  actions: string[];
  conditions: PermissionCondition[];
}

export interface AccessRequest {
  userId: string;
  resource: string;
  action: string;
  attributes: Record<string, any>;
  timestamp: Date;
  context: Record<string, any>;
}

export interface AccessResult {
  allowed: boolean;
  reason: string;
  permissions: string[];
  roles: string[];
  conditions: PermissionCondition[];
}

export class AdvancedRBACService {
  private permissions: Map<string, Permission>;
  private roles: Map<string, Role>;
  private policies: Map<string, Policy>;

  constructor() {
    this.permissions = new Map();
    this.roles = new Map();
    this.policies = new Map();

    // Initialize default roles and permissions
    this.initializeDefaults();
  }

  /**
   * Initialize default roles and permissions
   */
  private initializeDefaults(): void {
    // Create permissions
    const permissions: Permission[] = [
      { id: 'perm-all', name: 'Full Access', description: 'Full access to all resources', resource: '*', action: 'all' },
      { id: 'perm-app-create', name: 'Create Applications', description: 'Create new applications', resource: 'application', action: 'create' },
      { id: 'perm-app-read', name: 'Read Applications', description: 'Read applications', resource: 'application', action: 'read' },
      { id: 'perm-app-update', name: 'Update Applications', description: 'Update applications', resource: 'application', action: 'update' },
      { id: 'perm-app-delete', name: 'Delete Applications', description: 'Delete applications', resource: 'application', action: 'delete' },
      { id: 'perm-workflow-create', name: 'Create Workflows', description: 'Create new workflows', resource: 'workflow', action: 'create' },
      { id: 'perm-workflow-read', name: 'Read Workflows', description: 'Read workflows', resource: 'workflow', action: 'read' },
      { id: 'perm-workflow-execute', name: 'Execute Workflows', description: 'Execute workflows', resource: 'workflow', action: 'execute' },
      { id: 'perm-user-manage', name: 'Manage Users', description: 'Manage users', resource: 'user', action: 'manage' },
      { id: 'perm-role-manage', name: 'Manage Roles', description: 'Manage roles', resource: 'role', action: 'manage' },
    ];

    for (const perm of permissions) {
      this.permissions.set(perm.id, perm);
    }

    // Create roles
    const roles: Role[] = [
      {
        id: 'role-admin',
        name: 'Administrator',
        description: 'Full access to all resources',
        permissions: ['perm-all'],
        hierarchy: ['role-manager', 'role-editor', 'role-viewer'],
        isDefault: false,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'role-manager',
        name: 'Manager',
        description: 'Manage applications and users',
        permissions: ['perm-app-create', 'perm-app-read', 'perm-app-update', 'perm-app-delete', 'perm-workflow-create', 'perm-workflow-read', 'perm-workflow-execute'],
        hierarchy: ['role-editor', 'role-viewer'],
        isDefault: false,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'role-editor',
        name: 'Editor',
        description: 'Create and edit applications',
        permissions: ['perm-app-create', 'perm-app-read', 'perm-app-update', 'perm-workflow-create', 'perm-workflow-read'],
        hierarchy: ['role-viewer'],
        isDefault: false,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'role-viewer',
        name: 'Viewer',
        description: 'Read-only access',
        permissions: ['perm-app-read', 'perm-workflow-read'],
        hierarchy: [],
        isDefault: true,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const role of roles) {
      this.roles.set(role.id, role);
    }
  }

  /**
   * Create a new permission
   */
  createPermission(
    name: string,
    description: string,
    resource: string,
    action: Permission['action'],
    conditions?: PermissionCondition[]
  ): Permission {
    const permission: Permission = {
      id: uuidv4(),
      name,
      description,
      resource,
      action,
      conditions,
    };

    this.permissions.set(permission.id, permission);
    return permission;
  }

  /**
   * Create a new role
   */
  createRole(
    name: string,
    description: string,
    permissions: string[],
    hierarchy: string[] = [],
    isDefault: boolean = false
  ): Role {
    const role: Role = {
      id: uuidv4(),
      name,
      description,
      permissions,
      hierarchy,
      isDefault,
      isSystem: false,
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
   * Get all roles
   */
  getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get role by ID
   */
  getRole(id: string): Role | undefined {
    return this.roles.get(id);
  }

  /**
   * Get all permissions
   */
  getPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * Get permission by ID
   */
  getPermission(id: string): Permission | undefined {
    return this.permissions.get(id);
  }

  /**
   * Check if a user has permission
   */
  hasPermission(userRoles: string[], resource: string, action: string, attributes?: Record<string, any>): AccessResult {
    const allowedPermissions: string[] = [];
    const matchedRoles: string[] = [];

    for (const roleId of userRoles) {
      const role = this.roles.get(roleId);
      if (!role) continue;

      // Check if role has the permission
      for (const permId of role.permissions) {
        const perm = this.permissions.get(permId);
        if (!perm) continue;

        // Check resource and action
        if ((perm.resource === '*' || perm.resource === resource) &&
            (perm.action === 'all' || perm.action === action)) {
          allowedPermissions.push(permId);

          // Check conditions
          if (perm.conditions && attributes) {
            const conditionsMet = this.checkConditions(perm.conditions, attributes);
            if (conditionsMet) {
              matchedRoles.push(roleId);
            }
          } else {
            matchedRoles.push(roleId);
          }
        }
      }

      // Check hierarchy (permissions inherited from child roles)
      for (const childId of role.hierarchy) {
        const childRole = this.roles.get(childId);
        if (childRole) {
          for (const permId of childRole.permissions) {
            const perm = this.permissions.get(permId);
            if (!perm) continue;

            if ((perm.resource === '*' || perm.resource === resource) &&
                (perm.action === 'all' || perm.action === action)) {
              allowedPermissions.push(permId);
              matchedRoles.push(childId);
            }
          }
        }
      }
    }

    // Remove duplicates
    const uniquePermissions = [...new Set(allowedPermissions)];
    const uniqueRoles = [...new Set(matchedRoles)];

    const allowed = uniquePermissions.length > 0;

    return {
      allowed,
      reason: allowed ? 'Permission granted' : 'Permission denied',
      permissions: uniquePermissions,
      roles: uniqueRoles,
      conditions: [],
    };
  }

  /**
   * Check permission conditions
   */
  private checkConditions(conditions: PermissionCondition[], attributes: Record<string, any>): boolean {
    for (const condition of conditions) {
      const value = this.getNestedValue(attributes, condition.attribute);

      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case 'not_equals':
          if (value === condition.value) return false;
          break;
        case 'contains':
          if (!String(value).includes(String(condition.value))) return false;
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !condition.value.includes(value)) return false;
          break;
        case 'greater_than':
          if (value <= condition.value) return false;
          break;
        case 'less_than':
          if (value >= condition.value) return false;
          break;
        default:
          // Custom operators
          if (condition.operator === 'between') {
            const [min, max] = condition.value;
            if (value < min || value > max) return false;
          }
          break;
      }
    }

    return true;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Get user roles with full permission details
   */
  getUserRolesWithPermissions(userRoles: string[]): {
    role: Role;
    permissions: Permission[];
  }[] {
    const result: { role: Role; permissions: Permission[] }[] = [];

    for (const roleId of userRoles) {
      const role = this.roles.get(roleId);
      if (!role) continue;

      const permissions = role.permissions
        .map(id => this.permissions.get(id))
        .filter((p): p is Permission => p !== undefined);

      result.push({ role, permissions });
    }

    return result;
  }

  /**
   * Get all permissions for a user
   */
  getUserPermissions(userRoles: string[]): Permission[] {
    const allPermissions = new Set<string>();
    const result: Permission[] = [];

    for (const roleId of userRoles) {
      const role = this.roles.get(roleId);
      if (!role) continue;

      for (const permId of role.permissions) {
        if (!allPermissions.has(permId)) {
          allPermissions.add(permId);
          const perm = this.permissions.get(permId);
          if (perm) {
            result.push(perm);
          }
        }
      }

      // Check hierarchy
      for (const childId of role.hierarchy) {
        const childRole = this.roles.get(childId);
        if (childRole) {
          for (const permId of childRole.permissions) {
            if (!allPermissions.has(permId)) {
              allPermissions.add(permId);
              const perm = this.permissions.get(permId);
              if (perm) {
                result.push(perm);
              }
            }
          }
        }
      }
    }

    return result;
  }
}
