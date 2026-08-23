/**
 * VYENFITA Generation Controller
 * 
 * Handles application and workflow generation with self-correction capability.
 * This is the core of VYENFITA's AI-native application generation.
 * 
 * Endpoints:
 * - POST /api/v1/ai/generate-application-v2 - Generate app with self-correction
 * - POST /api/v1/ai/validate-spec - Validate application specification
 * - POST /api/v1/ai/repair-spec - Repair invalid specification
 * - POST /api/v1/ai/generate-workflow-v2 - Generate workflow with self-correction
 * 
 * @version 1.0.0
 * @since 0.1.0
 */

import { Request, Response } from 'express';
import { AIService } from '../core/services/ai.service';
import { ApplicationGeneratorService } from '../core/services/application-generator.service';
import { ApplicationRepairService } from '../core/services/application-repair.service';
import { ApplicationSpecValidator } from '../core/validators/application-spec.validator';
import { ApplicationSpec } from '../core/schemas/application-spec.schema';

// ============================================================
// CONTROLLER CLASS
// ============================================================

export class GenerationController {
  private generator: ApplicationGeneratorService;
  private repairService: ApplicationRepairService;
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
    this.repairService = new ApplicationRepairService(this.aiService);
    this.generator = new ApplicationGeneratorService(this.aiService);
    // Inject repair service into generator
    (this.generator as any).repairService = this.repairService;
  }

  // ============================================================
  // GENERATE APPLICATION WITH SELF-CORRECTION
  // ============================================================

  /**
   * Generate application with self-correction loop
   * 
   * POST /api/v1/ai/generate-application-v2
   * 
   * Request body:
   * {
   *   "description": "Build a customer support platform...",
   *   "context": { "industry": "ecommerce", "teamSize": 10 },
   *   "maxAttempts": 3
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": { ...application spec... },
   *   "validation": { "isValid": true, "warnings": [] },
   *   "repairAttempts": 1,
   *   "isRepaired": true,
   *   "fixedErrors": ["Error 1 fixed", "Error 2 fixed"],
   *   "summary": {
   *     "entities": 5,
   *     "pages": 3,
   *     "queries": 8,
   *     "workflows": 2,
   *     "roles": 3
   *   }
   * }
   */
  async generateApplication(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { description, context, maxAttempts = 3 } = req.body;

      // Validate required fields
      if (!description || typeof description !== 'string') {
        res.status(400).json({
          success: false,
          error: 'description is required and must be a string',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (description.length < 5) {
        res.status(400).json({
          success: false,
          error: 'description must be at least 5 characters long',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Log generation attempt
      console.log(`[Generation] Starting application generation: "${description.substring(0, 50)}..."`, {
        context: context || 'none',
        maxAttempts,
      });

      // Generate with self-correction
      const result = await this.generator.generateApplicationWithSelfCorrection(
        description,
        context || {},
        maxAttempts
      );

      const elapsed = Date.now() - startTime;

      // Handle failure after max attempts
      if (!result.success) {
        console.error(`[Generation] Failed after ${result.repairAttempts} attempts`, {
          errors: result.originalErrors,
          elapsed,
        });

        res.status(422).json({
          success: false,
          error: 'Application generation failed after multiple repair attempts',
          repairAttempts: result.repairAttempts,
          maxAttempts,
          errors: result.originalErrors || [],
          validation: result.validation,
          elapsed,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Success response
      const response = {
        success: true,
        data: result.spec,
        validation: {
          isValid: result.validation.isValid,
          warnings: result.validation.warnings || [],
          errorCount: result.validation.errors?.length || 0,
        },
        repairAttempts: result.repairAttempts,
        isRepaired: result.isRepaired || false,
        fixedErrors: result.fixedErrors || [],
        summary: {
          entities: result.spec?.entities?.length || 0,
          pages: result.spec?.pages?.length || 0,
          queries: result.spec?.queries?.length || 0,
          workflows: result.spec?.workflows?.length || 0,
          roles: result.spec?.roles?.length || 0,
          dataSources: result.spec?.dataSources?.length || 0,
          integrations: result.spec?.integrations?.length || 0,
          requirements: result.spec?.requirements?.length || 0,
        },
        elapsed,
        timestamp: new Date().toISOString(),
      };

      console.log(`[Generation] Success: "${description.substring(0, 50)}..."`, {
        repairAttempts: result.repairAttempts,
        isRepaired: result.isRepaired,
        entities: result.spec?.entities?.length || 0,
        pages: result.spec?.pages?.length || 0,
        elapsed,
      });

      res.json(response);

    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error('[Generation] Unexpected error:', error);

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        elapsed,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ============================================================
  // VALIDATE SPECIFICATION
  // ============================================================

  /**
   * Validate an application specification
   * 
   * POST /api/v1/ai/validate-spec
   * 
   * Request body:
   * {
   *   "spec": { ...application spec... },
   *   "strict": true
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "isValid": true,
   *   "errors": [],
   *   "warnings": [],
   *   "summary": {
   *     "hasErrors": false,
   *     "hasWarnings": false,
   *     "errorCount": 0,
   *     "warningCount": 0
   *   }
   * }
   */
  async validateSpec(req: Request, res: Response): Promise<void> {
    try {
      const { spec, strict = true } = req.body;

      if (!spec) {
        res.status(400).json({
          success: false,
          error: 'spec is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validate the specification
      const validation = ApplicationSpecValidator.validate(spec);

      // Additional strict validation if requested
      let strictErrors: any[] = [];
      if (strict && validation.isValid) {
        // Check for potential issues even if schema passes
        const specData = validation.data as ApplicationSpec;
        
        // Check if any entity has no fields
        for (const entity of specData.entities || []) {
          if (!entity.fields || entity.fields.length === 0) {
            strictErrors.push({
              path: ['entities', entity.name, 'fields'],
              message: `Entity "${entity.name}" has no fields. Consider adding at least one field.`,
              type: 'suggestion',
            });
          }
        }

        // Check if any page has no widgets
        for (const page of specData.pages || []) {
          if (!page.widgets || page.widgets.length === 0) {
            strictErrors.push({
              path: ['pages', page.name, 'widgets'],
              message: `Page "${page.name}" has no widgets. Consider adding at least one widget.`,
              type: 'suggestion',
            });
          }
        }

        // Check if admin role exists
        const hasAdmin = (specData.roles || []).some((r: any) => r.isAdmin === true);
        if (!hasAdmin) {
          strictErrors.push({
            path: ['roles'],
            message: 'No admin role found. Consider adding an admin role.',
            type: 'suggestion',
          });
        }

        // Check if default role exists
        const hasDefault = (specData.roles || []).some((r: any) => r.isDefault === true);
        if (!hasDefault) {
          strictErrors.push({
            path: ['roles'],
            message: 'No default role found. Consider adding a default role.',
            type: 'suggestion',
          });
        }
      }

      const allErrors = [...validation.errors, ...strictErrors];

      res.json({
        success: true,
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: validation.warnings || [],
        strict: strictErrors,
        summary: {
          hasErrors: allErrors.length > 0,
          hasWarnings: (validation.warnings || []).length > 0,
          errorCount: allErrors.length,
          warningCount: (validation.warnings || []).length,
          strictWarningCount: strictErrors.length,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[Validate] Error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ============================================================
  // REPAIR SPECIFICATION
  // ============================================================

  /**
   * Repair an invalid specification
   * 
   * POST /api/v1/ai/repair-spec
   * 
   * Request body:
   * {
   *   "spec": { ...invalid spec... },
   *   "maxAttempts": 3
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": { ...repaired spec... },
   *   "repairAttempts": 1,
   *   "originalErrors": [...],
   *   "fixedErrors": [...],
   *   "summary": {
   *     "fixed": 3,
   *     "totalOriginal": 3
   *   }
   * }
   */
  async repairSpec(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { spec, maxAttempts = 3 } = req.body;

      if (!spec) {
        res.status(400).json({
          success: false,
          error: 'spec is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // First validate to see if repair is needed
      const validation = ApplicationSpecValidator.validate(spec);
      
      if (validation.isValid) {
        res.json({
          success: true,
          message: 'Specification is already valid, no repair needed',
          data: spec,
          repairAttempts: 0,
          originalErrors: [],
          fixedErrors: [],
          summary: {
            fixed: 0,
            totalOriginal: 0,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      console.log(`[Repair] Starting repair with ${validation.errors.length} errors`, {
        errors: validation.errors.map(e => e.message),
      });

      // Repair the specification
      const result = await this.repairService.repair(spec, 1);

      const elapsed = Date.now() - startTime;

      if (!result.success) {
        console.error(`[Repair] Failed after ${result.repairAttempts} attempts`, {
          errors: result.originalErrors,
          elapsed,
        });

        res.status(422).json({
          success: false,
          error: 'Repair failed after multiple attempts',
          repairAttempts: result.repairAttempts,
          maxAttempts,
          originalErrors: result.originalErrors || [],
          fixedErrors: result.fixedErrors || [],
          elapsed,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Final validation
      const finalValidation = result.spec 
        ? ApplicationSpecValidator.validate(result.spec)
        : validation;

      console.log(`[Repair] Success after ${result.repairAttempts} attempts`, {
        fixed: result.fixedErrors?.length || 0,
        elapsed,
      });

      res.json({
        success: true,
        data: result.spec,
        repairAttempts: result.repairAttempts,
        originalErrors: result.originalErrors || [],
        fixedErrors: result.fixedErrors || [],
        validation: finalValidation,
        summary: {
          fixed: result.fixedErrors?.length || 0,
          totalOriginal: result.originalErrors?.length || 0,
          isValidNow: finalValidation.isValid,
        },
        elapsed,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error('[Repair] Error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        elapsed,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ============================================================
  // GENERATE WORKFLOW WITH SELF-CORRECTION
  // ============================================================

  /**
   * Generate workflow with self-correction
   * 
   * POST /api/v1/ai/generate-workflow-v2
   * 
   * Request body:
   * {
   *   "description": "Send weekly sales report every Monday at 9 AM",
   *   "maxAttempts": 3
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": { ...workflow spec... },
   *   "repairAttempts": 0,
   *   "isRepaired": false,
   *   "summary": {
   *     "triggers": 1,
   *     "steps": 5
   *   }
   * }
   */
  async generateWorkflow(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { description, maxAttempts = 3 } = req.body;

      if (!description || typeof description !== 'string') {
        res.status(400).json({
          success: false,
          error: 'description is required and must be a string',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      console.log(`[Generation] Starting workflow generation: "${description.substring(0, 50)}..."`);

      // Generate workflow with self-correction
      const result = await this.generator.generateWorkflowWithSelfCorrection(
        description,
        maxAttempts
      );

      const elapsed = Date.now() - startTime;

      if (!result.success) {
        console.error(`[Generation] Workflow failed after ${result.repairAttempts} attempts`);
        res.status(422).json({
          success: false,
          error: 'Workflow generation failed after multiple repair attempts',
          repairAttempts: result.repairAttempts,
          maxAttempts,
          errors: result.originalErrors || [],
          elapsed,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const response = {
        success: true,
        data: result.spec,
        validation: result.validation,
        repairAttempts: result.repairAttempts,
        isRepaired: result.isRepaired || false,
        fixedErrors: result.fixedErrors || [],
        summary: {
          triggers: result.spec?.triggers?.length || 0,
          steps: result.spec?.steps?.length || 0,
          hasErrorHandling: !!result.spec?.errorHandling,
        },
        elapsed,
        timestamp: new Date().toISOString(),
      };

      console.log(`[Generation] Workflow success: "${description.substring(0, 50)}..."`, {
        repairAttempts: result.repairAttempts,
        steps: result.spec?.steps?.length || 0,
        elapsed,
      });

      res.json(response);

    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error('[Generation] Workflow error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        elapsed,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ============================================================
  // BULK GENERATION
  // ============================================================

  /**
   * Generate multiple applications from a list of descriptions
   * 
   * POST /api/v1/ai/bulk-generate
   * 
   * Request body:
   * {
   *   "descriptions": [
   *     "Build a todo app",
   *     "Build a customer dashboard"
   *   ],
   *   "context": {}
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "results": [
   *     { "description": "Build a todo app", "success": true, "data": {...} },
   *     { "description": "Build a customer dashboard", "success": false, "error": "..." }
   *   ],
   *   "summary": {
   *     "total": 2,
   *     "successful": 1,
   *     "failed": 1
   *   }
   * }
   */
  async bulkGenerate(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { descriptions, context = {}, maxAttempts = 2 } = req.body;

      if (!descriptions || !Array.isArray(descriptions) || descriptions.length === 0) {
        res.status(400).json({
          success: false,
          error: 'descriptions is required and must be a non-empty array',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (descriptions.length > 10) {
        res.status(400).json({
          success: false,
          error: 'Too many descriptions. Maximum 10 per request.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      console.log(`[Bulk] Starting bulk generation for ${descriptions.length} applications`);

      // Generate each application in sequence (not parallel to avoid rate limits)
      const results = [];
      let successful = 0;
      let failed = 0;

      for (const description of descriptions) {
        try {
          const result = await this.generator.generateApplicationWithSelfCorrection(
            description,
            context,
            maxAttempts
          );

          results.push({
            description,
            success: result.success,
            data: result.success ? result.spec : undefined,
            repairAttempts: result.repairAttempts,
            isRepaired: result.isRepaired,
            errors: result.success ? undefined : result.originalErrors,
            summary: result.success ? {
              entities: result.spec?.entities?.length || 0,
              pages: result.spec?.pages?.length || 0,
            } : undefined,
          });

          if (result.success) successful++;
          else failed++;

        } catch (error) {
          results.push({
            description,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          failed++;
        }
      }

      const elapsed = Date.now() - startTime;

      console.log(`[Bulk] Completed: ${successful} success, ${failed} failed`, { elapsed });

      res.json({
        success: true,
        results,
        summary: {
          total: descriptions.length,
          successful,
          failed,
          successRate: `${Math.round((successful / descriptions.length) * 100)}%`,
        },
        elapsed,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error('[Bulk] Error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        elapsed,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ============================================================
  // GENERATION STATS
  // ============================================================

  /**
   * Get generation statistics
   * 
   * GET /api/v1/ai/generation-stats
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "totalGenerations": 42,
   *     "successRate": "95%",
   *     "averageRepairAttempts": 1.2,
   *     "averageElapsedMs": 3420,
   *     "byType": {
   *       "application": 30,
   *       "workflow": 12
   *     }
   *   }
   * }
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement actual stats collection
      res.json({
        success: true,
        data: {
          totalGenerations: 0,
          successRate: 'N/A',
          averageRepairAttempts: 0,
          averageElapsedMs: 0,
          byType: {
            application: 0,
            workflow: 0,
          },
        },
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

// ============================================================
// EXPORTS
// ============================================================

export default GenerationController;
