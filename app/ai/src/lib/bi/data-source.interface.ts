/**
 * VYENFITA Data Source Interface
 * 
 * Contract for database connections:
 * - PostgreSQL
 * - MySQL
 * - MongoDB
 * 
 * @version 1.0.0
 */

export type DataSourceType = 'postgresql' | 'mysql' | 'mongodb';

export interface DataSourceConfig {
  id: string;
  tenantId: string;
  name: string;
  type: DataSourceType;
  host: string;
  port: number;
  database: string;
  username: string;
  passwordEncrypted: string; // Encrypted via SecretService
  sslEnabled: boolean;
  connectionTimeoutMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TableSchema {
  schema: string;
  table: string;
  type: 'table' | 'view';
  rowCount?: number;
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys: ForeignKey[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  description?: string;
}

export interface ForeignKey {
  columnName: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  executionTimeMs: number;
  truncated: boolean;
}

export interface DataSourceHealth {
  healthy: boolean;
  latencyMs: number;
  error?: string;
  timestamp: Date;
}

export class DataSourceError extends Error {
  constructor(
    message: string,
    public readonly dataSourceId: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'DataSourceError';
  }
}
