/**
 * VYENFITA Schema Discovery Service
 * 
 * Discovers database schema for:
 * - PostgreSQL
 * - MySQL
 * 
 * Returns tables, columns, keys.
 * 
 * @version 1.0.0
 */

import { Pool as PgPool } from 'pg';
import { SecretService } from '../security/secret.service';
import {
  DataSourceConfig,
  TableSchema,
  DataSourceError,
} from './data-source.interface';

export class SchemaDiscoveryService {
  /**
   * Discover schema for a data source
   */
  static async discover(
    config: DataSourceConfig,
    secretService: SecretService
  ): Promise<TableSchema[]> {
    switch (config.type) {
      case 'postgresql':
        return this.discoverPostgres(config, secretService);
      case 'mysql':
        return this.discoverMySQL(config, secretService);
      default:
        throw new DataSourceError(
          `Schema discovery not supported for ${config.type}`,
          config.id,
          'UNSUPPORTED_TYPE'
        );
    }
  }

  // ============================================================
  // POSTGRESQL
  // ============================================================

  private static async discoverPostgres(
    config: DataSourceConfig,
    secretService: SecretService
  ): Promise<TableSchema[]> {
    const password = secretService.decrypt(config.passwordEncrypted);

    const pool = new PgPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password,
      ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: config.connectionTimeoutMs,
      max: 5,
    });

    try {
      // Query tables
      const tablesResult = await pool.query(`
        SELECT
          t.table_schema,
          t.table_name,
          t.table_type
        FROM information_schema.tables t
        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
          AND t.table_type IN ('BASE TABLE', 'VIEW')
        ORDER BY t.table_schema, t.table_name
      `);

      const schemas: TableSchema[] = [];

      for (const tableRow of tablesResult.rows) {
        const schema = tableRow.table_schema;
        const table = tableRow.table_name;

        // Columns
        const columnsResult = await pool.query(
          `
          SELECT
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default
          FROM information_schema.columns c
          WHERE c.table_schema = $1 AND c.table_name = $2
          ORDER BY c.ordinal_position
        `,
          [schema, table]
        );

        const columns = columnsResult.rows.map((r) => ({
          name: r.column_name,
          type: r.data_type,
          nullable: r.is_nullable === 'YES',
          default: r.column_default,
        }));

        // Primary keys
        const pkResult = await pool.query(
          `
          SELECT a.attname AS column_name
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = $1::regclass
            AND i.indisprimary
        `,
          [`"${schema}"."${table}"`]
        );

        const primaryKeys = pkResult.rows.map((r) => r.column_name);

        // Foreign keys
        const fkResult = await pool.query(
          `
          SELECT
            kcu.column_name,
            ccu.table_schema AS referenced_schema,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = $1
            AND tc.table_name = $2
        `,
          [schema, table]
        );

        const foreignKeys = fkResult.rows.map((r) => ({
          columnName: r.column_name,
          referencedSchema: r.referenced_schema,
          referencedTable: r.referenced_table,
          referencedColumn: r.referenced_column,
        }));

        schemas.push({
          schema,
          table,
          type: tableRow.table_type === 'VIEW' ? 'view' : 'table',
          columns,
          primaryKeys,
          foreignKeys,
        });
      }

      return schemas;
    } catch (error) {
      throw new DataSourceError(
        `Schema discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        config.id,
        'DISCOVERY_FAILED',
        true
      );
    } finally {
      await pool.end();
    }
  }

  // ============================================================
  // MYSQL (placeholder — use 'mysql2' package in production)
  // ============================================================

  private static async discoverMySQL(
    config: DataSourceConfig,
    _secretService: SecretService
  ): Promise<TableSchema[]> {
    throw new DataSourceError(
      'MySQL schema discovery not yet implemented — install mysql2 package',
      config.id,
      'NOT_IMPLEMENTED'
    );
  }
          }
