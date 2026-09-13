/**
 * VYENFITA Backup & Restore Service
 * 
 * @version 1.0.1
 */

import { v4 as uuidv4 } from 'uuid';
import { ApplicationSpec } from '../schemas/application-spec.schema';

export interface Backup {
  id: string;
  applicationId: string;
  version: string;
  size: number;
  checksum: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'completed' | 'failed' | 'restored';
  metadata: {
    name: string;
    description: string;
    author: string;
    backupType: 'manual' | 'scheduled' | 'auto';
  };
  restorePoint?: {
    restoredAt: Date;
    restoredBy: string;
  };
}

export interface BackupSchedule {
  id: string;
  applicationId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  retentionDays: number;
  enabled: boolean;
  nextBackupAt: Date;
  lastBackupAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class BackupRestoreService {
  private backups: Map<string, Backup>;
  private schedules: Map<string, BackupSchedule>;

  constructor() {
    this.backups = new Map();
    this.schedules = new Map();
  }

  createBackup(
    applicationId: string,
    version: string,
    spec: ApplicationSpec,
    metadata: {
      name: string;
      description: string;
      author: string;
      backupType: Backup['metadata']['backupType'];
    }
  ): Backup {
    const backup: Backup = {
      id: uuidv4(),
      applicationId,
      version,
      size: JSON.stringify(spec).length,
      checksum: this.generateChecksum(spec),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'completed',
      metadata: { ...metadata },
    };

    this.backups.set(backup.id, backup);
    return backup;
  }

  restoreBackup(
    backupId: string,
    restoredBy: string
  ): { success: boolean; spec?: ApplicationSpec; error?: string } {
    const backup = this.backups.get(backupId);
    if (!backup) {
      return { success: false, error: 'Backup not found' };
    }

    if (backup.status === 'failed') {
      return { success: false, error: 'Backup is in failed state' };
    }

    if (new Date() > backup.expiresAt) {
      return { success: false, error: 'Backup has expired' };
    }

    backup.status = 'restored';
    backup.restorePoint = {
      restoredAt: new Date(),
      restoredBy,
    };
    this.backups.set(backupId, backup);

    return {
      success: true,
      spec: {} as ApplicationSpec,
    };
  }

  getBackups(applicationId: string): Backup[] {
    const result: Backup[] = [];
    for (const backup of this.backups.values()) {
      if (backup.applicationId === applicationId) {
        result.push(backup);
      }
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getBackup(id: string): Backup | undefined {
    return this.backups.get(id);
  }

  deleteBackup(id: string): boolean {
    return this.backups.delete(id);
  }

  createSchedule(
    applicationId: string,
    frequency: BackupSchedule['frequency'],
    retentionDays: number
  ): BackupSchedule {
    const schedule: BackupSchedule = {
      id: uuidv4(),
      applicationId,
      frequency,
      retentionDays,
      enabled: true,
      nextBackupAt: this.calculateNextBackupTime(frequency),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  updateSchedule(
    id: string,
    updates: Partial<BackupSchedule>
  ): BackupSchedule | undefined {
    const schedule = this.schedules.get(id);
    if (!schedule) return undefined;

    Object.assign(schedule, updates);
    schedule.updatedAt = new Date();
    if (updates.frequency) {
      schedule.nextBackupAt = this.calculateNextBackupTime(updates.frequency);
    }
    this.schedules.set(id, schedule);
    return schedule;
  }

  getSchedules(applicationId: string): BackupSchedule[] {
    const result: BackupSchedule[] = [];
    for (const schedule of this.schedules.values()) {
      if (schedule.applicationId === applicationId) {
        result.push(schedule);
      }
    }
    return result;
  }

  deleteSchedule(id: string): boolean {
    return this.schedules.delete(id);
  }

  executeScheduledBackups(): { executed: string[]; failed: string[] } {
    const executed: string[] = [];
    const failed: string[] = [];

    const now = new Date();
    for (const schedule of this.schedules.values()) {
      if (!schedule.enabled) continue;
      if (schedule.nextBackupAt <= now) {
        try {
          schedule.lastBackupAt = now;
          schedule.nextBackupAt = this.calculateNextBackupTime(schedule.frequency);
          this.schedules.set(schedule.id, schedule);
          executed.push(schedule.id);
        } catch {
          failed.push(schedule.id);
        }
      }
    }

    this.cleanupExpiredBackups();

    return { executed, failed };
  }

  private cleanupExpiredBackups(): void {
    const now = new Date();
    for (const [id, backup] of this.backups) {
      if (backup.expiresAt <= now) {
        this.backups.delete(id);
      }
    }
  }

  private calculateNextBackupTime(frequency: BackupSchedule['frequency']): Date {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        return new Date(now.setHours(24, 0, 0, 0));
      case 'weekly':
        return new Date(now.setDate(now.getDate() + (7 - now.getDay())));
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() + 1, 1));
      default:
        return new Date(now.setHours(24, 0, 0, 0));
    }
  }

  private generateChecksum(spec: ApplicationSpec): string {
    const str = JSON.stringify(spec);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  getBackupStats(applicationId: string): {
    total: number;
    totalSize: number;
    oldest: Date | null;
    newest: Date | null;
    averageSize: number;
  } {
    const backups = this.getBackups(applicationId);
    const total = backups.length;

    if (total === 0) {
      return {
        total: 0,
        totalSize: 0,
        oldest: null,
        newest: null,
        averageSize: 0,
      };
    }

    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const oldest = backups[backups.length - 1]?.createdAt || null;
    const newest = backups[0]?.createdAt || null;

    return {
      total,
      totalSize,
      oldest,
      newest,
      averageSize: totalSize / total,
    };
  }
      }
