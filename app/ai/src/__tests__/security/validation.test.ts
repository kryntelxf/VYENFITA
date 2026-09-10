/**
 * VYENFITA Input Validation Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { authSchemas, applicationSchemas } from '../../lib/security/input-validator';

describe('Input Validation', () => {
  describe('Auth schemas', () => {
    it('should validate valid register input', () => {
      const result = authSchemas.register.safeParse({
        email: 'Test@Example.com',
        password: 'ValidPass123',
        name: 'Test User',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com'); // lowercased
      }
    });

    it('should reject invalid email', () => {
      const result = authSchemas.register.safeParse({
        email: 'not-an-email',
        password: 'ValidPass123',
        name: 'Test',
      });

      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = authSchemas.register.safeParse({
        email: 'test@example.com',
        password: 'short',
        name: 'Test',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = authSchemas.register.safeParse({
        email: 'test@example.com',
        password: 'ValidPass123',
        name: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Application schemas', () => {
    it('should validate create', () => {
      const result = applicationSchemas.create.safeParse({
        name: 'My App',
        spec: { pages: [] },
      });

      expect(result.success).toBe(true);
    });

    it('should reject description too long', () => {
      const result = applicationSchemas.create.safeParse({
        name: 'My App',
        description: 'a'.repeat(2001),
        spec: {},
      });

      expect(result.success).toBe(false);
    });
  });
});
