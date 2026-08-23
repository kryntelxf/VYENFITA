/**
 * VYENFITA AI Routes
 * 
 * All routes are prefixed with /api/v1/ai
 * 
 * This file contains all AI-related routes including:
 * - Chat completion
 * - Application generation (V1, V2, Multi-Step)
 * - Workflow generation (V1, V2)
 * - Self-correction (Validate, Repair)
 * - Provider management
 * - Bulk generation
 * - Generation statistics
 * - Business Intelligence
 * - Versioning
 * 
 * @version 1.0.0
 * @since 0.1.0
 */

import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { GenerationController } from '../controllers/generation.controller';
import { MultiStepController } from '../controllers/multi-step.controller';
import { BusinessIntelligenceController } from '../controllers/bi.controller';
import { VersioningController } from '../controllers/versioning.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';

// ============================================================
// ROUTE FACTORY
// ============================================================

export function createAIRouter(): Router {
  const router = Router();
  
  // Initialize controllers
  const controller = new AIController();
  const generationController = new GenerationController();
  const multiStepController = new MultiStepController();
  const biController = new BusinessIntelligenceController();
  const versioningController = new VersioningController();

  // ============================================================
  // PUBLIC ROUTES (No authentication required)
  // ============================================================
  
  /**
   * Health check endpoint
   * GET /api/v1/ai/health
   * 
   * Returns service health status, version, and available providers
   */
  router.get('/health', (req, res) => controller.healthCheck(req, res));

  // ============================================================
  // PROTECTED ROUTES (Authentication required)
  // ============================================================
  
  router.use(AuthMiddleware.validate);

  // ============================================================
  // AI CHAT ROUTES
  // ============================================================

  /**
   * Chat completion
   * POST /api/v1/ai/chat
   * 
   * Request body:
   * {
   *   "messages": [{"role": "user", "content": "Hello"}],
   *   "temperature": 0.7,
   *   "maxTokens": 4096
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {...chat response...},
   *   "provider": "openai"
   * }
   */
  router.post(
    '/chat',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.chat),
    (req, res) => controller.chat(req, res)
  );

  // ============================================================
  // APPLICATION GENERATION ROUTES (Legacy V1)
  // ============================================================

  /**
   * Generate application (Legacy V1 - without self-correction)
   * POST /api/v1/ai/generate-application
   * 
   * @deprecated Use /generate-application-v2 instead
   */
  router.post(
    '/generate-application',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateApplication),
    (req, res) => controller.generateApplication(req, res)
  );

  /**
   * Generate workflow (Legacy V1 - without self-correction)
   * POST /api/v1/ai/generate-workflow
   * 
   * @deprecated Use /generate-workflow-v2 instead
   */
  router.post(
    '/generate-workflow',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateWorkflow),
    (req, res) => controller.generateWorkflow(req, res)
  );

  // ============================================================
  // APPLICATION GENERATION V2 (with self-correction)
  // ============================================================

  /**
   * Generate application with self-correction
   * POST /api/v1/ai/generate-application-v2
   * 
   * Request body:
   * {
   *   "description": "Build a customer support platform...",
   *   "context": {"industry": "ecommerce"},
   *   "maxAttempts": 3
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {...application spec...},
   *   "validation": {"isValid": true, "warnings": []},
   *   "repairAttempts": 1,
   *   "isRepaired": true,
   *   "fixedErrors": [...],
   *   "summary": {
   *     "entities": 5,
   *     "pages": 3,
   *     "queries": 8,
   *     "workflows": 2,
   *     "roles": 3,
   *     "dataSources": 2,
   *     "integrations": 1,
   *     "requirements": 10
   *   }
   * }
   */
  router.post(
    '/generate-application-v2',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateApplication),
    (req, res) => generationController.generateApplication(req, res)
  );

  /**
   * Generate workflow with self-correction
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
   *   "data": {...workflow spec...},
   *   "repairAttempts": 0,
   *   "isRepaired": false,
   *   "summary": {
   *     "triggers": 1,
   *     "steps": 5
   *   }
   * }
   */
  router.post(
    '/generate-workflow-v2',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateWorkflow),
    (req, res) => generationController.generateWorkflow(req, res)
  );

  // ============================================================
  // MULTI-STEP GENERATION (Advanced)
  // ============================================================

  /**
   * Generate application with multi-step process
   * POST /api/v1/ai/generate-multi-step
   * 
   * Generates application in 6 steps:
   * 1. Requirement Analysis
   * 2. Architecture Design
   * 3. Data Model Design
   * 4. UI/UX Design
   * 5. Application Build
   * 6. Validation & Repair
   * 
   * Request body:
   * {
   *   "description": "Build a customer support platform...",
   *   "context": {"industry": "ecommerce"}
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {...application spec...},
   *   "steps": [
   *     {"id": "requirement-analysis", "status": "completed"},
   *     {"id": "architecture-design", "status": "completed"},
   *     ...
   *   ],
   *   "errors": [],
   *   "warnings": [],
   *   "summary": {
   *     "steps": 6,
   *     "completed": 6,
   *     "failed": 0,
   *     "entities": 5,
   *     "pages": 3
   *   }
   * }
   */
  router.post(
    '/generate-multi-step',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateApplication),
    (req, res) => multiStepController.generate(req, res)
  );

  // ============================================================
  // SELF-CORRECTION ROUTES
  // ============================================================

  /**
   * Validate application specification
   * POST /api/v1/ai/validate-spec
   * 
   * Request body:
   * {
   *   "spec": {...application spec...},
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
  router.post(
    '/validate-spec',
    (req, res) => generationController.validateSpec(req, res)
  );

  /**
   * Repair invalid specification
   * POST /api/v1/ai/repair-spec
   * 
   * Request body:
   * {
   *   "spec": {...invalid spec...},
   *   "maxAttempts": 3
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {...repaired spec...},
   *   "repairAttempts": 1,
   *   "originalErrors": [...],
   *   "fixedErrors": [...],
   *   "summary": {
   *     "fixed": 3,
   *     "totalOriginal": 3,
   *     "isValidNow": true
   *   }
   * }
   */
  router.post(
    '/repair-spec',
    (req, res) => generationController.repairSpec(req, res)
  );

  // ============================================================
  // BULK GENERATION
  // ============================================================

  /**
   * Generate multiple applications in one request
   * POST /api/v1/ai/bulk-generate
   * 
   * Request body:
   * {
   *   "descriptions": [
   *     "Build a todo app",
   *     "Build a customer dashboard",
   *     "Build an inventory management system"
   *   ],
   *   "context": {},
   *   "maxAttempts": 2
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "results": [
   *     {"description": "Build a todo app", "success": true, "data": {...}},
   *     {"description": "Build a customer dashboard", "success": false, "error": "..."}
   *   ],
   *   "summary": {
   *     "total": 3,
   *     "successful": 2,
   *     "failed": 1,
   *     "successRate": "67%"
   *   }
   * }
   */
  router.post(
    '/bulk-generate',
    (req, res) => generationController.bulkGenerate(req, res)
  );

  // ============================================================
  // GENERATION STATISTICS
  // ============================================================

  /**
   * Get generation statistics
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
  router.get(
    '/generation-stats',
    (req, res) => generationController.getStats(req, res)
  );

  // ============================================================
  // PROVIDER ROUTES
  // ============================================================

  /**
   * Switch AI provider
   * POST /api/v1/ai/switch-provider
   * 
   * Request body:
   * {
   *   "provider": "openai" | "anthropic" | "gemini"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "provider": "openai"
   * }
   */
  router.post(
    '/switch-provider',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.switchProvider),
    (req, res) => controller.switchProvider(req, res)
  );

  /**
   * Get current provider information
   * GET /api/v1/ai/provider
   * 
   * Response:
   * {
   *   "success": true,
   *   "provider": "openai",
   *   "available": ["openai", "anthropic"]
   * }
   */
  router.get(
    '/provider',
    (req, res) => controller.getProviderInfo(req, res)
  );

  // ============================================================
  // BUSINESS INTELLIGENCE ROUTES
  // ============================================================

  /**
   * Ask a business question
   * POST /api/v1/bi/ask
   * 
   * Request body:
   * {
   *   "question": "Why did revenue decline this month?",
   *   "data": [...],
   *   "context": {}
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "answer": "Revenue declined because...",
   *     "confidence": 0.85,
   *     "evidence": [...],
   *     "recommendations": [...]
   *   }
   * }
   */
  router.post(
    '/bi/ask',
    (req, res) => biController.ask(req, res)
  );

  /**
   * Detect anomalies in data
   * POST /api/v1/bi/anomalies
   * 
   * Request body:
   * {
   *   "data": [...],
   *   "metrics": ["revenue", "users", "conversion"]
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "anomalies": [...],
   *     "summary": "..."
   *   }
   * }
   */
  router.post(
    '/bi/anomalies',
    (req, res) => biController.detectAnomalies(req, res)
  );

  /**
   * Generate KPI dashboard
   * POST /api/v1/bi/kpi
   * 
   * Request body:
   * {
   *   "data": [...],
   *   "metrics": ["revenue", "users", "conversion"]
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "metrics": [...],
   *     "charts": [...],
   *     "insights": [...]
   *   }
   * }
   */
  router.post(
    '/bi/kpi',
    (req, res) => biController.generateKPI(req, res)
  );

  /**
   * Generate predictive analytics
   * POST /api/v1/bi/predict
   * 
   * Request body:
   * {
   *   "data": [...],
   *   "target": "revenue",
   *   "horizon": "3 months"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "predictions": [...],
   *     "trend": "up",
   *     "confidence": 0.85,
   *     "recommendations": [...]
   *   }
   * }
   */
  router.post(
    '/bi/predict',
    (req, res) => biController.predict(req, res)
  );

  /**
   * Generate business report
   * POST /api/v1/bi/report
   * 
   * Request body:
   * {
   *   "data": [...],
   *   "reportType": "business|financial|sales|marketing",
   *   "period": "Q1 2024"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": "...report content..."
   * }
   */
  router.post(
    '/bi/report',
    (req, res) => biController.generateReport(req, res)
  );

  // ============================================================
  // VERSIONING ROUTES
  // ============================================================

  /**
   * Create a new application with initial version
   * POST /api/v1/versioning/create
   * 
   * Request body:
   * {
   *   "name": "My Application",
   *   "spec": {...application spec...},
   *   "createdBy": "user@example.com"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "id": "...",
   *     "name": "My Application",
   *     "currentVersion": "1.0.0",
   *     "versions": [...]
   *   }
   * }
   */
  router.post(
    '/versioning/create',
    (req, res) => versioningController.createApplication(req, res)
  );

  /**
   * Get all applications
   * GET /api/v1/versioning/applications
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": [...applications...],
   *   "count": 5
   * }
   */
  router.get(
    '/versioning/applications',
    (req, res) => versioningController.getAllApplications(req, res)
  );

  /**
   * Get a specific application
   * GET /api/v1/versioning/applications/:appId
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {...application...}
   * }
   */
  router.get(
    '/versioning/applications/:appId',
    (req, res) => versioningController.getApplication(req, res)
  );

  /**
   * Get all versions of an application
   * GET /api/v1/versioning/applications/:appId/versions
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": [...versions...],
   *   "count": 3
   * }
   */
  router.get(
    '/versioning/applications/:appId/versions',
    (req, res) => versioningController.getVersions(req, res)
  );

  /**
   * Get a specific version
   * GET /api/v1/versioning/applications/:appId/versions/:version
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {...version...}
   * }
   */
  router.get(
    '/versioning/applications/:appId/versions/:version',
    (req, res) => versioningController.getVersion(req, res)
  );

  /**
   * Get diff between two versions
   * GET /api/v1/versioning/applications/:appId/versions/:versionFrom/diff/:versionTo
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "versionFrom": "1.0.0",
   *     "versionTo": "1.1.0",
   *     "changes": [...],
   *     "summary": {
   *       "added": 2,
   *       "modified": 1,
   *       "removed": 0
   *     }
   *   }
   * }
   */
  router.get(
    '/versioning/applications/:appId/versions/:versionFrom/diff/:versionTo',
    (req, res) => versioningController.diff(req, res)
  );

  /**
   * Create a new version
   * POST /api/v1/versioning/applications/:appId/versions
   * 
   * Request body:
   * {
   *   "spec": {...updated spec...},
   *   "changeLog": "Added new features",
   *   "createdBy": "user@example.com"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {...updated application...}
   * }
   */
  router.post(
    '/versioning/applications/:appId/versions',
    (req, res) => versioningController.createVersion(req, res)
  );

  /**
   * Rollback to a previous version
   * POST /api/v1/versioning/applications/:appId/rollback/:version
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "id": "...",
   *     "currentVersion": "1.1.1",
   *     "message": "Rolled back to version 1.0.0"
   *   }
   * }
   */
  router.post(
    '/versioning/applications/:appId/rollback/:version',
    (req, res) => versioningController.rollback(req, res)
  );

  /**
   * Delete an application
   * DELETE /api/v1/versioning/applications/:appId
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Application deleted successfully"
   * }
   */
  router.delete(
    '/versioning/applications/:appId',
    (req, res) => versioningController.deleteApplication(req, res)
  );

  // ============================================================
  // 404 HANDLER (AI routes only)
  // ============================================================

  /**
   * Catch-all for undefined AI routes
   */
  router.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      message: `Route ${req.method} ${req.path} does not exist`,
      availableRoutes: [
        // AI Routes
        'GET /health',
        'POST /chat',
        'POST /generate-application',
        'POST /generate-workflow',
        'POST /generate-application-v2',
        'POST /generate-workflow-v2',
        'POST /generate-multi-step',
        'POST /validate-spec',
        'POST /repair-spec',
        'POST /bulk-generate',
        'GET /generation-stats',
        'POST /switch-provider',
        'GET /provider',
        // BI Routes
        'POST /bi/ask',
        'POST /bi/anomalies',
        'POST /bi/kpi',
        'POST /bi/predict',
        'POST /bi/report',
        // Versioning Routes
        'POST /versioning/create',
        'GET /versioning/applications',
        'GET /versioning/applications/:appId',
        'GET /versioning/applications/:appId/versions',
        'GET /versioning/applications/:appId/versions/:version',
        'GET /versioning/applications/:appId/versions/:from/diff/:to',
        'POST /versioning/applications/:appId/versions',
        'POST /versioning/applications/:appId/rollback/:version',
        'DELETE /versioning/applications/:appId',
      ],
      totalEndpoints: 28,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

// ============================================================
// EXPORTS
// ============================================================

export default createAIRouter;
