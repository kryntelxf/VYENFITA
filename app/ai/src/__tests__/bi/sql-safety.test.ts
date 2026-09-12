/**
 * VYENFITA SQL Safety Validator Tests
 * 
 * @version 1.0.0
 */

import '../setup';
import { SQLSafetyValidator } from '../../lib/bi/sql-safety.validator';

describe('SQL Safety Validator', () => {
  describe('Safe queries', () => {
    it('should allow simple SELECT', () => {
      const result = SQLSafetyValidator.validate('SELECT * FROM users');
      expect(result.safe).toBe(true);
    });

    it('should allow SELECT with JOIN', () => {
      const result = SQLSafetyValidator.validate(
        'SELECT u.id, o.name FROM users u JOIN organizations o ON u.org_id = o.id'
      );
      expect(result.safe).toBe(true);
    });

    it('should allow WITH (CTE)', () => {
      const result = SQLSafetyValidator.validate(
        'WITH active AS (SELECT * FROM users WHERE active = true) SELECT * FROM active'
      );
      expect(result.safe).toBe(true);
    });

    it('should allow aggregation', () => {
      const result = SQLSafetyValidator.validate(
        'SELECT department, COUNT(*) as count, AVG(salary) FROM employees GROUP BY department'
      );
      expect(result.safe).toBe(true);
    });
  });

  describe('Unsafe queries', () => {
    it('should block INSERT', () => {
      const result = SQLSafetyValidator.validate("INSERT INTO users VALUES (1, 'x')");
      expect(result.safe).toBe(false);
      expect(result.reasons.some((r) => r.includes('INSERT'))).toBe(true);
    });

    it('should block UPDATE', () => {
      const result = SQLSafetyValidator.validate("UPDATE users SET name = 'hacked'");
      expect(result.safe).toBe(false);
    });

    it('should block DELETE', () => {
      const result = SQLSafetyValidator.validate('DELETE FROM users');
      expect(result.safe).toBe(false);
    });

    it('should block DROP', () => {
      const result = SQLSafetyValidator.validate('DROP TABLE users');
      expect(result.safe).toBe(false);
    });

    it('should block TRUNCATE', () => {
      const result = SQLSafetyValidator.validate('TRUNCATE TABLE users');
      expect(result.safe).toBe(false);
    });

    it('should block ALTER', () => {
      const result = SQLSafetyValidator.validate('ALTER TABLE users ADD COLUMN secret TEXT');
      expect(result.safe).toBe(false);
    });

    it('should block multiple statements', () => {
      const result = SQLSafetyValidator.validate('SELECT * FROM users; DROP TABLE users');
      expect(result.safe).toBe(false);
      expect(result.reasons.some((r) => r.toLowerCase().includes('multiple'))).toBe(true);
    });

    it('should block SQL comments', () => {
      const result = SQLSafetyValidator.validate('SELECT * FROM users -- WHERE 1=1');
      expect(result.safe).toBe(false);
    });

    it('should block dangerous functions', () => {
      const result = SQLSafetyValidator.validate("SELECT pg_read_file('/etc/passwd')");
      expect(result.safe).toBe(false);
      expect(result.reasons.some((r) => r.includes('pg_read_file'))).toBe(true);
    });

    it('should block pg_sleep', () => {
      const result = SQLSafetyValidator.validate('SELECT pg_sleep(10)');
      expect(result.safe).toBe(false);
    });
  });

  describe('Sanitization', () => {
    it('should add LIMIT if missing', () => {
      const result = SQLSafetyValidator.validate('SELECT * FROM users');
      expect(result.safe).toBe(true);
      expect(result.sanitized).toContain('LIMIT');
    });

    it('should not add LIMIT if already present', () => {
      const result = SQLSafetyValidator.validate('SELECT * FROM users LIMIT 10');
      expect(result.safe).toBe(true);
      expect(result.sanitized).toBe('SELECT * FROM users LIMIT 10');
    });

    it('should remove trailing semicolon', () => {
      const result = SQLSafetyValidator.validate('SELECT * FROM users;');
      expect(result.safe).toBe(true);
      expect(result.sanitized).not.toContain(';');
    });
  });

  describe('Table extraction', () => {
    it('should extract table names', () => {
      const tables = SQLSafetyValidator.extractTableNames(
        'SELECT u.id FROM users u JOIN orders o ON u.id = o.user_id'
      );
      expect(tables).toContain('users');
      expect(tables).toContain('orders');
    });
  });
});
