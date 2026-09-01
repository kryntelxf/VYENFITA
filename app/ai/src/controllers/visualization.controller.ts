/**
 * VYENFITA Visualization Controller
 * 
 * Handles data visualization operations
 * - Generate charts
 * - Generate dashboards
 * - Export visualizations
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { AIService } from '../core/services/ai.service';
import { VisualizationService } from '../core/services/visualization.service';

export class VisualizationController {
  private visualizationService: VisualizationService;

  constructor() {
    const aiService = new AIService();
    this.visualizationService = new VisualizationService(aiService);
  }

  /**
   * Generate visualization
   * POST /api/v1/visualization/generate
   */
  async generate(req: Request, res: Response): Promise<void> {
    try {
      const { data, config } = req.body;

      if (!data || !Array.isArray(data)) {
        res.status(400).json({
          success: false,
          error: 'data is required and must be an array',
        });
        return;
      }

      if (!config) {
        res.status(400).json({
          success: false,
          error: 'config is required',
        });
        return;
      }

      const result = await this.visualizationService.generate(data, config);

      res.json({
        success: true,
        data: result,
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
   * Generate dashboard
   * POST /api/v1/visualization/dashboard
   */
  async generateDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { data, metrics } = req.body;

      if (!data || !Array.isArray(data)) {
        res.status(400).json({
          success: false,
          error: 'data is required and must be an array',
        });
        return;
      }

      if (!metrics || !Array.isArray(metrics)) {
        res.status(400).json({
          success: false,
          error: 'metrics is required and must be an array',
        });
        return;
      }

      const result = await this.visualizationService.generateDashboard(data, metrics);

      res.json({
        success: true,
        data: result,
        count: result.length,
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
