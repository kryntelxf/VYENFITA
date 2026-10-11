/**
 * VYENFITA OAuth Service Unit Tests
 * 
 * Verifies:
 * - PKCE state creation
 * - State consumption
 * - Token encryption/storage
 * - Access token retrieval
 * - Disconnect
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    oAuthState: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    integrationConnection: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../../lib/security/secret.service', () => ({
  SecretService: jest.fn().mockImplementation(() => ({
    encrypt: jest.fn((v: string) => `encrypted:${v}`),
    decrypt: jest.fn((v: string) => v.replace('encrypted:', '')),
  })),
}));

jest.mock('../../../lib/audit/audit.service', () => ({
  auditService: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { OAuthService } from '../../../lib/integrations/oauth.service';
import { IntegrationError } from '../../../lib/integrations/integration.interface';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('OAuthService', () => {
  let service: OAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OAuthService();
  });

  describe('createState()', () => {
    it('should generate state and code verifier', async () => {
      (mockPrisma.oAuthState.create as jest.Mock).mockResolvedValue({});

      const result = await service.createState(
        'tenant-1',
        'slack',
        'https://app.example.com/callback'
      );

      expect(result.state).toBeDefined();
      expect(result.codeVerifier).toBeDefined();
      expect(result.state.length).toBeGreaterThan(20);
      expect(result.codeVerifier.length).toBeGreaterThan(20);
      expect(result.state).not.toBe(result.codeVerifier);
    });

    it('should persist state to database', async () => {
      (mockPrisma.oAuthState.create as jest.Mock).mockResolvedValue({});

      await service.createState('tenant-1', 'slack', 'https://cb.example.com');

      expect(mockPrisma.oAuthState.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          integrationType: 'slack',
          redirectUri: 'https://cb.example.com',
          expiresAt: expect.any(Date),
        }),
      });
    });
  });

  describe('consumeState()', () => {
    it('should return state when valid', async () => {
      const futureDate = new Date(Date.now() + 60_000);
      (mockPrisma.oAuthState.findFirst as jest.Mock).mockResolvedValue({
        id: 'state-1',
        tenantId: 'tenant-1',
        integrationType: 'slack',
        state: 'abc',
        codeVerifier: 'xyz',
        redirectUri: 'https://cb.example.com',
        expiresAt: futureDate,
      });
      (mockPrisma.oAuthState.delete as jest.Mock).mockResolvedValue({});

      const result = await service.consumeState('abc', 'slack');

      expect(result.state).toBe('abc');
      expect(mockPrisma.oAuthState.delete).toHaveBeenCalledWith({
        where: { id: 'state-1' },
      });
    });

    it('should throw INVALID_STATE when not found', async () => {
      (mockPrisma.oAuthState.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.consumeState('unknown', 'slack')).rejects.toThrow(
        IntegrationError
      );
    });

    it('should throw STATE_EXPIRED for expired state', async () => {
      const pastDate = new Date(Date.now() - 60_000);
      (mockPrisma.oAuthState.findFirst as jest.Mock).mockResolvedValue({
        id: 'state-1',
        expiresAt: pastDate,
      });
      (mockPrisma.oAuthState.delete as jest.Mock).mockResolvedValue({});

      await expect(service.consumeState('expired', 'slack')).rejects.toThrow(
        /expired/i
      );
    });

    it('should delete expired state', async () => {
      const pastDate = new Date(Date.now() - 60_000);
      (mockPrisma.oAuthState.findFirst as jest.Mock).mockResolvedValue({
        id: 'state-1',
        expiresAt: pastDate,
      });
      (mockPrisma.oAuthState.delete as jest.Mock).mockResolvedValue({});

      try {
        await service.consumeState('expired', 'slack');
      } catch {
        // Expected
      }

      expect(mockPrisma.oAuthState.delete).toHaveBeenCalledWith({
        where: { id: 'state-1' },
      });
    });
  });

  describe('storeConnection()', () => {
    it('should encrypt tokens before storing', async () => {
      (mockPrisma.integrationConnection.create as jest.Mock).mockResolvedValue({
        id: 'conn-1',
        tenantId: 'tenant-1',
        integrationType: 'slack',
        name: 'My Slack',
        status: 'connected',
      });

      await service.storeConnection({
        tenantId: 'tenant-1',
        integrationType: 'slack',
        userId: 'user-1',
        name: 'My Slack',
        accessToken: 'secret-token',
        refreshToken: 'secret-refresh',
      });

      expect(mockPrisma.integrationConnection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accessTokenEncrypted: 'encrypted:secret-token',
          refreshTokenEncrypted: 'encrypted:secret-refresh',
          status: 'connected',
        }),
      });
    });

    it('should not set refreshToken when not provided', async () => {
      (mockPrisma.integrationConnection.create as jest.Mock).mockResolvedValue({
        id: 'conn-1',
      });

      await service.storeConnection({
        tenantId: 'tenant-1',
        integrationType: 'slack',
        userId: 'user-1',
        name: 'My Slack',
        accessToken: 'token-only',
      });

      const callArg = (mockPrisma.integrationConnection.create as jest.Mock).mock.calls[0][0];
      expect(callArg.data.refreshTokenEncrypted).toBeUndefined();
    });
  });

  describe('getAccessToken()', () => {
    it('should decrypt access token', async () => {
      (mockPrisma.integrationConnection.findUnique as jest.Mock).mockResolvedValue({
        id: 'conn-1',
        status: 'connected',
        accessTokenEncrypted: 'encrypted:secret-token',
      });

      const token = await service.getAccessToken('conn-1');
      expect(token).toBe('secret-token');
    });

    it('should throw when connection not found', async () => {
      (mockPrisma.integrationConnection.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getAccessToken('missing')).rejects.toThrow(
        IntegrationError
      );
    });

    it('should throw when status not connected', async () => {
      (mockPrisma.integrationConnection.findUnique as jest.Mock).mockResolvedValue({
        id: 'conn-1',
        status: 'expired',
      });

      await expect(service.getAccessToken('conn-1')).rejects.toThrow(/expired/i);
    });

    it('should throw when no access token stored', async () => {
      (mockPrisma.integrationConnection.findUnique as jest.Mock).mockResolvedValue({
        id: 'conn-1',
        status: 'connected',
        accessTokenEncrypted: null,
      });

      await expect(service.getAccessToken('conn-1')).rejects.toThrow(/token/i);
    });
  });

  describe('updateTokens()', () => {
    it('should update encrypted tokens', async () => {
      (mockPrisma.integrationConnection.update as jest.Mock).mockResolvedValue({});

      await service.updateTokens('conn-1', 'new-token', 'new-refresh', new Date());

      expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: expect.objectContaining({
          accessTokenEncrypted: 'encrypted:new-token',
          refreshTokenEncrypted: 'encrypted:new-refresh',
          status: 'connected',
          lastError: null,
        }),
      });
    });

    it('should not update refreshToken if not provided', async () => {
      (mockPrisma.integrationConnection.update as jest.Mock).mockResolvedValue({});

      await service.updateTokens('conn-1', 'new-token');

      const callArg = (mockPrisma.integrationConnection.update as jest.Mock).mock.calls[0][0];
      expect(callArg.data.refreshTokenEncrypted).toBeUndefined();
    });
  });

  describe('disconnect()', () => {
    it('should delete connection', async () => {
      (mockPrisma.integrationConnection.findFirst as jest.Mock).mockResolvedValue({
        id: 'conn-1',
        tenantId: 'tenant-1',
        integrationType: 'slack',
      });
      (mockPrisma.integrationConnection.delete as jest.Mock).mockResolvedValue({});

      await service.disconnect('conn-1', 'tenant-1');

      expect(mockPrisma.integrationConnection.delete).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
      });
    });

    it('should throw when connection not found', async () => {
      (mockPrisma.integrationConnection.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.disconnect('missing', 'tenant-1')).rejects.toThrow(
        IntegrationError
      );
    });

    it('should enforce tenant isolation', async () => {
      (mockPrisma.integrationConnection.findFirst as jest.Mock).mockResolvedValue(null);

      try {
        await service.disconnect('conn-1', 'other-tenant');
      } catch {
        // Expected
      }

      expect(mockPrisma.integrationConnection.findFirst).toHaveBeenCalledWith({
        where: { id: 'conn-1', tenantId: 'other-tenant' },
      });
    });
  });

  describe('listConnections()', () => {
    it('should list all connections for tenant', async () => {
      (mockPrisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([
        { id: 'c1' },
        { id: 'c2' },
      ]);

      const result = await service.listConnections('tenant-1');
      expect(result.length).toBe(2);
    });

    it('should filter by integration type', async () => {
      (mockPrisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([]);

      await service.listConnections('tenant-1', 'slack');

      expect(mockPrisma.integrationConnection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', integrationType: 'slack' },
        })
      );
    });

    it('should not select encrypted tokens in list', async () => {
      (mockPrisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([]);

      await service.listConnections('tenant-1');

      const callArg = (mockPrisma.integrationConnection.findMany as jest.Mock).mock.calls[0][0];
      expect(callArg.select.accessTokenEncrypted).toBeUndefined();
      expect(callArg.select.refreshTokenEncrypted).toBeUndefined();
    });
  });
});
