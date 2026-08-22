/**
 * VYENFITA Generation Controller
 * Handles application generation with self-correction
 */

import { Request, Response } from 'express';
import { ApplicationGeneratorService } from '../core/services/application-generator.service';
import { AIService } from '../core/services/ai.service';
import { ApplicationRepairService } from '../core/services/application-repair.service';

export class GenerationController {
  private generator: ApplicationGeneratorService;

  constructor() {
    const aiService = new AIService();
    const repairService = new ApplicationRepairService(aiService);
    this.generator = new ApplicationGeneratorService(aiService);
    // Inject repair service
    (this.generator as any).repairService = repairService;
  }

  /**
   * Generate application with self-correction
   */
  async generateApplication(req: Request, res: Response): Promise<void> {
    try {
      const { description, context } = req.body;

      if (!description || typeof description !== 'string') {
        res.status(400).json({
          success: false,
          error: 'description is required and must be a string',
        });
        return;
      }

      const result = await this.generator.generateApplicationWithSelfCorrection(
        description,
        context
      );

      if (!result.success) {
        res.status(422).json({
          success: false,
          error: 'Application generation failed after multiple repair attempts',
          validation: result.validation,
          repairAttempts: result.repairAttempts,
          errors: result.originalErrors,
        });
        return;
      }

      res.json({
        success: true,
        data: result.spec,
        validation: {
          isValid: result.validation.isValid,
          warnings: result.validation.warnings,
        },
        repairAttempts: result.repairAttempts,
        isRepaired: result.isRepaired,
        fixedErrors: result.fixedErrors || [],
        summary: {
          entities: result.spec?.entities?.length || 0,
          pages: result.spec?.pages?.length || 0,
          queries: result.spec?.queries?.length || 0,
          workflows: result.spec?.workflows?.length || 0,
          roles: result.spec?.roles?.length || 0,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Validate application spec
   */
  async validateSpec(req: Request, res: Response): Promise<void> {
    try {
      const { spec } = req.body;

      if (!spec) {
        res.status(400).json({
          success: false,
          error: 'spec is required',
        });
        return;
      }

      const validation = ApplicationSpecValidator.validate(spec);

      res.json({
        success: true,
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        summary: {
          hasErrors: validation.errors.length > 0,
          hasWarnings: validation.warnings.length > 0,
          errorCount: validation.errors.length,
          warningCount: validation.warnings.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Repair invalid spec
   */
  async repairSpec(req: Request, res: Response): Promise<void> {
    try {
      const { spec } = req.body;

      if (!spec) {
        res.status(400).json({
          success: false,
          error: 'spec is required',
        });
        return;
      }

      const aiService = new AIService();
      const repairService = new ApplicationRepairService(aiService);
      const result = await repairService.repair(spec);

      res.json({
        success: result.success,
        data: result.spec,
        repairAttempts: result.repairAttempts,
        originalErrors: result.originalErrors,
        fixedErrors: result.fixedErrors,
        summary: {
          fixed: result.fixedErrors.length,
          totalOriginal: result.originalErrors.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
        }
