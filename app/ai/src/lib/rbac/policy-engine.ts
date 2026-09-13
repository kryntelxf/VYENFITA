/**
 * VYENFITA Policy Engine
 * 
 * Attribute-Based Access Control (ABAC) + Policy-Based Access Control (PBAC).
 * 
 * Policies are JSON documents that evaluate:
 * - Subject attributes (user role, tenant, groups)
 * - Resource attributes (owner, tenant, sensitivity)
 * - Action
 * - Environment (time, IP)
 * 
 * Evaluation is: DENY by default, ALLOW only if policy permits.
 * 
 * @version 1.0.0
 */

export interface PolicyContext {
  subject: {
    userId: string;
    tenantId: string;
    roleId: string;
    roleName: string;
    permissions: string[];
    groups: string[];
    attributes: Record<string, any>;
  };
  resource: {
    type: string;
    id?: string;
    tenantId?: string;
    ownerId?: string;
    attributes: Record<string, any>;
  };
  action: string;
  environment: {
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
    hour: number;
    dayOfWeek: number;
  };
}

export interface PolicyStatement {
  effect: 'allow' | 'deny';
  actions: string[]; // e.g. ['application:read', 'application:*']
  resources: string[]; // e.g. ['application', 'application/*', '*']
  conditions?: PolicyCondition[];
}

export interface PolicyCondition {
  field: string; // e.g. 'subject.roleName', 'resource.ownerId'
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'lt' | 'between';
  value: any;
}

export interface Policy {
  id: string;
  name: string;
  description?: string;
  version: string;
  statements: PolicyStatement[];
}

export interface PolicyEvaluation {
  allowed: boolean;
  reason: string;
  matchedPolicy?: string;
  matchedStatement?: PolicyStatement;
}

export class PolicyEngine {
  /**
   * Evaluate a policy against a context
   */
  static evaluate(policy: Policy, context: PolicyContext): PolicyEvaluation {
    const statements = [...policy.statements].sort((a, b) => {
      // Deny statements take precedence
      if (a.effect === 'deny' && b.effect !== 'deny') return -1;
      if (a.effect !== 'deny' && b.effect === 'deny') return 1;
      return 0;
    });

    for (const statement of statements) {
      if (this.matchesStatement(statement, context)) {
        return {
          allowed: statement.effect === 'allow',
          reason: statement.effect === 'allow'
            ? `Allowed by policy "${policy.name}"`
            : `Denied by policy "${policy.name}"`,
          matchedPolicy: policy.name,
          matchedStatement: statement,
        };
      }
    }

    return {
      allowed: false,
      reason: 'No matching policy statement (default deny)',
    };
  }

  /**
   * Evaluate multiple policies (deny wins)
   */
  static evaluateAll(
    policies: Policy[],
    context: PolicyContext
  ): PolicyEvaluation {
    let finalResult: PolicyEvaluation = {
      allowed: false,
      reason: 'No policies defined (default deny)',
    };

    for (const policy of policies) {
      const result = this.evaluate(policy, context);

      // Any deny = final deny
      if (!result.allowed && result.matchedStatement) {
        return result;
      }

      // Any allow = remember it
      if (result.allowed) {
        finalResult = result;
      }
    }

    return finalResult;
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static matchesStatement(
    statement: PolicyStatement,
    context: PolicyContext
  ): boolean {
    // Check action
    if (!this.matchesPattern(context.action, statement.actions)) {
      return false;
    }

    // Check resource
    if (!this.matchesPattern(context.resource.type, statement.resources)) {
      return false;
    }

    // Check conditions
    if (statement.conditions) {
      for (const condition of statement.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    return true;
  }

  private static matchesPattern(value: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (pattern === '*') return true;
      if (pattern === value) return true;

      // Wildcard suffix: "application:*"
      if (pattern.endsWith(':*')) {
        const prefix = pattern.slice(0, -1);
        if (value.startsWith(prefix)) return true;
      }

      // Wildcard prefix: "*.read"
      if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(1);
        if (value.endsWith(suffix)) return true;
      }

      // Path wildcard: "application/*"
      if (pattern.includes('/*')) {
        const [prefix] = pattern.split('/*');
        if (value.startsWith(prefix + '/')) return true;
      }
    }

    return false;
  }

  private static evaluateCondition(
    condition: PolicyCondition,
    context: PolicyContext
  ): boolean {
    const actual = this.getFieldValue(condition.field, context);

    switch (condition.operator) {
      case 'eq':
        return actual === condition.value;
      case 'neq':
        return actual !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(actual);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(actual);
      case 'contains':
        if (Array.isArray(actual)) return actual.includes(condition.value);
        return String(actual).includes(String(condition.value));
      case 'starts_with':
        return String(actual).startsWith(String(condition.value));
      case 'ends_with':
        return String(actual).endsWith(String(condition.value));
      case 'gt':
        return Number(actual) > Number(condition.value);
      case 'lt':
        return Number(actual) < Number(condition.value);
      case 'between':
        return (
          Array.isArray(condition.value) &&
          Number(actual) >= Number(condition.value[0]) &&
          Number(actual) <= Number(condition.value[1])
        );
      default:
        return false;
    }
  }

  private static getFieldValue(field: string, context: PolicyContext): any {
    const parts = field.split('.');
    let current: any = context;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }

    return current;
  }
}

// ============================================================
// PREDEFINED POLICIES
// ============================================================

export const SYSTEM_POLICIES: Policy[] = [
  // Owner: full access
  {
    id: 'owner-full-access',
    name: 'Owner Full Access',
    version: '1.0.0',
    statements: [
      {
        effect: 'allow',
        actions: ['*'],
        resources: ['*'],
        conditions: [
          { field: 'subject.roleName', operator: 'eq', value: 'Owner' },
        ],
      },
    ],
  },
  // Admin: everything except billing
  {
    id: 'admin-access',
    name: 'Admin Access',
    version: '1.0.0',
    statements: [
      {
        effect: 'allow',
        actions: ['*'],
        resources: ['*'],
        conditions: [
          { field: 'subject.roleName', operator: 'eq', value: 'Admin' },
        ],
      },
      {
        effect: 'deny',
        actions: ['billing:*'],
        resources: ['billing'],
        conditions: [
          { field: 'subject.roleName', operator: 'eq', value: 'Admin' },
        ],
      },
    ],
  },
  // Tenant isolation: deny cross-tenant access
  {
    id: 'tenant-isolation',
    name: 'Tenant Isolation',
    version: '1.0.0',
    statements: [
      {
        effect: 'deny',
        actions: ['*'],
        resources: ['*'],
        conditions: [
          { field: 'resource.tenantId', operator: 'neq', value: '' }, // placeholder
        ],
      },
    ],
  },
];
