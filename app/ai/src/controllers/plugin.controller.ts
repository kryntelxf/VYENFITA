/**
 * VYENFITA Plugin Controller
 * 
 * Handles plugin management operations
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { PluginManager } from '../core/plugins/plugin-manager';

const pluginManager = new PluginManager();

export class PluginController {
  /**
   * Register a plugin
   * POST /api/v1/plugins/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { manifest, config } = req.body;

      if (!manifest) {
        res.status(400).json({
          success: false,
          error: 'manifest is required',
        });
        return;
      }

      const plugin = pluginManager.registerPlugin(manifest, config);

      res.json({
        success: true,
        data: plugin,
        message: `Plugin ${plugin.name} registered successfully`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get all plugins
   * GET /api/v1/plugins
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const plugins = pluginManager.getPlugins();

      res.json({
        success: true,
        data: plugins,
        count: plugins.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get a specific plugin
   * GET /api/v1/plugins/:pluginId
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      const { pluginId } = req.params;
      const plugin = pluginManager.getPlugin(pluginId);

      if (!plugin) {
        res.status(404).json({
          success: false,
          error: 'Plugin not found',
        });
        return;
      }

      res.json({
        success: true,
        data: plugin,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Enable a plugin
   * POST /api/v1/plugins/:pluginId/enable
   */
  async enable(req: Request, res: Response): Promise<void> {
    try {
      const { pluginId } = req.params;
      const success = pluginManager.enablePlugin(pluginId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Plugin not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Plugin enabled successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Disable a plugin
   * POST /api/v1/plugins/:pluginId/disable
   */
  async disable(req: Request, res: Response): Promise<void> {
    try {
      const { pluginId } = req.params;
      const success = pluginManager.disablePlugin(pluginId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Plugin not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Plugin disabled successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Unregister a plugin
   * DELETE /api/v1/plugins/:pluginId
   */
  async unregister(req: Request, res: Response): Promise<void> {
    try {
      const { pluginId } = req.params;
      const success = pluginManager.unregisterPlugin(pluginId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Plugin not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Plugin unregistered successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update plugin configuration
   * PATCH /api/v1/plugins/:pluginId/config
   */
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { pluginId } = req.params;
      const { config } = req.body;

      if (!config) {
        res.status(400).json({
          success: false,
          error: 'config is required',
        });
        return;
      }

      const success = pluginManager.updatePluginConfig(pluginId, config);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Plugin not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Plugin configuration updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  }
