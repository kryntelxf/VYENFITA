/**
 * VYENFITA Slack Adapter Unit Tests
 * 
 * Verifies:
 * - Provider metadata
 * - Authorization URL
 * - Token exchange
 * - Action input validation
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
import { SlackAdapter } from '../../../../lib/integrations/providers/slack.provider';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SlackAdapter', () => {
  let adapter: SlackAdapter;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SLACK_CLIENT_ID: 'test-client-id',
      SLACK_CLIENT_SECRET: 'test-client-secret',
    };
    adapter = new SlackAdapter();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('provider metadata', () => {
    it('should have correct type', () => {
      expect(adapter.provider.type).toBe('slack');
    });

    it('should have oauth2 auth type', () => {
      expect(adapter.provider.authType).toBe('oauth2');
    });

    it('should have chat:write scope', () => {
      expect(adapter.provider.authScopes).toContain('chat:write');
    });

    it('should have communication category', () => {
      expect(adapter.provider.category).toBe('communication');
    });

    it('should define actions', () => {
      const actionNames = adapter.provider.actions.map((a) => a.name);
      expect(actionNames).toContain('send_message');
      expect(actionNames).toContain('send_file');
      expect(actionNames).toContain('list_channels');
    });
  });

  describe('getAuthorizationUrl()', () => {
    it('should include client_id and state', async () => {
      const url = await adapter.getAuthorizationUrl(
        'tenant-1',
        'https://cb.example.com/slack',
        'state-abc'
      );

      expect(url).toContain('https://slack.com/oauth/v2/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=state-abc');
      expect(url).toContain('redirect_uri=');
    });

    it('should include scopes', async () => {
      const url = await adapter.getAuthorizationUrl('t1', 'https://cb', 'st');
      expect(url).toContain('scope=');
    });
  });

  describe('exchangeCode()', () => {
    it('should call Slack token endpoint with correct params', async () => {
      (mockedAxios.post as jest.Mock).mockResolvedValue({
        data: {
          ok: true,
          access_token: 'xoxb-test-token',
          scope: 'chat:write,channels:read',
        },
      });

      const result = await adapter.exchangeCode('auth-code', 'https://cb');

      expect(result.accessToken).toBe('xoxb-test-token');
      expect(result.scopes).toEqual(['chat:write', 'channels:read']);
    });

    it('should throw on Slack error response', async () => {
      (mockedAxios.post as jest.Mock).mockResolvedValue({
        data: { ok: false, error: 'invalid_code' },
      });

      await expect(adapter.exchangeCode('bad', 'https://cb')).rejects.toThrow(
        /invalid_code|exchange failed/
      );
    });

    it('should wrap axios error', async () => {
      (mockedAxios.post as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(adapter.exchangeCode('code', 'https://cb')).rejects.toThrow();
    });
  });

  describe('executeAction() - send_message', () => {
    it('should call chat.postMessage with channel and text', async () => {
      (mockedAxios.post as jest.Mock).mockResolvedValue({
        data: { ok: true, ts: '123.456', channel: 'C123' },
      });

      const result = await adapter.executeAction(
        'send_message',
        { channel: 'C123', text: 'Hello' },
        { accessTokenEncrypted: 'enc:xoxb-token' } as any
      );

      expect(result.success).toBe(true);
      expect(result.data.ts).toBe('123.456');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({ channel: 'C123', text: 'Hello' }),
        expect.any(Object)
      );
    });

    it('should throw on Slack error', async () => {
      (mockedAxios.post as jest.Mock).mockResolvedValue({
        data: { ok: false, error: 'channel_not_found' },
      });

      const result = await adapter.executeAction(
        'send_message',
        { channel: 'bad', text: 'Hi' },
        { accessTokenEncrypted: 'enc:xoxb' } as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('channel_not_found');
    });
  });

  describe('executeAction() - unknown action', () => {
    it('should return error for unknown action', async () => {
      const result = await adapter.executeAction(
        'unknown_action',
        {},
        { accessTokenEncrypted: 'enc:xoxb' } as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Unknown action/);
    });
  });

  describe('testConnection()', () => {
    it('should return healthy when Slack responds ok', async () => {
      (mockedAxios.get as jest.Mock).mockResolvedValue({
        data: { ok: true, user: 'bot' },
      });

      const result = await adapter.testConnection({
        accessTokenEncrypted: 'enc:xoxb',
      } as any);

      expect(result.healthy).toBe(true);
    });

    it('should return unhealthy on error', async () => {
      (mockedAxios.get as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

      const result = await adapter.testConnection({
        accessTokenEncrypted: 'enc:bad',
      } as any);

      expect(result.healthy).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
