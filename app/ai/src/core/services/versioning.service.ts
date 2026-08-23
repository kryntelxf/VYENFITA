/**
 * VYENFITA Application Versioning Service
 * 
 * Supports:
 * - Application versioning
 * - Diff between versions
 * - Rollback to previous versions
 * - Version history
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { ApplicationSpec } from '../schemas/application-spec.schema';

export interface VersionedApplication {
  id: string;
  name: string;
  currentVersion: string;
  versions: ApplicationVersion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationVersion {
  version: string;
  spec: ApplicationSpec;
  createdAt: Date;
  createdBy: string;
  changeLog: string;
  isCurrent: boolean;
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

export class VersioningService {
  private applications: Map<string, VersionedApplication>;

  constructor() {
    this.applications = new Map();
  }

  /**
   * Create a new application with initial version
   */
  createApplication(name: string, spec: ApplicationSpec, createdBy: string = 'system'): VersionedApplication {
    const id = uuidv4();
    const version: ApplicationVersion = {
      version: '1.0.0',
      spec,
      createdAt: new Date(),
      createdBy,
      changeLog: 'Initial version',
      isCurrent: true,
    };

    const app: VersionedApplication = {
      id,
      name,
      currentVersion: '1.0.0',
      versions: [version],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.applications.set(id, app);
    return app;
  }

  /**
   * Get application by ID
   */
  getApplication(id: string): VersionedApplication | undefined {
    return this.applications.get(id);
  }

  /**
   * Get all applications
   */
  getAllApplications(): VersionedApplication[] {
    return Array.from(this.applications.values());
  }

  /**
   * Get a specific version of an application
   */
  getVersion(appId: string, version: string): ApplicationVersion | undefined {
    const app = this.applications.get(appId);
    if (!app) return undefined;
    return app.versions.find(v => v.version === version);
  }

  /**
   * Get current version of an application
   */
  getCurrentVersion(appId: string): ApplicationVersion | undefined {
    const app = this.applications.get(appId);
    if (!app) return undefined;
    return app.versions.find(v => v.isCurrent);
  }

  /**
   * Create a new version of an application
   */
  createVersion(
    appId: string,
    spec: ApplicationSpec,
    changeLog: string,
    createdBy: string = 'system'
  ): VersionedApplication | undefined {
    const app = this.applications.get(appId);
    if (!app) return undefined;

    // Bump version
    const parts = app.currentVersion.split('.');
    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1]);
    const patch = parseInt(parts[2]);

    // Determine version bump based on change type
    let newVersion = '';
    if (changeLog.toLowerCase().includes('breaking') || changeLog.toLowerCase().includes('major')) {
      newVersion = `${major + 1}.0.0`;
    } else if (changeLog.toLowerCase().includes('feature') || changeLog.toLowerCase().includes('feat')) {
      newVersion = `${major}.${minor + 1}.0`;
    } else {
      newVersion = `${major}.${minor}.${patch + 1}`;
    }

    // Create new version
    const version: ApplicationVersion = {
      version: newVersion,
      spec,
      createdAt: new Date(),
      createdBy,
      changeLog,
      isCurrent: true,
    };

    // Mark old current version as not current
    app.versions.forEach(v => v.isCurrent = false);

    // Add new version
    app.versions.push(version);
    app.currentVersion = newVersion;
    app.updatedAt = new Date();

    this.applications.set(appId, app);
    return app;
  }

  /**
   * Rollback to a previous version
   */
  rollback(appId: string, targetVersion: string, createdBy: string = 'system'): VersionedApplication | undefined {
    const app = this.applications.get(appId);
    if (!app) return undefined;

    const target = app.versions.find(v => v.version === targetVersion);
    if (!target) return undefined;

    // Create a new version that is a copy of the target version
    const newVersion: ApplicationVersion = {
      version: this.getNextVersion(app.currentVersion, 'rollback'),
      spec: JSON.parse(JSON.stringify(target.spec)), // Deep copy
      createdAt: new Date(),
      createdBy,
      changeLog: `Rollback to version ${targetVersion}`,
      isCurrent: true,
    };

    // Mark old current version as not current
    app.versions.forEach(v => v.isCurrent = false);

    // Add new version
    app.versions.push(newVersion);
    app.currentVersion = newVersion.version;
    app.updatedAt = new Date();

    this.applications.set(appId, app);
    return app;
  }

  /**
   * Generate diff between two versions
   */
  diff(appId: string, versionFrom: string, versionTo: string): VersionDiff | undefined {
    const app = this.applications.get(appId);
    if (!app) return undefined;

    const from = app.versions.find(v => v.version === versionFrom);
    const to = app.versions.find(v => v.version === versionTo);

    if (!from || !to) return undefined;

    const changes: VersionDiff['changes'] = [];
    let added = 0;
    let modified = 0;
    let removed = 0;

    // Compare entities
    const fromEntities = new Map(from.spec.entities.map(e => [e.name, e]));
    const toEntities = new Map(to.spec.entities.map(e => [e.name, e]));

    // Added entities
    for (const [name, entity] of toEntities) {
      if (!fromEntities.has(name)) {
        changes.push({
          type: 'added',
          path: `entities.${name}`,
          to: entity,
          description: `Added entity: ${name}`,
        });
        added++;
      }
    }

    // Removed entities
    for (const [name, entity] of fromEntities) {
      if (!toEntities.has(name)) {
        changes.push({
          type: 'removed',
          path: `entities.${name}`,
          from: entity,
          description: `Removed entity: ${name}`,
        });
        removed++;
      }
    }

    // Modified entities (simplified - check field count)
    for (const [name, fromEntity] of fromEntities) {
      const toEntity = toEntities.get(name);
      if (toEntity) {
        const fromFields = fromEntity.fields.length;
        const toFields = toEntity.fields.length;
        if (fromFields !== toFields) {
          changes.push({
            type: 'modified',
            path: `entities.${name}.fields`,
            from: fromFields,
            to: toFields,
            description: `Modified entity ${name}: ${fromFields} → ${toFields} fields`,
          });
          modified++;
        }
      }
    }

    // Compare pages
    const fromPages = new Map(from.spec.pages.map(p => [p.name, p]));
    const toPages = new Map(to.spec.pages.map(p => [p.name, p]));

    for (const [name, page] of toPages) {
      if (!fromPages.has(name)) {
        changes.push({
          type: 'added',
          path: `pages.${name}`,
          to: page,
          description: `Added page: ${name}`,
        });
        added++;
      }
    }

    for (const [name, page] of fromPages) {
      if (!toPages.has(name)) {
        changes.push({
          type: 'removed',
          path: `pages.${name}`,
          from: page,
          description: `Removed page: ${name}`,
        });
        removed++;
      }
    }

    return {
      versionFrom,
      versionTo,
      changes,
      summary: { added, modified, removed },
    };
  }

  /**
   * Get version history
   */
  getVersionHistory(appId: string): ApplicationVersion[] {
    const app = this.applications.get(appId);
    if (!app) return [];
    return [...app.versions].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  /**
   * Delete an application
   */
  deleteApplication(appId: string): boolean {
    return this.applications.delete(appId);
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  private getNextVersion(currentVersion: string, type: 'patch' | 'minor' | 'major' | 'rollback'): string {
    const parts = currentVersion.split('.');
    let major = parseInt(parts[0]);
    let minor = parseInt(parts[1]);
    let patch = parseInt(parts[2]);

    if (type === 'rollback') {
      // For rollback, create a new patch version
      patch += 1;
    } else if (type === 'patch') {
      patch += 1;
    } else if (type === 'minor') {
      minor += 1;
      patch = 0;
    } else if (type === 'major') {
      major += 1;
      minor = 0;
      patch = 0;
    }

    return `${major}.${minor}.${patch}`;
  }
  }
