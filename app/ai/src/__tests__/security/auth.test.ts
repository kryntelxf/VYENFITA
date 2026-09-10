/**
 * VYENFITA Authentication Tests
 * 
 * Proves auth flow works and cannot be bypassed
 * 
 * @version 1.0.0
 */

import '../setup';
import { AuthService } from '../../lib/auth/auth.service';
import { PasswordService } from '../../lib/auth/password.service';
import { TokenService } from '../../lib/auth/token.service';
import { SessionService } from '../../lib/auth/session.service';
import { createTestTenant } from '../helpers/test-factory';
import { prisma } from '../setup';

describe('Authentication', () => {
  describe('Registration', () => {
    it('should create user with tenant on valid registration', async () => {
      const result = await AuthService.register({
        email: 'new@test.com',
        password: 'ValidPass123',
        name: 'New User',
        tenantName: 'New Tenant',
      });

      expect(result.user.email).toBe('new@test.com');
      expect(result.tenant.name).toBe('New Tenant');
      expect(result.role.name).toBe('Owner');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should reject weak password', async () => {
      await expect(
        AuthService.register({
          email: 'weak@test.com',
          password: 'weak',
          name: 'Weak User',
        })
      ).rejects.toThrow('Password validation failed');
    });

    it('should reject invalid email', async () => {
      await expect(
        AuthService.register({
          email: 'not-an-email',
          password: 'ValidPass123',
          name: 'Bad Email',
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('should reject duplicate email', async () => {
      await AuthService.register({
        email: 'dup@test.com',
        password: 'ValidPass123',
        name: 'First',
      });

      await expect(
        AuthService.register({
          email: 'dup@test.com',
          password: 'ValidPass123',
          name: 'Second',
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('Login', () => {
    it('should login with valid credentials', async () => {
      const tenant = await createTestTenant('login');

      const result = await AuthService.login({
        email: tenant.email,
        password: tenant.password,
        tenantId: tenant.tenantId,
      });

      expect(result.user.id).toBe(tenant.userId);
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const tenant = await createTestTenant('badpw');

      await expect(
        AuthService.login({
          email: tenant.email,
          password: 'WrongPassword123',
          tenantId: tenant.tenantId,
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent email with SAME error message', async () => {
      const tenant = await createTestTenant('enum');

      // Both should return the same generic error to prevent user enumeration
      await expect(
        AuthService.login({
          email: 'nonexistent@test.com',
          password: 'AnyPassword123',
          tenantId: tenant.tenantId,
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject login to wrong tenant', async () => {
      const tenantA = await createTestTenant('a');
      const tenantB = await createTestTenant('b');

      // Try to login as tenantA user but with tenantB's ID
      await expect(
        AuthService.login({
          email: tenantA.email,
          password: tenantA.password,
          tenantId: tenantB.tenantId,
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Token', () => {
    it('should generate valid JWT with correct payload', async () => {
      const tenant = await createTestTenant('token');

      const payload = TokenService.verifyAccessToken(tenant.accessToken);

      expect(payload.userId).toBe(tenant.userId);
      expect(payload.tenantId).toBe(tenant.tenantId);
      expect(payload.email).toBe(tenant.email);
    });

    it('should reject tampered token', async () => {
      const tenant = await createTestTenant('tamper');

      const tampered = tenant.accessToken.slice(0, -10) + 'tamperedxx';

      expect(() => TokenService.verifyAccessToken(tampered)).toThrow();
    });

    it('should reject expired token', async () => {
      // Create token with short expiry manually
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        {
          userId: 'test',
          email: 'test@test.com',
          tenantId: 'test',
          roleId: 'test',
          sessionId: 'test',
        },
        process.env.JWT_SECRET!,
        { expiresIn: '1ms', issuer: 'vyenfita', audience: 'vyenfita-api' }
      );

      // Wait for expiry
      await new Promise((r) => setTimeout(r, 100));

      expect(() => TokenService.verifyAccessToken(token)).toThrow('Token expired');
    });
  });

  describe('Session', () => {
    it('should create session on login', async () => {
      const tenant = await createTestTenant('session');

      const sessions = await SessionService.getActiveForUser(tenant.userId);
      expect(sessions.length).toBe(1);
    });

    it('should validate active session', async () => {
      const tenant = await createTestTenant('valid');

      const validation = await SessionService.validate(tenant.accessToken);
      expect(validation.valid).toBe(true);
    });

    it('should reject revoked session', async () => {
      const tenant = await createTestTenant('revoke');

      await SessionService.revoke(tenant.accessToken);

      const validation = await SessionService.validate(tenant.accessToken);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('revoked');
    });
  });

  describe('Refresh Token', () => {
    it('should issue new tokens on valid refresh', async () => {
      const tenant = await createTestTenant('refresh');

      const newTokens = await AuthService.refresh(tenant.refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(tenant.accessToken);
    });

    it('should reject revoked refresh token', async () => {
      const tenant = await createTestTenant('refreshbad');

      // First refresh works
      await AuthService.refresh(tenant.refreshToken);

      // Second refresh with same token should fail (rotation)
      await expect(
        AuthService.refresh(tenant.refreshToken)
      ).rejects.toThrow();
    });
  });

  describe('Password', () => {
    it('should hash and verify passwords', async () => {
      const password = 'TestPassword123';
      const hash = await PasswordService.hash(password);

      expect(hash).not.toBe(password);
      expect(await PasswordService.verify(password, hash)).toBe(true);
      expect(await PasswordService.verify('Wrong', hash)).toBe(false);
    });

    it('should enforce password policy', () => {
      expect(PasswordService.validate('short').valid).toBe(false);
      expect(PasswordService.validate('nouppercase123').valid).toBe(false);
      expect(PasswordService.validate('NOLOWERCASE123').valid).toBe(false);
      expect(PasswordService.validate('NoNumbersHere').valid).toBe(false);
      expect(PasswordService.validate('ValidPass123').valid).toBe(true);
    });

    it('should change password and revoke sessions', async () => {
      const tenant = await createTestTenant('changepw');

      await AuthService.changePassword(tenant.userId, tenant.password, 'NewPass456');

      // Old session should be revoked
      const validation = await SessionService.validate(tenant.accessToken);
      expect(validation.valid).toBe(false);

      // Login with new password should work
      const result = await AuthService.login({
        email: tenant.email,
        password: 'NewPass456',
        tenantId: tenant.tenantId,
      });
      expect(result.user.id).toBe(tenant.userId);
    });
  });
});
