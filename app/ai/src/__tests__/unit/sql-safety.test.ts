/**
 * VYENFITA SQL Safety Validator Unit Tests
 * 
 * @version 1.0.0
 */

import { SQLSafetyValidator } from '../../lib/bi/sql-safety.validator';

describe('SQLSafetyValidator', () => {
  describe('safe queries', () => {
    it('should allow simple SELECT', () => {
      expect(SQLSafetyValidator.validate('SELECT * FROM users').safe).toBe(true);
    });

    it('should allow JOIN', () => {
      const result = SQLSafetyValidator.validate(
        'SELECT u.id, o.name FROM users u JOIN organizations o ON u.org_id = o.id'
      );
      expect(result.safe).toBe(true);
    });

    it('should allow CTE', () => {
      const result = SQLSafetyValidator.validate(
        'WITH active AS (SELECT * FROM users WHERE active = true) SELECT * FROM active'
      );
      expect(result.safe).toBe(true);
    });

    it('should auto-add LIMIT', () => {
      const result = SQLSafetyValidator.validate('SELECT * FROM users');
      expect(result.sanitized).toContain('LIMIT');
    });

    it('should not add LIMIT if already present', () => {
      const result = SQLSafetyValidator.validate('SELECT * FROM users LIMIT 10');
      expect(result.sanitized).toBe('SELECT * FROM users LIMIT 10');
    });

    it('should remove trailing semicolon', () => {
      const result = SQLSafetyValidator.validate('SELECT * FROM users;');
      expect(result.safe).toBe(true);
      expect(result.sanitized).not.toContain(';');
    });
  });

  describe('unsafe queries', () => {
    it('should block INSERT', () => {
      expect(SQLSafetyValidator.validate("INSERT INTO users VALUES (1, 'x')").safe).toBe(false);
    });

    it('should block UPDATE', () => {
      expect(SQLSafetyValidator.validate("UPDATE users SET name = 'x'").safe).toBe(false);
    });

    it('should block DELETE', () => {
      expect(SQLSafetyValidator.validate('DELETE FROM users').safe).toBe(false);
    });

    it('should block DROP', () => {
      expect(SQLSafetyValidator.validate('DROP TABLE users').safe).toBe(false);
    });

    it('should block TRUNCATE', () => {
      expect(SQLSafetyValidator.validate('TRUNCATE TABLE users').safe).toBe(false);
    });

    it('should block multiple statements', () => {
      expect(
        SQLSafetyValidator.validate('SELECT * FROM users; DROP TABLE users').safe
      ).toBe(false);
    });

    it('should block SQL comments', () => {
      expect(
        SQLSafetyValidator.validate('SELECT * FROM users -- WHERE 1=1').safe
      ).toBe(false);
    });

    it('should block pg_read_file', () => {
      expect(
        SQLSafetyValidator.validate("SELECT pg_read_file('/etc/passwd')").safe
      ).toBe(false);
    });

    it('should block pg_sleep', () => {
      expect(SQLSafetyValidator.validate('SELECT pg_sleep(10)').safe).toBe(false);
    });
  });

  describe('extractTableNames', () => {
    it('should extract table names from FROM and JOIN', () => {
      const tables = SQLSafetyValidator.extractTableNames(
        'SELECT u.id FROM users u JOIN orders o ON u.id = o.user_id'
      );
      expect(tables).toContain('users');
      expect(tables).toContain('orders');
    });
  });
});
