/**
 * VYENFITA Natural Language to SQL Controller
 * 
 * Handles NL to SQL conversion
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { AIService } from '../core/services/ai.service';
import { NaturalLanguageToSQLService } from '../core/services/nl-to-sql.service';

export class NaturalLanguageToSQLController {
  private nlToSQLService: NaturalLanguageToSQLService;

  constructor() {
    const aiService = new AIService();
    this.nlToSQLService = new NaturalLanguageToSQLService(aiService);
  }

  /**
   * Convert natural language to SQL
   * POST /api/v1/nl-to-sql
   */
  async convertToSQL(req: Request, res: Response): Promise<void> {
    try {
      const { question, schema, databaseType = 'postgresql' } = req.body;

      if (!question || typeof question !== 'string') {
        res.status(400).json({
          success: false,
          error: 'question is required and must be a string',
        });
        return;
      }

      if (!schema || !schema.tables) {
        res.status(400).json({
          success: false,
          error: 'schema with tables is required',
        });
        return;
      }

      const result = await this.nlToSQLService.convertToSQL(question, schema, databaseType);

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
   * Validate SQL query
   * POST /api/v1/nl-to-sql/validate
   */
  async validateSQL(req: Request, res: Response): Promise<void> {
    try {
      const { query, databaseType = 'postgresql' } = req.body;

      if (!query) {
        res.status(400).json({
          success: false,
          error: 'query is required',
        });
        return;
      }

      const validation = this.nlToSQLService.validateSQL(query, databaseType);

      res.json({
        success: true,
        data: validation,
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
   * Optimize SQL query
   * POST /api/v1/nl-to-sql/optimize
   */
  async optimizeSQL(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.body;

      if (!query) {
        res.status(400).json({
          success: false,
          error: 'query is required',
        });
        return;
      }

      const optimization = this.nlToSQLService.optimizeSQL(query);

      res.json({
        success: true,
        data: optimization,
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
