/**
 * VYENFITA Integration Framework Unit Tests
 * 
 * Verifies:
 * - IntegrationError class
 * - Type definitions
 * - Base adapter contract
 * 
 * @version 1.0.0
 */

import {
  IntegrationError,
  IntegrationAdapter,
} from '../../../lib/integrations/integration.interface';

describe('Integration Framework', () => {
  describe('IntegrationError', () => {
    it('should construct with all properties', () => {
      const error = new IntegrationError(
        'Test error',
        'TEST_CODE',
        400,
        true
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('IntegrationError');
    });

    it('should default statusCode to 400 and retryable to false', () => {
      const error = new IntegrationError('Test', 'CODE');

      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
    });

    it('should be instanceof Error', () => {
      expect(new IntegrationError('Test', 'CODE')).toBeInstanceOf(Error);
    });

    it('should preserve stack trace', () => {
      const error = new IntegrationError('Test', 'CODE');
      expect(error.stack).toBeDefined();
    });
  });

  describe('IntegrationAdapter (abstract)', () => {
    it('should allow subclass implementation', () => {
      class TestAdapter extends IntegrationAdapter {
        readonly provider = {
          type: 'slack' as const,
          name: 'Test',
          description: 'Test',
          icon: '🧪',
          category: 'communication' as const,
          authType: 'oauth2' as const,
          authScopes: [],
          capabilities: [],
          actions: [],
          triggers: [],
        };

        async getAuthorizationUrl(): Promise<string> {
          return 'https://example.com/auth';
        }
        async exchangeCode(): Promise<any> {
          return { accessToken: 'test' };
        }
        async refreshToken(): Promise<any> {
          return { accessToken: 'new' };
        }
        async executeAction(): Promise<any> {
          return { success: true };
        }
        async testConnection(): Promise<any> {
          return { healthy: true };
        }
      }

      const adapter = new TestAdapter();
      expect(adapter.provider.name).toBe('Test');
      expect(adapter.getAuthorizationUrl).toBeDefined();
    });
  });
});
