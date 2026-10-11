/**
 * VYENFITA Salesforce Adapter Unit Tests
 * 
 * @version 1.0.0
 */

jest.mock('axios');
jest.mock('../../../../lib/security/secret.service', () => ({
  SecretService: jest.fn().mockImplementation(() => ({
    encrypt: jest.fn((v: string) => `enc:${v}`),
    decrypt: jest.fn((v: string) => v.replace('enc:', '')),
  })),
}));

jest.mock('../../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import axios from 'axios';
import { SalesforceAdapter } from '../../../../lib/integrations/providers/salesforce.provider';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SalesforceAdapter', () => {
  let adapter: SalesforceAdapter;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SALESFORCE_CLIENT_ID: 'sf-client-id',
      SALESFORCE_CLIENT_SECRET: 'sf-client-secret',
    };
    adapter = new SalesforceAdapter();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('provider metadata', () => {
    it('should have correct type', () => {
      expect(adapter.provider.type).toBe('salesforce');
    });

    it('should have crm category', () => {
      expect(adapter.provider.category).toBe('crm');
    });

    it('should have api scope', () => {
      expect(adapter.provider.authScopes).toContain('api');
    });

    it('should define actions for lead, opportunity, data', () => {
      const actions = adapter.provider.actions.map((a) => a.name);
      expect(actions).toContain('create_lead');
      expect(actions).toContain('update_lead');
      expect(actions).toContain('query');
      expect(actions).toContain('get_opportunities');
    });
  });

  describe('getAuthorizationUrl()', () => {
    it('should build correct URL', async () => {
      const url = await adapter.getAuthorizationUrl(
        'tenant-1',
        'https://cb.example.com/sf',
        'state-xyz'
      );

      expect(url).toContain('https://login.salesforce.com/services/oauth2/authorize');
      expect(url).toContain('client_id=sf-client-id');
      expect(url).toContain('state=state-xyz');
      expect(url).toContain('response_type=code');
    });
  });

  describe('exchangeCode()', () => {
    it('should return access and refresh tokens', async () => {
      (mockedAxios.post as jest.Mock).mockResolvedValue({
        data: {
          access_token: 'sf-access',
          refresh_token: 'sf-refresh',
          scope: 'api refresh_token',
        },
      });

      const result = await adapter.exchangeCode('code', 'https://cb');

      expect(result.accessToken).toBe('sf-access');
      expect(result.refreshToken).toBe('sf-refresh');
      expect(result.scopes).toContain('api');
    });

    it('should wrap error with description from Salesforce', async () => {
      (mockedAxios.post as jest.Mock).mockRejectedValue({
        response: { data: { error_description: 'invalid_grant' } },
        message: 'Request failed',
      });

      await expect(adapter.exchangeCode('bad', 'https://cb')).rejects.toThrow(
        /invalid_grant/
      );
    });
  });

  describe('executeAction() - query', () => {
    it('should reject non-SELECT query (safety)', async () => {
      const result = await adapter.executeAction(
        'query',
        { soql: "DELETE FROM Account" },
        {
          accessTokenEncrypted: 'enc:sf-token',
          config: { instanceUrl: 'https://test.salesforce.com' },
        } as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/SELECT/i);
    });

    it('should accept SELECT query', async () => {
      (mockedAxios.get as jest.Mock).mockResolvedValue({
        data: { records: [{ Id: '1' }], totalSize: 1, done: true },
      });

      const result = await adapter.executeAction(
        'query',
        { soql: 'SELECT Id FROM Account' },
        {
          accessTokenEncrypted: 'enc:sf-token',
          config: { instanceUrl: 'https://test.salesforce.com' },
        } as any
      );

      expect(result.success).toBe(true);
      expect(result.data.totalSize).toBe(1);
    });

    it('should be case-insensitive for SELECT check', async () => {
      (mockedAxios.get as jest.Mock).mockResolvedValue({
        data: { records: [], totalSize: 0, done: true },
      });

      const result = await adapter.executeAction(
        'query',
        { soql: 'select Id from Account' },
        {
          accessTokenEncrypted: 'enc:token',
          config: { instanceUrl: 'https://sf.test' },
        } as any
      );

      expect(result.success).toBe(true);
    });
  });

  describe('executeAction() - unknown action', () => {
    it('should reject unknown action', async () => {
      const result = await adapter.executeAction(
        'does_not_exist',
        {},
        {
          accessTokenEncrypted: 'enc:token',
          config: {},
        } as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Unknown action/);
    });
  });

  describe('testConnection()', () => {
    it('should return healthy on 200', async () => {
      (mockedAxios.get as jest.Mock).mockResolvedValue({ status: 200 });

      const result = await adapter.testConnection({
        accessTokenEncrypted: 'enc:token',
        config: { instanceUrl: 'https://sf.test' },
      } as any);

      expect(result.healthy).toBe(true);
    });

    it('should return unhealthy on network error', async () => {
      (mockedAxios.get as jest.Mock).mockRejectedValue(new Error('Timeout'));

      const result = await adapter.testConnection({
        accessTokenEncrypted: 'enc:token',
        config: { instanceUrl: 'https://sf.test' },
      } as any);

      expect(result.healthy).toBe(false);
    });
  });
});
