/**
 * VYENFITA HubSpot Adapter Unit Tests
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
import { HubSpotAdapter } from '../../../../lib/integrations/providers/hubspot.provider';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HubSpotAdapter', () => {
  let adapter: HubSpotAdapter;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      HUBSPOT_CLIENT_ID: 'hs-client-id',
      HUBSPOT_CLIENT_SECRET: 'hs-client-secret',
    };
    adapter = new HubSpotAdapter();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('provider metadata', () => {
    it('should have hubspot type', () => {
      expect(adapter.provider.type).toBe('hubspot');
    });

    it('should have crm category', () => {
      expect(adapter.provider.category).toBe('crm');
    });

    it('should define contact and deal actions', () => {
      const actions = adapter.provider.actions.map((a) => a.name);
      expect(actions).toContain('create_contact');
      expect(actions).toContain('get_contacts');
      expect(actions).toContain('get_deals');
    });
  });

  describe('getAuthorizationUrl()', () => {
    it('should include required params', async () => {
      const url = await adapter.getAuthorizationUrl(
        't1',
        'https://cb.example.com/hs',
        'state-hs'
      );

      expect(url).toContain('https://app.hubspot.com/oauth/authorize');
      expect(url).toContain('client_id=hs-client-id');
      expect(url).toContain('state=state-hs');
    });
  });

  describe('exchangeCode()', () => {
    it('should extract access token and expiry', async () => {
      (mockedAxios.post as jest.Mock).mockResolvedValue({
        data: {
          access_token: 'hs-access',
          refresh_token: 'hs-refresh',
          expires_in: 3600,
        },
      });

      const result = await adapter.exchangeCode('code', 'https://cb');

      expect(result.accessToken).toBe('hs-access');
      expect(result.refreshToken).toBe('hs-refresh');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('executeAction() - create_contact', () => {
    it('should POST to HubSpot contacts endpoint', async () => {
      (mockedAxios.post as jest.Mock).mockResolvedValue({
        data: { id: 'contact-1' },
      });

      const result = await adapter.executeAction(
        'create_contact',
        { email: 'test@example.com', firstName: 'Test' },
        { accessTokenEncrypted: 'enc:hs-token' } as any
      );

      expect(result.success).toBe(true);
      expect(result.data.contactId).toBe('contact-1');
    });
  });

  describe('executeAction() - unknown action', () => {
    it('should return error', async () => {
      const result = await adapter.executeAction(
        'not_defined',
        {},
        { accessTokenEncrypted: 'enc:token' } as any
      );

      expect(result.success).toBe(false);
    });
  });

  describe('testConnection()', () => {
    it('should be healthy when HubSpot responds', async () => {
      (mockedAxios.get as jest.Mock).mockResolvedValue({ status: 200 });

      const result = await adapter.testConnection({
        accessTokenEncrypted: 'enc:hs-token',
      } as any);

      expect(result.healthy).toBe(true);
    });

    it('should be unhealthy on error', async () => {
      (mockedAxios.get as jest.Mock).mockRejectedValue(new Error('401'));

      const result = await adapter.testConnection({
        accessTokenEncrypted: 'enc:bad',
      } as any);

      expect(result.healthy).toBe(false);
    });
  });
});
