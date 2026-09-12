/**
 * VYENFITA Query Executor
 * 
 * Executes validated SQL queries with:
 * - Statement timeout
 * - Row limit
 * - Read-only mode
 * - Connection pooling
 * 
 * @version 1.0.0
 */

import { Pool as PgPool } from 'pg';
import { SecretService } from '../security/secret.service';
import { SQLSafetyValidator } from './sql-safety.validator';
import {
  DataSourceConfig,
  QueryResult,
  DataSourceError,
} from './data-source.interface';
import { logger } from '../observability/logger';

const DEFAULT_ROW_LIMIT = 1000;
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_ROW_LIMIT = 10000;

export interface ExecuteOptions {
  rowLimit?: number;
  timeoutMs?: number;
}

export class QueryExecutorService {
  /**
   * Execute a validated SQL query
   */
  static async execute(
    config: DataSourceConfig,
    sql: string,
    secretService: SecretService,
    options: ExecuteOptions = {}
  ): Promise<QueryResult> {
    // ============================================================
    // STEP 1: Validate SQL safety
    // ============================================================
    const safety = SQLSafetyValidator.validate(sql);

    if (!safety.safe) {
      logger.warn('SQL query rejected by safety validator', {
        dataSourceId: config.id,
        reasons: safety.reasons,
      });

      throw new DataSourceError(
        `Query failed safety check: ${safety.reasons.join('; ')}`,
        config.id,
        'UNSAFE_QUERY'
      );
    }

    const sanitizedSql = safety.sanitized!;

    // ============================================================
    // STEP 2: Enforce row limit
    // ============================================================
    const rowLimit = Math.min(
      options.rowLimit || DEFAULT_ROW_LIMIT,
      MAX_ROW_LIMIT
    );
    const timeoutMs = Math.min(
      options.timeoutMs || DEFAULT_TIMEOUT_MS,
      60000
    );

    // ============================================================
    // STEP 3: Execute via appropriate driver
    // ============================================================
    switch (config.type) {
      case 'postgresql':
        return this.executePostgres(config, sanitizedSql, secretService, rowLimit, timeoutMs);
      case 'mysql':
        throw new DataSourceError(
          'MySQL executor not yet implemented',
          config.id,
          'NOT_IMPLEMENTED'
        );
      default:
        throw new DataSourceError(
          `Execution not supported for ${config.type}`,
          config.id,
          'UNSUPPORTED_TYPE'
        );
    }
  }

  // ============================================================
  // POSTGRESQL
  // ============================================================

  private static async executePostgres(
    config: DataSourceConfig,
    sql: string,
    secretService: SecretService,
    rowLimit: number,
    timeoutMs: number
  ): Promise<QueryResult> {
    const password = secretService.decrypt(config.passwordEncrypted);

    const pool = new PgPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password,
      ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: config.connectionTimeoutMs,
      statement_timeout: timeoutMs,
      max: 3,
      idleTimeoutMillis: 10000,
    });

    const startTime = Date.now();

    try {
      // Set read-only mode for the session (defense in depth)
      await pool.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');

      // Execute the query
      const result = await pool.query(sql);
      const executionTimeMs = Date.now() - startTime;

      // Truncate if needed
      const truncated = result.rows.length > rowLimit;
      const rows = truncated ? result.rows.slice(0, rowLimit) : result.rows;

      return {
        columns: result.fields.map((f) => f.name),
        rows,
        rowCount: rows.length,
        executionTimeMs,
        truncated,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Detect timeout
      if (message.includes('timeout') || message.includes('canceling statement')) {
        throw new DataSourceError(
          `Query timed out after ${timeoutMs}ms`,
          config.id,
          'QUERY_TIMEOUT'
        );
      }

      throw new DataSourceError(
        `Query execution failed: ${message}`,
        config.id,
        'EXECUTION_FAILED'
      );
    } finally {
      await pool.end();
    }
  }
  }
