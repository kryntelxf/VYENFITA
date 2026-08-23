/**
 * VYENFITA Business Intelligence Controller
 * 
 * Natural language business intelligence endpoints
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { AIService } from '../core/services/ai.service';
import { BusinessIntelligenceService } from '../core/services/bi.service';

export class BusinessIntelligenceController {
  private biService: BusinessIntelligenceService;

  constructor() {
    const aiService = new AIService();
    this.biService = new BusinessIntelligenceService(aiService);
  }

  /**
   * Ask a business question
   * POST /api/v1/bi/ask
   */
  async ask(req: Request, res: Response): Promise<void> {
    try {
      const { question, data, context } = req.body;

      if (!question || typeof question !== 'string') {
        res.status(400).json({
          success: false,
          error: 'question is required and must be a string',
        });
        return;
      }

      const result = await this.biService.ask(question, data || [], context);

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
   * Detect anomalies
   * POST /api/v1/bi/anomalies
   */
  async detectAnomalies(req: Request, res: Response): Promise<void> {
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

      const result = await this.biService.detectAnomalies(data, metrics);

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
   * Generate KPI dashboard
   * POST /api/v1/bi/kpi
   */
  async generateKPI(req: Request, res: Response): Promise<void> {
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

      const result = await this.biService.generateKPI(data, metrics);

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
   * Generate predictions
   * POST /api/v1/bi/predict
   */
  async predict(req: Request, res: Response): Promise<void> {
    try {
      const { data, target, horizon } = req.body;

      if (!data || !Array.isArray(data)) {
        res.status(400).json({
          success: false,
          error: 'data is required and must be an array',
        });
        return;
      }

      if (!target || typeof target !== 'string') {
        res.status(400).json({
          success: false,
          error: 'target is required and must be a string',
        });
        return;
      }

      const result = await this.biService.predict(data, target, horizon || '3 months');

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
   * Generate business report
   * POST /api/v1/bi/report
   */
  async generateReport(req: Request, res: Response): Promise<void> {
    try {
      const { data, reportType, period } = req.body;

      if (!data || !Array.isArray(data)) {
        res.status(400).json({
          success: false,
          error: 'data is required and must be an array',
        });
        return;
      }

      const result = await this.biService.generateReport(data, reportType || 'business', period || 'current');

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
        }
