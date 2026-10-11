/**
 * VYENFITA Integration Registry Unit Tests
 * 
 * Verifies:
 * - Adapter registration
 * - Lookup by type
 * - Category filtering
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../lib/integrations/providers/salesforce.provider', () => ({
  SalesforceAdapter: class {
    readonly provider = {
      type: 'salesforce',
      name: 'Salesforce',
      category: 'crm',
      authScopes: [],
      capabilities: [],
      actions: [],
      triggers: [],
    };
  },
}));

jest.mock('../../../lib/integrations/providers/hubspot.provider', () => ({
  HubSpotAdapter: class {
    readonly provider = {
      type: 'hubspot',
      name: 'HubSpot',
      category: 'crm',
      authScopes: [],
      capabilities: [],
      actions: [],
      triggers: [],
    };
  },
}));

jest.mock('../../../lib/integrations/providers/slack.provider', () => ({
  SlackAdapter: class {
    readonly provider = {
      type: 'slack',
      name: 'Slack',
      category: 'communication',
      authScopes: [],
      capabilities: [],
      actions: [],
      triggers: [],
    };
  },
}));

jest.mock('../../../lib/integrations/providers/jira.provider', () => ({
  JiraAdapter: class {
    readonly provider = {
      type: 'jira',
      name: 'Jira',
      category: 'devtools',
      authScopes: [],
      capabilities: [],
      actions: [],
      triggers: [],
    };
  },
}));

import { IntegrationRegistry, getIntegrationRegistry } from '../../../lib/integrations/registry';

describe('IntegrationRegistry', () => {
  describe('constructor', () => {
    it('should register all 4 providers', () => {
      const registry = new IntegrationRegistry();
      const providers = registry.listProviders();
      expect(providers.length).toBe(4);
    });

    it('should include salesforce, hubspot, slack, jira', () => {
      const registry = new IntegrationRegistry();
      const types = registry.listProviders().map((p) => p.type);
      expect(types).toEqual(
        expect.arrayContaining(['salesforce', 'hubspot', 'slack', 'jira'])
      );
    });
  });

  describe('register() / get()', () => {
    it('should register custom adapter', () => {
      const registry = new IntegrationRegistry();
      const customAdapter: any = {
        provider: {
          type: 'zendesk',
          name: 'Zendesk',
          category: 'support',
          authScopes: [],
          capabilities: [],
          actions: [],
          triggers: [],
        },
      };

      registry.register(customAdapter);
      expect(registry.has('zendesk')).toBe(true);
      expect(registry.get('zendesk')).toBe(customAdapter);
    });

    it('should return undefined for unknown adapter', () => {
      const registry = new IntegrationRegistry();
      expect(registry.get('unknown' as any)).toBeUndefined();
    });

    it('should return false for has() on unknown adapter', () => {
      const registry = new IntegrationRegistry();
      expect(registry.has('unknown' as any)).toBe(false);
    });

    it('should override existing adapter on re-register', () => {
      const registry = new IntegrationRegistry();
      const replacement: any = {
        provider: { type: 'slack', name: 'Replaced Slack', category: 'communication' },
      };

      registry.register(replacement);
      expect(registry.get('slack')).toBe(replacement);
    });
  });

  describe('listProvidersByCategory()', () => {
    it('should filter crm providers', () => {
      const registry = new IntegrationRegistry();
      const crm = registry.listProvidersByCategory('crm');

      expect(crm.length).toBe(2);
      expect(crm.map((p) => p.type)).toEqual(
        expect.arrayContaining(['salesforce', 'hubspot'])
      );
    });

    it('should filter communication providers', () => {
      const registry = new IntegrationRegistry();
      const comm = registry.listProvidersByCategory('communication');

      expect(comm.length).toBe(1);
      expect(comm[0].type).toBe('slack');
    });

    it('should filter devtools providers', () => {
      const registry = new IntegrationRegistry();
      const devtools = registry.listProvidersByCategory('devtools');

      expect(devtools.length).toBe(1);
      expect(devtools[0].type).toBe('jira');
    });

    it('should return empty for unknown category', () => {
      const registry = new IntegrationRegistry();
      const result = registry.listProvidersByCategory('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('singleton', () => {
    it('should return same instance from getIntegrationRegistry()', () => {
      const a = getIntegrationRegistry();
      const b = getIntegrationRegistry();
      expect(a).toBe(b);
    });
  });
});
