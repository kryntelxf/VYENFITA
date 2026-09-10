/**
 * VYENFITA Generation Controller
 * 
 * Real generation endpoints using production AI service
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { GenerationService } from '../lib/ai/generation.service';

export class GenerationController {
  /**
   * Generate application
   * POST /api/v1/ai/generate-application
   */
  async generateApplication(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const { description, context } = req.body;

      if (!description || typeof description !== 'string' || description.length < 10) {
        res.status(400).json({
          success: false,
          error: 'description must be at least 10 characters',
        });
        return;
      }

      if (description.length > 5000) {
        res.status(400).json({
          success: false,
          error: 'description must not exceed 5000 characters',
        });
        return;
      }

      const result = await GenerationService.generateApplication({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        description,
        context,
      });

      res.json({
        success: true,
        data: result.spec,
        meta: {
          attempts: result.attempts,
          repairs: result.repairs,
          tokens: result.totalTokens,
          costUsd: result.totalCostUsd,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed';
      res.status(422).json({
        success: false,
        error: message,
      });
    }
  }
}
