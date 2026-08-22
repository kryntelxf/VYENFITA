import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { GenerationController } from '../controllers/generation.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';

/**
 * VYENFITA AI Routes
 * All routes are prefixed with /api/v1/ai
 */
export function createAIRouter(): Router {
  const router = Router();
  const controller = new AIController();
  const generationController = new GenerationController();

  // ============================================================
  // PUBLIC ROUTES
  // ============================================================
  
  // Health check - public
  router.get('/health', (req, res) => controller.healthCheck(req, res));

  // ============================================================
  // PROTECTED ROUTES (require authentication)
  // ============================================================
  
  router.use(AuthMiddleware.validate);

  // ============================================================
  // AI CHAT ROUTES
  // ============================================================

  // Chat completion
  router.post(
    '/chat',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.chat),
    (req, res) => controller.chat(req, res)
  );

  // ============================================================
  // APPLICATION GENERATION ROUTES (Legacy)
  // ============================================================

  // Generate application (legacy - without self-correction)
  router.post(
    '/generate-application',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateApplication),
    (req, res) => controller.generateApplication(req, res)
  );

  // Generate workflow (legacy)
  router.post(
    '/generate-workflow',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateWorkflow),
    (req, res) => controller.generateWorkflow(req, res)
  );

  // ============================================================
  // APPLICATION GENERATION ROUTES V2 (with self-correction)
  // ============================================================

  // Generate application with self-correction
  router.post(
    '/generate-application-v2',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateApplication),
    (req, res) => generationController.generateApplication(req, res)
  );

  // Validate application specification
  router.post(
    '/validate-spec',
    (req, res) => generationController.validateSpec(req, res)
  );

  // Repair invalid specification
  router.post(
    '/repair-spec',
    (req, res) => generationController.repairSpec(req, res)
  );

  // ============================================================
  // PROVIDER ROUTES
  // ============================================================

  // Switch AI provider
  router.post(
    '/switch-provider',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.switchProvider),
    (req, res) => controller.switchProvider(req, res)
  );

  // ============================================================
  // FALLBACK
  // ============================================================

  // 404 handler for AI routes
  router.use((req, res) => {
    res.status(404).json({
      success: false,
      error: `Route ${req.method} ${req.path} not found`,
    });
  });

  return router;
    }
