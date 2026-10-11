/**
 * VYENFITA Jira Adapter Unit Tests
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

import axios from 'axios';
import { JiraAdapter } from '../../../../lib/integrations/providers/jira.provider';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('JiraAdapter', () => {
  let adapter: JiraAdapter;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      JIRA_CLIENT_ID: 'jira-client-id',
      JIRA_CLIENT_SECRET: 'jira-client-secret',
    };
    adapter = new JiraAdapter();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('provider metadata', () => {
    it('should have jira type', () => {
      expect(adapter.provider.type).toBe('jira');
    });

    it('should have devtools category', () => {
      expect(adapter.provider.category).toBe('devtools');
    });

    it('should include jira scopes', () => {
      expect(adapter.provider.authScopes).toContain('read:jira-work');
      expect(adapter.provider.authScopes).toContain('write:jira-work');
    });

    it('should define issue actions', () => {
      const actions = adapter.provider.actions.map((a) => a.name);
      expect(actions).toContain('create_issue');
      expect(actions).toContain('search_issues');
    });
  });

  describe('getAuthorizationUrl()', () => {
    it('should use Atlassian auth endpoint', async () => {
      const url = await adapter.getAuthorizationUrl(
        't1',
        'https://cb.example.com/jira',
        'state-jira'
      );

      expect(url).toContain('https://auth.atlassian.com/authorize');
      expect(url).toContain('client_id=jira-client-id');
      expect(url).toContain('audience=api.atlassian.com');
      expect(url).toContain('state=state-jira');
    });
  });

  describe('executeAction() - missing cloudId', () => {
    it('should return error when cloudId missing', async () => {
      const result = await adapter.executeAction(
        'create_issue',
        { projectKey: 'PROJ', summary: 'Test' },
        { accessTokenEncrypted: 'enc:jira-token', config: {} } as any
      );

      expect(result.success).toBe(false);
    });
  });

  describe('executeAction() - create_issue', () => {
    it('should POST to Jira API when cloudId provided', async () => {
      (mockedAxios.post as jest.Mock).mockResolvedValue({
        data: { id: '10001', key: 'PROJ-1' },
      });

      const result = await adapter.executeAction(
        'create_issue',
        { projectKey: 'PROJ', summary: 'New issue' },
        {
          accessTokenEncrypted: 'enc:jira-token',
          config: { cloudId: 'cloud-abc' },
        } as any
      );

      expect(result.success).toBe(true);
      expect(result.data.issueKey).toBe('PROJ-1');
    });
  });

  describe('executeAction() - unknown action', () => {
    it('should return error', async () => {
      await expect(
        adapter.executeAction(
          'unknown',
          {},
          {
            accessTokenEncrypted: 'enc:token',
            config: { cloudId: 'cloud-abc' },
          } as any
        )
      ).rejects.toThrow(/Unknown action/);
    });
  });

  describe('testConnection()', () => {
    it('should return healthy on success', async () => {
      (mockedAxios.get as jest.Mock).mockResolvedValue({ status: 200 });

      const result = await adapter.testConnection({
        accessTokenEncrypted: 'enc:jira-token',
        config: { cloudId: 'cloud-abc' },
      } as any);

      expect(result.healthy).toBe(true);
    });

    it('should return unhealthy without cloudId', async () => {
      const result = await adapter.testConnection({
        accessTokenEncrypted: 'enc:jira-token',
        config: {},
      } as any);

      expect(result.healthy).toBe(false);
      expect(result.error).toMatch(/cloudId/);
    });
  });
});
