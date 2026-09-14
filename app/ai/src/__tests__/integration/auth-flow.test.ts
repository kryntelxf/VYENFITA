/**
 * VYENFITA Auth Flow Integration Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { AuthService } from '../../lib/auth/auth.service';
import { TokenService } from '../../lib/auth/token.service';
import { SessionService } from '../../lib/auth/session.service';
import { prisma } from '../setup';

describe('Auth Flow Integration', () => {
  const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  describe('register → login → refresh → logout', () => {
    it('should complete full auth lifecycle', async () => {
      const suffix = uniqueSuffix();
      const email = `user-${suffix}@test.com`;
      const password = 'TestPass123';

      // 1. Register
      const registerResult = await AuthService.register({
        email,
        password,
        name: 'Test User',
        tenantName: 'Test Tenant',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(registerResult.user.email).toBe(email);
      expect(registerResult.tokens.accessToken).toBeDefined();
      expect(registerResult.tokens.refreshToken).toBeDefined();
      expect(registerResult.tenant.id).toBeDefined();

      // 2. Verify token
      const payload = TokenService.verifyAccessToken(registerResult.tokens.accessToken);
      expect(payload.userId).toBe(registerResult.user.id);
      expect(payload.tenantId).toBe(registerResult.tenant.id);

      // 3. Session should exist
      const sessions = await SessionService.getActiveForUser(registerResult.user.id);
      expect(sessions.length).toBeGreaterThan(0);

      // 4. Login
      const loginResult = await AuthService.login({
        email,
        password,
        tenantId: registerResult.tenant.id,
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      });
      expect(loginResult.user.id).toBe(registerResult.user.id);

      // 5. Refresh
      const refreshResult = await AuthService.refresh(
        loginResult.tokens.refreshToken,
        '127.0.0.1',
        'jest'
      );
      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.accessToken).not.toBe(loginResult.tokens.accessToken);

      // 6. Logout
      await AuthService.logout(
        refreshResult.accessToken,
        loginResult.user.id,
        loginResult.tenant.id
      );

      // 7. Session should be revoked
      const validation = await SessionService.validate(refreshResult.accessToken);
      expect(validation.valid).toBe(false);
    });
  });

  describe('security', () => {
    it('should reject login with wrong password', async () => {
      const suffix = uniqueSuffix();
      const tenant = await AuthService.register({
        email: `user-${suffix}@test.com`,
        password: 'CorrectPass123',
        name: 'Test User',
      });

      await expect(
        AuthService.login({
          email: `user-${suffix}@test.com`,
          password: 'WrongPass123',
          tenantId: tenant.tenant.id,
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should revoke all sessions on password change', async () => {
      const suffix = uniqueSuffix();
      const user = await AuthService.register({
        email: `user-${suffix}@test.com`,
        password: 'OldPass123',
        name: 'Test User',
      });

      await AuthService.changePassword(user.user.id, 'OldPass123', 'NewPass456');

      // Old session invalid
      const validation = await SessionService.validate(user.tokens.accessToken);
      expect(validation.valid).toBe(false);

      // New password works
      const loginResult = await AuthService.login({
        email: `user-${suffix}@test.com`,
        password: 'NewPass456',
        tenantId: user.tenant.id,
      });
      expect(loginResult.user.id).toBe(user.user.id);
    });
  });
});
