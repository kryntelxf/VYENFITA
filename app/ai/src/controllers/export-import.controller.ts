/**
 * VYENFITA Export/Import Controller
 * 
 * Handles export and import operations
 * - Export application
 * - Import application
 * - Backup and restore
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { ExportImportService } from '../core/services/export-import.service';

const exportImportService = new ExportImportService();

export class ExportImportController {
  /**
   * Export application to JSON
   * POST /api/v1/export/json
   */
  async exportJSON(req: Request, res: Response): Promise<void> {
    try {
      const { spec, metadata } = req.body;

      if (!spec) {
        res.status(400).json({
          success: false,
          error: 'spec is required',
        });
        return;
      }

      const json = exportImportService.exportToJSON(spec, metadata);

      res.json({
        success: true,
        data: json,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Import application from JSON
   * POST /api/v1/import/json
   */
  async importJSON(req: Request, res: Response): Promise<void> {
    try {
      const { json } = req.body;

      if (!json) {
        res.status(400).json({
          success: false,
          error: 'json is required',
        });
        return;
      }

      const pkg = exportImportService.importFromJSON(json);

      res.json({
        success: true,
        data: pkg,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Export application to ZIP
   * POST /api/v1/export/zip
   */
  async exportZIP(req: Request, res: Response): Promise<void> {
    try {
      const { spec, metadata } = req.body;

      if (!spec) {
        res.status(400).json({
          success: false,
          error: 'spec is required',
        });
        return;
      }

      const buffer = await exportImportService.exportToZIP(spec, metadata);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="app-${Date.now()}.zip"`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Import application from ZIP
   * POST /api/v1/import/zip
   */
  async importZIP(req: Request, res: Response): Promise<void> {
    try {
      // In production, this would handle file upload
      // For now, we expect the ZIP content as base64
      const { content } = req.body;

      if (!content) {
        res.status(400).json({
          success: false,
          error: 'content is required',
        });
        return;
      }

      const buffer = Buffer.from(content, 'base64');
      const pkg = await exportImportService.importFromZIP(buffer);

      res.json({
        success: true,
        data: pkg,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Create backup
   * POST /api/v1/backup/create
   */
  async createBackup(req: Request, res: Response): Promise<void> {
    try {
      const { spec } = req.body;

      if (!spec) {
        res.status(400).json({
          success: false,
          error: 'spec is required',
        });
        return;
      }

      const backup = exportImportService.createBackup(spec);

      res.json({
        success: true,
        data: backup,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Restore from backup
   * POST /api/v1/backup/restore
   */
  async restoreBackup(req: Request, res: Response): Promise<void> {
    try {
      const { backup } = req.body;

      if (!backup) {
        res.status(400).json({
          success: false,
          error: 'backup is required',
        });
        return;
      }

      const spec = exportImportService.restoreFromBackup(backup);

      res.json({
        success: true,
        data: spec,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Compare versions
   * POST /api/v1/export/compare
   */
  async compareVersions(req: Request, res: Response): Promise<void> {
    try {
      const { spec1, spec2 } = req.body;

      if (!spec1 || !spec2) {
        res.status(400).json({
          success: false,
          error: 'spec1 and spec2 are required',
        });
        return;
      }

      const diff = exportImportService.compareVersions(spec1, spec2);

      res.json({
        success: true,
        data: diff,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }
        }
