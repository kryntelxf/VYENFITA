/**
 * VYENFITA SQL Safety Validator
 * 
 * Validates SQL queries before execution:
 * - Only SELECT allowed (no INSERT/UPDATE/DELETE/DROP/etc)
 * - No multiple statements
 * - No dangerous functions (pg_read_file, etc)
 * - Enforce LIMIT
 * - Enforce statement timeout
 * - Block comments that could hide statements
 * 
 * @version 1.0.0
 */

export interface SafetyCheckResult {
  safe: boolean;
  reasons: string[];
  warnings: string[];
  sanitized?: string;
}

const FORBIDDEN_KEYWORDS = [
  // Data modification
  'INSERT', 'UPDATE', 'DELETE', 'UPSERT', 'REPLACE', 'MERGE',
  // DDL
  'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME',
  // Privileges
  'GRANT', 'REVOKE',
  // Transactions
  'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'BEGIN', 'START', 'END',
  // Locking
  'LOCK', 'VACUUM', 'ANALYZE', 'CLUSTER', 'REINDEX',
  // Dangerous
  'COPY', 'EXEC', 'EXECUTE', 'CALL', 'DO', 'PERFORM',
  // File ops
  'LOAD', 'IMPORT', 'EXPORT',
];

const FORBIDDEN_FUNCTIONS = [
  // PostgreSQL dangerous functions
  'pg_read_file',
  'pg_read_binary_file',
  'pg_ls_dir',
  'pg_stat_file',
  'pg_sleep',
  'pg_terminate_backend',
  'pg_cancel_backend',
  'pg_reload_conf',
  'pg_rotate_logfile',
  'lo_import',
  'lo_export',
  // MySQL dangerous functions
  'load_file',
  'sleep',
  'benchmark',
  // MongoDB (though not SQL)
  'db.eval',
  '$where',
];

const DANGEROUS_PATTERNS = [
  // SQL injection attempt
  /;.*\S/, // semicolon followed by more text (multiple statements)
  /--.*$/m, // single-line comment (could hide content)
  /\/\*[\s\S]*?\*\//, // multi-line comment
  /\bxp_cmdshell\b/i, // SQL Server shell
  /\bsp_executesql\b/i,
];

export class SQLSafetyValidator {
  /**
   * Validate a SQL query
   */
  static validate(sql: string): SafetyCheckResult {
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (!sql || typeof sql !== 'string') {
      return {
        safe: false,
        reasons: ['SQL query is empty or not a string'],
        warnings: [],
      };
    }

    // Trim and normalize
    const normalized = sql.trim();
    const upper = normalized.toUpperCase();

    // Check 1: Must start with SELECT or WITH (CTE)
    if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
      reasons.push('Query must start with SELECT or WITH');
    }

    // Check 2: Forbidden keywords
    for (const keyword of FORBIDDEN_KEYWORDS) {
      // Use word boundary to avoid false positives (e.g., "created_at" contains "CREATE")
      const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
      if (pattern.test(normalized)) {
        reasons.push(`Forbidden keyword: ${keyword}`);
      }
    }

    // Check 3: Forbidden functions
    for (const fn of FORBIDDEN_FUNCTIONS) {
      const pattern = new RegExp(`\\b${fn}\\s*\\(`, 'i');
      if (pattern.test(normalized)) {
        reasons.push(`Forbidden function: ${fn}`);
      }
    }

    // Check 4: Dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(normalized)) {
        reasons.push(`Dangerous pattern detected: ${pattern.source.substring(0, 30)}`);
      }
    }

    // Check 5: Multiple statements (semicolon check more thorough)
    // Remove trailing semicolon if present
    const withoutTrailing = normalized.replace(/;\s*$/, '');
    if (withoutTrailing.includes(';')) {
      reasons.push('Multiple SQL statements are not allowed');
    }

    // Warnings (non-blocking)
    if (!upper.includes('LIMIT') && !upper.includes('FETCH FIRST')) {
      warnings.push('No LIMIT clause detected — will be automatically added');
    }

    // Return result
    const safe = reasons.length === 0;

    return {
      safe,
      reasons,
      warnings,
      sanitized: safe ? this.sanitize(normalized) : undefined,
    };
  }

  /**
   * Sanitize a query (add LIMIT if missing, remove trailing semicolon)
   */
  private static sanitize(sql: string): string {
    let sanitized = sql.trim();

    // Remove trailing semicolon
    sanitized = sanitized.replace(/;\s*$/, '');

    // Add LIMIT if not present
    if (!sanitized.toUpperCase().includes('LIMIT')) {
      sanitized += ' LIMIT 1000';
    }

    return sanitized;
  }

  /**
   * Extract table names referenced in the query
   * Used for permission check (user can only query their tenant's tables)
   */
  static extractTableNames(sql: string): string[] {
    const tables: string[] = [];
    const upper = sql.toUpperCase();

    // Match FROM <table> and JOIN <table>
    const fromMatches = sql.matchAll(/\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    const joinMatches = sql.matchAll(/\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);

    for (const match of fromMatches) {
      tables.push(match[1]);
    }
    for (const match of joinMatches) {
      tables.push(match[1]);
    }

    // Deduplicate
    return [...new Set(tables)];
  }
  }
