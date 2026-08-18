import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';

/**
 * VYENFITA AI Routes
 * All routes are prefixed with /api/v1/ai
 */
export function createAIRouter(): Router {
  const router = Router();
  const controller = new AIController();

  // Health check - public (optional)
  router.get('/health', (req, res) => controller.healthCheck(req, res));

  // Protected routes
  router.use(AuthMiddleware.validate);

  // Chat completion
  router.post(
    '/chat',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.chat),
    (req, res) => controller.chat(req, res)
  );

  // Generate application
  router.post(
    '/generate-application',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateApplication),
    (req, res) => controller.generateApplication(req, res)
  );

  // Generate workflow
  router.post(
    '/generate-workflow',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateWorkflow),
    (req, res) => controller.generateWorkflow(req, res)
  );

  // Switch provider
  router.post(
    '/switch-provider',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.switchProvider),
    (req, res) => controller.switchProvider(req, res)
  );

  return router;
}
