/**
 * VYENFITA Jest Global Setup
 * 
 * Runs once before all tests.
 * Sets environment variables needed for all tests.
 * 
 * @version 1.0.0
 */

export default async function globalSetup(): Promise<void> {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';

  // Set test secrets (must be 32+ chars)
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-32-chars-long-x';

  // Database
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://test:test@localhost:5432/vyenfita_test';

  // Disable scheduler during tests
  process.env.SCHEDULER_ENABLED = 'false';

  // Reduce noise
  console.log('[Jest] Global setup complete');
  console.log('[Jest] NODE_ENV:', process.env.NODE_ENV);
  console.log('[Jest] DB:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
    }
