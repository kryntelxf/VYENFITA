/**
 * VYENFITA Build Service
 * 
 * Builds deployable artifacts from application specifications
 * 
 * @version 1.0.0
 */

import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { applicationVersionRepository } from '../database/repositories/application-version.repository';
import { DeploymentArtifact, DeploymentLogEntry } from './deployment.interface';

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || '/tmp/vyenfita-artifacts';

export interface BuildParams {
  applicationId: string;
  versionId: string;
  applicationName: string;
  environmentName: string;
}

export class BuildService {
  /**
   * Build an artifact from an application version
   */
  static async build(
    params: BuildParams,
    logger: (entry: DeploymentLogEntry) => void
  ): Promise<DeploymentArtifact> {
    const startTime = Date.now();

    logger({
      timestamp: new Date(),
      level: 'info',
      message: 'Starting build',
      data: { applicationId: params.applicationId, versionId: params.versionId },
    });

    // Load version
    const version = await applicationVersionRepository.findById(params.versionId);
    if (!version) {
      throw new Error(`Version not found: ${params.versionId}`);
    }

    if (version.applicationId !== params.applicationId) {
      throw new Error('Version does not belong to application');
    }

    // Prepare artifact directory
    const artifactId = randomUUID();
    const artifactDir = path.join(ARTIFACTS_DIR, artifactId);
    await fs.mkdir(artifactDir, { recursive: true });

    logger({
      timestamp: new Date(),
      level: 'debug',
      message: 'Created artifact directory',
      data: { artifactDir },
    });

    // Build manifest
    const manifest = {
      applicationId: params.applicationId,
      versionId: params.versionId,
      version: version.version,
      applicationName: params.applicationName,
      environmentName: params.environmentName,
      builtAt: new Date().toISOString(),
      spec: version.spec,
    };

    // Write manifest
    const manifestPath = path.join(artifactDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    logger({
      timestamp: new Date(),
      level: 'info',
      message: 'Wrote manifest',
      data: { size: JSON.stringify(manifest).length },
    });

    // Write application spec (for runtime)
    const specPath = path.join(artifactDir, 'spec.json');
    await fs.writeFile(specPath, JSON.stringify(version.spec, null, 2));

    // Compute checksum
    const checksum = this.computeChecksum(manifest);

    // Compute size
    const sizeBytes = Buffer.byteLength(JSON.stringify(manifest));

    const durationMs = Date.now() - startTime;

    logger({
      timestamp: new Date(),
      level: 'info',
      message: 'Build complete',
      data: { durationMs, checksum, sizeBytes },
    });

    return {
      id: artifactId,
      applicationId: params.applicationId,
      version: version.version,
      path: artifactDir,
      sizeBytes,
      checksum,
      createdAt: new Date(),
      metadata: {
        versionId: params.versionId,
        applicationName: params.applicationName,
        environmentName: params.environmentName,
        buildDurationMs: durationMs,
      },
    };
  }

  /**
   * Clean up an artifact directory
   */
  static async cleanup(artifactId: string): Promise<void> {
    const artifactDir = path.join(ARTIFACTS_DIR, artifactId);
    try {
      await fs.rm(artifactDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private static computeChecksum(data: any): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }
             }
