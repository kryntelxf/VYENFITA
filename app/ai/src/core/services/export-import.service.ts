/**
 * VYENFITA Export/Import Service
 * 
 * Exports and imports applications
 * - Export to JSON
 * - Export to ZIP
 * - Import from JSON
 * - Import from ZIP
 * - Backup and restore
 * 
 * @version 1.0.0
 */

import { ApplicationSpec } from '../schemas/application-spec.schema';
import { v4 as uuidv4 } from 'uuid';

export interface ExportPackage {
  id: string;
  version: string;
  application: ApplicationSpec;
  metadata: {
    name: string;
    description: string;
    author: string;
    createdAt: Date;
    exportedAt: Date;
    version: string;
  };
  dependencies: string[];
  files?: Record<string, string>;
}

export class ExportImportService {
  /**
   * Export application to JSON
   */
  exportToJSON(spec: ApplicationSpec, metadata?: Partial<ExportPackage['metadata']>): string {
    const pkg: ExportPackage = {
      id: uuidv4(),
      version: spec.metadata?.version || '1.0.0',
      application: spec,
      metadata: {
        name: spec.metadata?.name || 'Unnamed Application',
        description: spec.metadata?.description || '',
        author: metadata?.author || 'Unknown',
        createdAt: spec.metadata?.createdAt || new Date(),
        exportedAt: new Date(),
        version: spec.metadata?.version || '1.0.0',
      },
      dependencies: [],
    };

    return JSON.stringify(pkg, null, 2);
  }

  /**
   * Import application from JSON
   */
  importFromJSON(json: string): ExportPackage {
    try {
      return JSON.parse(json);
    } catch (error) {
      throw new Error(`Failed to parse export package: ${error}`);
    }
  }

  /**
   * Export application to ZIP (simulated)
   */
  async exportToZIP(spec: ApplicationSpec, metadata?: Partial<ExportPackage['metadata']>): Promise<Buffer> {
    // In production, this would create a real ZIP file
    // For now, we just return the JSON as a buffer
    const json = this.exportToJSON(spec, metadata);
    return Buffer.from(json);
  }

  /**
   * Import application from ZIP (simulated)
   */
  async importFromZIP(buffer: Buffer): Promise<ExportPackage> {
    // In production, this would extract the ZIP file
    // For now, we just parse the JSON
    return this.importFromJSON(buffer.toString());
  }

  /**
   * Create backup of application
   */
  createBackup(spec: ApplicationSpec): ExportPackage {
    return {
      id: uuidv4(),
      version: spec.metadata?.version || '1.0.0',
      application: JSON.parse(JSON.stringify(spec)), // Deep copy
      metadata: {
        name: spec.metadata?.name || 'Unnamed Application',
        description: spec.metadata?.description || '',
        author: 'System Backup',
        createdAt: new Date(),
        exportedAt: new Date(),
        version: spec.metadata?.version || '1.0.0',
      },
      dependencies: [],
    };
  }

  /**
   * Restore application from backup
   */
  restoreFromBackup(backup: ExportPackage): ApplicationSpec {
    return backup.application;
  }

  /**
   * Compare two application versions
   */
  compareVersions(spec1: ApplicationSpec, spec2: ApplicationSpec): VersionDiff {
    const changes: VersionDiff['changes'] = [];
    let added = 0;
    let modified = 0;
    let removed = 0;

    // Compare entities
    const entities1 = new Map(spec1.entities?.map(e => [e.name, e]) || []);
    const entities2 = new Map(spec2.entities?.map(e => [e.name, e]) || []);

    for (const [name, entity] of entities2) {
      if (!entities1.has(name)) {
        changes.push({
          type: 'added',
          path: `entities.${name}`,
          to: entity,
          description: `Added entity: ${name}`,
        });
        added++;
      }
    }

    for (const [name, entity] of entities1) {
      if (!entities2.has(name)) {
        changes.push({
          type: 'removed',
          path: `entities.${name}`,
          from: entity,
          description: `Removed entity: ${name}`,
        });
        removed++;
      }
    }

    return {
      versionFrom: spec1.metadata?.version || '1.0.0',
      versionTo: spec2.metadata?.version || '1.0.0',
      changes,
      summary: { added, modified, removed },
    };
  }
}

export interface VersionDiff {
  versionFrom: string;
  versionTo: string;
  changes: {
    type: 'added' | 'modified' | 'removed';
    path: string;
    from?: any;
    to?: any;
    description: string;
  }[];
  summary: {
    added: number;
    modified: number;
    removed: number;
  };
  }
