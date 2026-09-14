/**
 * VYENFITA Password Service Unit Tests
 * 
 * @version 1.0.0
 */

import { PasswordService } from '../../lib/auth/password.service';

describe('PasswordService', () => {
  describe('hash', () => {
    it('should hash a password', async () => {
      const hash = await PasswordService.hash('TestPassword123');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('TestPassword123');
      expect(hash.length).toBeGreaterThan(20);
    });

    it('should produce different hashes for the same password (salt)', async () => {
      const hash1 = await PasswordService.hash('TestPassword123');
      const hash2 = await PasswordService.hash('TestPassword123');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verify', () => {
    it('should verify a correct password', async () => {
      const hash = await PasswordService.hash('TestPassword123');
      expect(await PasswordService.verify('TestPassword123', hash)).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const hash = await PasswordService.hash('TestPassword123');
      expect(await PasswordService.verify('WrongPassword', hash)).toBe(false);
    });

    it('should not throw on invalid hash format', async () => {
      expect(await PasswordService.verify('TestPassword123', 'not-a-valid-hash')).toBe(false);
    });
  });

  describe('validate', () => {
    it('should accept a strong password', () => {
      const result = PasswordService.validate('StrongPass123');
      expect(result.valid).toBe(true);
      expect(result.strength).toBe('medium');
    });

    it('should reject short password', () => {
      const result = PasswordService.validate('Short1');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least'))).toBe(true);
    });

    it('should reject password without uppercase', () => {
      const result = PasswordService.validate('nouppercase123');
      expect(result.valid).toBe(false);
    });

    it('should reject password without lowercase', () => {
      const result = PasswordService.validate('NOLOWERCASE123');
      expect(result.valid).toBe(false);
    });

    it('should reject password without number', () => {
      const result = PasswordService.validate('NoNumbersHere');
      expect(result.valid).toBe(false);
    });

    it('should return strong strength for long complex password', () => {
      const result = PasswordService.validate('VeryStr0ng!Password#2026');
      expect(result.valid).toBe(true);
      expect(result.strength).toBe('strong');
    });
  });
});
