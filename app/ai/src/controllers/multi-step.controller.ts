/**
 * VYENFITA Multi-Step Generation Controller
 * 
 * Handles multi-step application generation
 */

import { Request, Response } from 'express';
import { AIService } from '../core/services/ai.service';
import { MultiStepGenerator } from '../core/services/multi-step-generator.service';

export class MultiStepController {
  private generator: MultiStepGenerator;

  constructor() {
    const aiService = new AIService();
    this.generator = new MultiStepGenerator(aiService);
  }

  /**
   * Generate application with multi-step process
   * 
   * POST /api/v1/ai/generate-multi-step
   */
  async generate(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { description, context } = req.body;

      if (!description || typeof description !== 'string') {
        res.status(400).json({
          success: false,
          error: 'description is required and must be a string',
        });
        return;
      }

      console.log(`[MultiStep] Starting generation: "${description.substring(0, 50)}..."`);

      const result = await this.generator.generate(description, context);

      const elapsed = Date.now() - startTime;

      res.json({
        success: result.success,
        data: result.spec,
        steps: result.steps.map(s => ({
          id: s.id,
          name: s.name,
          status: s.status,
          error: s.error,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
        })),
        errors: result.errors,
        warnings: result.warnings,
        summary: {
          steps: result.steps.length,
          completed: result.steps.filter(s => s.status === 'completed').length,
          failed: result.steps.filter(s => s.status === 'failed').length,
          entities: result.spec?.entities?.length || 0,
          pages: result.spec?.pages?.length || 0,
        },
        elapsed,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[MultiStep] Error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }
          }
