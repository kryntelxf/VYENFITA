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
 * - AI Agents (Requirement, Architecture, Testing)
 * - Visualization
 * - Export/Import
 * - Notifications
 * - Activity Logs
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
import { AgentController } from '../controllers/agent.controller';
import { VisualizationController } from '../controllers/visualization.controller';
import { ExportImportController } from '../controllers/export-import.controller';
import { NotificationController } from '../controllers/notification.controller';
import { ActivityLogController } from '../controllers/activity-log.controller';
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
  const agentController = new AgentController();
  const visualizationController = new VisualizationController();
  const exportImportController = new ExportImportController();
  const notificationController = new NotificationController();
  const activityLogController = new ActivityLogController();

  // ============================================================
  // PUBLIC ROUTES (No authentication required)
  // ============================================================
  
  /**
   * Health check endpoint
   * GET /api/v1/ai/health
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
   * Generate application (Legacy V1)
   * POST /api/v1/ai/generate-application
   * @deprecated Use /generate-application-v2 instead
   */
  router.post(
    '/generate-application',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateApplication),
    (req, res) => controller.generateApplication(req, res)
  );

  /**
   * Generate workflow (Legacy V1)
   * POST /api/v1/ai/generate-workflow
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
   */
  router.post(
    '/generate-application-v2',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateApplication),
    (req, res) => generationController.generateApplication(req, res)
  );

  /**
   * Generate workflow with self-correction
   * POST /api/v1/ai/generate-workflow-v2
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
   */
  router.post(
    '/validate-spec',
    (req, res) => generationController.validateSpec(req, res)
  );

  /**
   * Repair invalid specification
   * POST /api/v1/ai/repair-spec
   */
  router.post(
    '/repair-spec',
    (req, res) => generationController.repairSpec(req, res)
  );

  // ============================================================
  // BULK GENERATION
  // ============================================================

  /**
   * Generate multiple applications
   * POST /api/v1/ai/bulk-generate
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
   */
  router.post(
    '/switch-provider',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.switchProvider),
    (req, res) => controller.switchProvider(req, res)
  );

  /**
   * Get current provider information
   * GET /api/v1/ai/provider
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
   */
  router.post(
    '/bi/ask',
    (req, res) => biController.ask(req, res)
  );

  /**
   * Detect anomalies
   * POST /api/v1/bi/anomalies
   */
  router.post(
    '/bi/anomalies',
    (req, res) => biController.detectAnomalies(req, res)
  );

  /**
   * Generate KPI dashboard
   * POST /api/v1/bi/kpi
   */
  router.post(
    '/bi/kpi',
    (req, res) => biController.generateKPI(req, res)
  );

  /**
   * Generate predictions
   * POST /api/v1/bi/predict
   */
  router.post(
    '/bi/predict',
    (req, res) => biController.predict(req, res)
  );

  /**
   * Generate business report
   * POST /api/v1/bi/report
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
   */
  router.post(
    '/versioning/create',
    (req, res) => versioningController.createApplication(req, res)
  );

  /**
   * Get all applications
   * GET /api/v1/versioning/applications
   */
  router.get(
    '/versioning/applications',
    (req, res) => versioningController.getAllApplications(req, res)
  );

  /**
   * Get a specific application
   * GET /api/v1/versioning/applications/:appId
   */
  router.get(
    '/versioning/applications/:appId',
    (req, res) => versioningController.getApplication(req, res)
  );

  /**
   * Get all versions of an application
   * GET /api/v1/versioning/applications/:appId/versions
   */
  router.get(
    '/versioning/applications/:appId/versions',
    (req, res) => versioningController.getVersions(req, res)
  );

  /**
   * Get a specific version
   * GET /api/v1/versioning/applications/:appId/versions/:version
   */
  router.get(
    '/versioning/applications/:appId/versions/:version',
    (req, res) => versioningController.getVersion(req, res)
  );

  /**
   * Get diff between two versions
   * GET /api/v1/versioning/applications/:appId/versions/:versionFrom/diff/:versionTo
   */
  router.get(
    '/versioning/applications/:appId/versions/:versionFrom/diff/:versionTo',
    (req, res) => versioningController.diff(req, res)
  );

  /**
   * Create a new version
   * POST /api/v1/versioning/applications/:appId/versions
   */
  router.post(
    '/versioning/applications/:appId/versions',
    (req, res) => versioningController.createVersion(req, res)
  );

  /**
   * Rollback to a previous version
   * POST /api/v1/versioning/applications/:appId/rollback/:version
   */
  router.post(
    '/versioning/applications/:appId/rollback/:version',
    (req, res) => versioningController.rollback(req, res)
  );

  /**
   * Delete an application
   * DELETE /api/v1/versioning/applications/:appId
   */
  router.delete(
    '/versioning/applications/:appId',
    (req, res) => versioningController.deleteApplication(req, res)
  );

  // ============================================================
  // AI AGENTS ROUTES
  // ============================================================

  /**
   * Analyze requirements
   * POST /api/v1/agents/analyze-requirements
   */
  router.post(
    '/agents/analyze-requirements',
    (req, res) => agentController.analyzeRequirements(req, res)
  );

  /**
   * Refine requirements
   * POST /api/v1/agents/refine-requirements
   */
  router.post(
    '/agents/refine-requirements',
    (req, res) => agentController.refineRequirements(req, res)
  );

  /**
   * Generate clarifying questions
   * POST /api/v1/agents/generate-questions
   */
  router.post(
    '/agents/generate-questions',
    (req, res) => agentController.generateQuestions(req, res)
  );

  /**
   * Design architecture
   * POST /api/v1/agents/design-architecture
   */
  router.post(
    '/agents/design-architecture',
    (req, res) => agentController.designArchitecture(req, res)
  );

  /**
   * Evaluate architecture
   * POST /api/v1/agents/evaluate-architecture
   */
  router.post(
    '/agents/evaluate-architecture',
    (req, res) => agentController.evaluateArchitecture(req, res)
  );

  /**
   * Generate tests
   * POST /api/v1/agents/generate-tests
   */
  router.post(
    '/agents/generate-tests',
    (req, res) => agentController.generateTests(req, res)
  );

  /**
   * Execute tests
   * POST /api/v1/agents/execute-tests
   */
  router.post(
    '/agents/execute-tests',
    (req, res) => agentController.executeTests(req, res)
  );

  /**
   * Analyze test results
   * POST /api/v1/agents/analyze-test-results
   */
  router.post(
    '/agents/analyze-test-results',
    (req, res) => agentController.analyzeTestResults(req, res)
  );

  // ============================================================
  // VISUALIZATION ROUTES
  // ============================================================

  /**
   * Generate visualization
   * POST /api/v1/visualization/generate
   */
  router.post(
    '/visualization/generate',
    (req, res) => visualizationController.generate(req, res)
  );

  /**
   * Generate dashboard
   * POST /api/v1/visualization/dashboard
   */
  router.post(
    '/visualization/dashboard',
    (req, res) => visualizationController.generateDashboard(req, res)
  );

  // ============================================================
  // EXPORT/IMPORT ROUTES
  // ============================================================

  /**
   * Export to JSON
   * POST /api/v1/export/json
   */
  router.post(
    '/export/json',
    (req, res) => exportImportController.exportJSON(req, res)
  );

  /**
   * Import from JSON
   * POST /api/v1/import/json
   */
  router.post(
    '/import/json',
    (req, res) => exportImportController.importJSON(req, res)
  );

  /**
   * Export to ZIP
   * POST /api/v1/export/zip
   */
  router.post(
    '/export/zip',
    (req, res) => exportImportController.exportZIP(req, res)
  );

  /**
   * Import from ZIP
   * POST /api/v1/import/zip
   */
  router.post(
    '/import/zip',
    (req, res) => exportImportController.importZIP(req, res)
  );

  /**
   * Create backup
   * POST /api/v1/backup/create
   */
  router.post(
    '/backup/create',
    (req, res) => exportImportController.createBackup(req, res)
  );

  /**
   * Restore from backup
   * POST /api/v1/backup/restore
   */
  router.post(
    '/backup/restore',
    (req, res) => exportImportController.restoreBackup(req, res)
  );

  /**
   * Compare versions
   * POST /api/v1/export/compare
   */
  router.post(
    '/export/compare',
    (req, res) => exportImportController.compareVersions(req, res)
  );

  // ============================================================
  // NOTIFICATION ROUTES
  // ============================================================

  /**
   * Send notification
   * POST /api/v1/notifications/send
   */
  router.post(
    '/notifications/send',
    (req, res) => notificationController.send(req, res)
  );

  /**
   * Get notification status
   * GET /api/v1/notifications/:id
   */
  router.get(
    '/notifications/:id',
    (req, res) => notificationController.getStatus(req, res)
  );

  /**
   * Get all notifications
   * GET /api/v1/notifications
   */
  router.get(
    '/notifications',
    (req, res) => notificationController.getAll(req, res)
  );

  // ============================================================
  // ACTIVITY LOG ROUTES
  // ============================================================

  /**
   * Log an activity
   * POST /api/v1/activity-logs/log
   */
  router.post(
    '/activity-logs/log',
    (req, res) => activityLogController.log(req, res)
  );

  /**
   * Get logs by user
   * GET /api/v1/activity-logs/user/:userId
   */
  router.get(
    '/activity-logs/user/:userId',
    (req, res) => activityLogController.getByUser(req, res)
  );

  /**
   * Get logs by tenant
   * GET /api/v1/activity-logs/tenant/:tenantId
   */
  router.get(
    '/activity-logs/tenant/:tenantId',
    (req, res) => activityLogController.getByTenant(req, res)
  );

  /**
   * Get logs by action
   * GET /api/v1/activity-logs/action/:action
   */
  router.get(
    '/activity-logs/action/:action',
    (req, res) => activityLogController.getByAction(req, res)
  );

  /**
   * Get recent logs
   * GET /api/v1/activity-logs/recent
   */
  router.get(
    '/activity-logs/recent',
    (req, res) => activityLogController.getRecent(req, res)
  );

  /**
   * Get statistics
   * GET /api/v1/activity-logs/stats
   */
  router.get(
    '/activity-logs/stats',
    (req, res) => activityLogController.getStats(req, res)
  );

  /**
   * Clear old logs
   * POST /api/v1/activity-logs/clear
   */
  router.post(
    '/activity-logs/clear',
    (req, res) => activityLogController.clearOldLogs(req, res)
  );

  // ============================================================
  // 404 HANDLER
  // ============================================================

  router.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      message: `Route ${req.method} ${req.path} does not exist`,
      totalEndpoints: 90,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

// ============================================================
// EXPORTS
// ============================================================

export default createAIRouter;
