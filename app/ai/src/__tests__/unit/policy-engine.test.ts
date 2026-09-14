/**
 * VYENFITA Policy Engine Unit Tests
 * 
 * @version 1.0.0
 */

import {
  PolicyEngine,
  Policy,
  PolicyContext,
} from '../../lib/rbac/policy-engine';

describe('PolicyEngine', () => {
  const baseContext: PolicyContext = {
    subject: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      roleId: 'role-1',
      roleName: 'Editor',
      permissions: ['application:read'],
      groups: [],
      attributes: {},
    },
    resource: {
      type: 'application',
      id: 'app-1',
      tenantId: 'tenant-1',
      ownerId: 'user-1',
      attributes: {},
    },
    action: 'application:read',
    environment: {
      timestamp: new Date(),
      hour: 10,
      dayOfWeek: 1,
    },
  };

  describe('evaluate', () => {
    it('should allow when matching allow statement exists', () => {
      const policy: Policy = {
        id: 'p1',
        name: 'Test Policy',
        version: '1.0.0',
        statements: [
          {
            effect: 'allow',
            actions: ['application:read'],
            resources: ['application'],
          },
        ],
      };

      const result = PolicyEngine.evaluate(policy, baseContext);
      expect(result.allowed).toBe(true);
    });

    it('should deny when no statement matches (default deny)', () => {
      const policy: Policy = {
        id: 'p1',
        name: 'Test Policy',
        version: '1.0.0',
        statements: [
          {
            effect: 'allow',
            actions: ['workflow:read'],
            resources: ['workflow'],
          },
        ],
      };

      const result = PolicyEngine.evaluate(policy, baseContext);
      expect(result.allowed).toBe(false);
    });

    it('should let deny win over allow', () => {
      const policy: Policy = {
        id: 'p1',
        name: 'Test Policy',
        version: '1.0.0',
        statements: [
          {
            effect: 'allow',
            actions: ['*'],
            resources: ['*'],
          },
          {
            effect: 'deny',
            actions: ['application:delete'],
            resources: ['application'],
          },
        ],
      };

      const deleteContext: PolicyContext = {
        ...baseContext,
        action: 'application:delete',
      };

      const result = PolicyEngine.evaluate(policy, deleteContext);
      expect(result.allowed).toBe(false);
    });

    it('should support wildcard actions', () => {
      const policy: Policy = {
        id: 'p1',
        name: 'Test Policy',
        version: '1.0.0',
        statements: [
          {
            effect: 'allow',
            actions: ['application:*'],
            resources: ['application'],
          },
        ],
      };

      const result = PolicyEngine.evaluate(policy, baseContext);
      expect(result.allowed).toBe(true);
    });

    it('should evaluate conditions (eq)', () => {
      const policy: Policy = {
        id: 'p1',
        name: 'Test Policy',
        version: '1.0.0',
        statements: [
          {
            effect: 'allow',
            actions: ['application:read'],
            resources: ['application'],
            conditions: [
              { field: 'subject.roleName', operator: 'eq', value: 'Editor' },
            ],
          },
        ],
      };

      const result = PolicyEngine.evaluate(policy, baseContext);
      expect(result.allowed).toBe(true);

      // Change role
      const wrongContext = {
        ...baseContext,
        subject: { ...baseContext.subject, roleName: 'Viewer' },
      };
      const result2 = PolicyEngine.evaluate(policy, wrongContext);
      expect(result2.allowed).toBe(false);
    });

    it('should evaluate conditions (in)', () => {
      const policy: Policy = {
        id: 'p1',
        name: 'Test Policy',
        version: '1.0.0',
        statements: [
          {
            effect: 'allow',
            actions: ['application:read'],
            resources: ['application'],
            conditions: [
              {
                field: 'subject.roleName',
                operator: 'in',
                value: ['Editor', 'Admin', 'Owner'],
              },
            ],
          },
        ],
      };

      const result = PolicyEngine.evaluate(policy, baseContext);
      expect(result.allowed).toBe(true);
    });
  });

  describe('evaluateAll', () => {
    it('should deny if any policy explicitly denies', () => {
      const allowPolicy: Policy = {
        id: 'p1',
        name: 'Allow',
        version: '1.0.0',
        statements: [
          { effect: 'allow', actions: ['application:read'], resources: ['application'] },
        ],
      };

      const denyPolicy: Policy = {
        id: 'p2',
        name: 'Deny',
        version: '1.0.0',
        statements: [
          { effect: 'deny', actions: ['application:read'], resources: ['application'] },
        ],
      };

      const result = PolicyEngine.evaluateAll([allowPolicy, denyPolicy], baseContext);
      expect(result.allowed).toBe(false);
    });

    it('should allow if at least one policy allows and none deny', () => {
      const policy1: Policy = {
        id: 'p1',
        name: 'Policy 1',
        version: '1.0.0',
        statements: [
          { effect: 'allow', actions: ['workflow:read'], resources: ['workflow'] },
        ],
      };

      const policy2: Policy = {
        id: 'p2',
        name: 'Policy 2',
        version: '1.0.0',
        statements: [
          { effect: 'allow', actions: ['application:read'], resources: ['application'] },
        ],
      };

      const result = PolicyEngine.evaluateAll([policy1, policy2], baseContext);
      expect(result.allowed).toBe(true);
    });
  });
});
