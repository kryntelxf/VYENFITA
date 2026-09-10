/**
 * VYENFITA AI Routes
 * 
 * All routes are prefixed with /api/v1/ai
 * 
 * Routes:
 * - Health check
 * - Chat completion
 * - Application generation (V1, V2, Multi-Step)
 * - Workflow generation
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
 * @version 2.0.0
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
import { NaturalLanguageToSQLController } from '../controllers/nl-to-sql.controller';
import { ScheduledReportController } from '../controllers/scheduled-report.controller';
import { CodeGeneratorController } from '../controllers/code-generator.controller';
import { PluginController } from '../controllers/plugin.controller';
import { MarketplaceController } from '../controllers/marketplace.controller';
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
  const nlToSQLController = new NaturalLanguageToSQLController();
  const scheduledReportController = new ScheduledReportController();
  const codeGeneratorController = new CodeGeneratorController();
  const pluginController = new PluginController();
  const marketplaceController = new MarketplaceController();

  // ============================================================
  // PUBLIC ROUTES (no auth)
  // ============================================================

  /**
   * Health check
   * GET /api/v1/ai/health
   */
  router.get('/health', (req, res) => controller.healthCheck(req, res));

  // ============================================================
  // PROTECTED ROUTES
  // ============================================================

  router.use(AuthMiddleware.validate);

  // ============================================================
  // AI CHAT
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
  // APPLICATION GENERATION
  // ============================================================

  /**
   * Generate application (V1)
   * POST /api/v1/ai/generate-application
   */
  router.post(
    '/generate-application',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateApplication),
    (req, res) => generationController.generateApplication(req, res)
  );

  /**
   * Generate application with self-correction (V2)
   * POST /api/v1/ai/generate-application-v2
   */
  router.post(
    '/generate-application-v2',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateApplication),
    (req, res) => generationController.generateApplication(req, res)
  );

  /**
   * Generate application with multi-step process
   * POST /api/v1/ai/generate-multi-step
   */
  router.post(
    '/generate-multi-step',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateApplication),
    (req, res) => multiStepController.generate(req, res)
  );

  /**
   * Generate workflow
   * POST /api/v1/ai/generate-workflow
   */
  router.post(
    '/generate-workflow',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateWorkflow),
    (req, res) => controller.generateWorkflow(req, res)
  );

  /**
   * Generate workflow with self-correction
   * POST /api/v1/ai/generate-workflow-v2
   */
  router.post(
    '/generate-workflow-v2',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.generateWorkflow),
    (req, res) => controller.generateWorkflow(req, res)
  );

  // ============================================================
  // SELF-CORRECTION
  // ============================================================

  /**
   * Validate spec
   * POST /api/v1/ai/validate-spec
   */
  router.post('/validate-spec', (req, res) => generationController.validateSpec(req, res));

  /**
   * Repair spec
   * POST /api/v1/ai/repair-spec
   */
  router.post('/repair-spec', (req, res) => generationController.repairSpec(req, res));

  // ============================================================
  // BULK GENERATION
  // ============================================================

  /**
   * Bulk generate
   * POST /api/v1/ai/bulk-generate
   */
  router.post('/bulk-generate', (req, res) => generationController.bulkGenerate(req, res));

  /**
   * Generation stats
   * GET /api/v1/ai/generation-stats
   */
  router.get('/generation-stats', (req, res) => generationController.getStats(req, res));

  // ============================================================
  // PROVIDER
  // ============================================================

  /**
   * Switch provider
   * POST /api/v1/ai/switch-provider
   */
  router.post(
    '/switch-provider',
    ValidationMiddleware.validate(ValidationMiddleware.schemas.switchProvider),
    (req, res) => controller.switchProvider(req, res)
  );

  /**
   * Get provider info
   * GET /api/v1/ai/provider
   */
  router.get('/provider', (req, res) => controller.getProviderInfo(req, res));

  // ============================================================
  // BUSINESS INTELLIGENCE
  // ============================================================

  router.post('/bi/ask', (req, res) => biController.ask(req, res));
  router.post('/bi/anomalies', (req, res) => biController.detectAnomalies(req, res));
  router.post('/bi/kpi', (req, res) => biController.generateKPI(req, res));
  router.post('/bi/predict', (req, res) => biController.predict(req, res));
  router.post('/bi/report', (req, res) => biController.generateReport(req, res));

  // ============================================================
  // VERSIONING
  // ============================================================

  router.post('/versioning/create', (req, res) => versioningController.createApplication(req, res));
  router.get('/versioning/applications', (req, res) => versioningController.getAllApplications(req, res));
  router.get('/versioning/applications/:appId', (req, res) => versioningController.getApplication(req, res));
  router.get('/versioning/applications/:appId/versions', (req, res) => versioningController.getVersions(req, res));
  router.get('/versioning/applications/:appId/versions/:version', (req, res) => versioningController.getVersion(req, res));
  router.get(
    '/versioning/applications/:appId/versions/:versionFrom/diff/:versionTo',
    (req, res) => versioningController.diff(req, res)
  );
  router.post('/versioning/applications/:appId/versions', (req, res) => versioningController.createVersion(req, res));
  router.post('/versioning/applications/:appId/rollback/:version', (req, res) => versioningController.rollback(req, res));
  router.delete('/versioning/applications/:appId', (req, res) => versioningController.deleteApplication(req, res));

  // ============================================================
  // AI AGENTS
  // ============================================================

  router.post('/agents/analyze-requirements', (req, res) => agentController.analyzeRequirements(req, res));
  router.post('/agents/refine-requirements', (req, res) => agentController.refineRequirements(req, res));
  router.post('/agents/generate-questions', (req, res) => agentController.generateQuestions(req, res));
  router.post('/agents/design-architecture', (req, res) => agentController.designArchitecture(req, res));
  router.post('/agents/evaluate-architecture', (req, res) => agentController.evaluateArchitecture(req, res));
  router.post('/agents/generate-tests', (req, res) => agentController.generateTests(req, res));
  router.post('/agents/execute-tests', (req, res) => agentController.executeTests(req, res));
  router.post('/agents/analyze-test-results', (req, res) => agentController.analyzeTestResults(req, res));

  // ============================================================
  // VISUALIZATION
  // ============================================================

  router.post('/visualization/generate', (req, res) => visualizationController.generate(req, res));
  router.post('/visualization/dashboard', (req, res) => visualizationController.generateDashboard(req, res));

  // ============================================================
  // EXPORT / IMPORT
  // ============================================================

  router.post('/export/json', (req, res) => exportImportController.exportJSON(req, res));
  router.post('/import/json', (req, res) => exportImportController.importJSON(req, res));
  router.post('/export/zip', (req, res) => exportImportController.exportZIP(req, res));
  router.post('/import/zip', (req, res) => exportImportController.importZIP(req, res));
  router.post('/backup/create', (req, res) => exportImportController.createBackup(req, res));
  router.post('/backup/restore', (req, res) => exportImportController.restoreBackup(req, res));
  router.post('/export/compare', (req, res) => exportImportController.compareVersions(req, res));

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  router.post('/notifications/send', (req, res) => notificationController.send(req, res));
  router.get('/notifications/:id', (req, res) => notificationController.getStatus(req, res));
  router.get('/notifications', (req, res) => notificationController.getAll(req, res));

  // ============================================================
  // ACTIVITY LOGS
  // ============================================================

  router.post('/activity-logs/log', (req, res) => activityLogController.log(req, res));
  router.get('/activity-logs/user/:userId', (req, res) => activityLogController.getByUser(req, res));
  router.get('/activity-logs/tenant/:tenantId', (req, res) => activityLogController.getByTenant(req, res));
  router.get('/activity-logs/action/:action', (req, res) => activityLogController.getByAction(req, res));
  router.get('/activity-logs/recent', (req, res) => activityLogController.getRecent(req, res));
  router.get('/activity-logs/stats', (req, res) => activityLogController.getStats(req, res));
  router.post('/activity-logs/clear', (req, res) => activityLogController.clearOldLogs(req, res));

  // ============================================================
  // NATURAL LANGUAGE TO SQL
  // ============================================================

  router.post('/nl-to-sql', (req, res) => nlToSQLController.convertToSQL(req, res));
  router.post('/nl-to-sql/validate', (req, res) => nlToSQLController.validateSQL(req, res));
  router.post('/nl-to-sql/optimize', (req, res) => nlToSQLController.optimizeSQL(req, res));

  // ============================================================
  // SCHEDULED REPORTS
  // ============================================================

  router.post('/reports', (req, res) => scheduledReportController.createReport(req, res));
  router.get('/reports', (req, res) => scheduledReportController.getReports(req, res));
  router.get('/reports/:id', (req, res) => scheduledReportController.getReport(req, res));
  router.put('/reports/:id', (req, res) => scheduledReportController.updateReport(req, res));
  router.post('/reports/:id/execute', (req, res) => scheduledReportController.executeReport(req, res));
  router.get('/reports/:id/history', (req, res) => scheduledReportController.getReportHistory(req, res));
  router.delete('/reports/:id', (req, res) => scheduledReportController.deleteReport(req, res));

  // ============================================================
  // CODE GENERATION
  // ============================================================

  router.post('/code', (req, res) => codeGeneratorController.generateCode(req, res));
  router.post('/code/api', (req, res) => codeGeneratorController.generateAPI(req, res));

  // ============================================================
  // PLUGINS
  // ============================================================

  router.post('/plugins/register', (req, res) => pluginController.register(req, res));
  router.get('/plugins', (req, res) => pluginController.getAll(req, res));
  router.get('/plugins/:pluginId', (req, res) => pluginController.get(req, res));
  router.post('/plugins/:pluginId/enable', (req, res) => pluginController.enable(req, res));
  router.post('/plugins/:pluginId/disable', (req, res) => pluginController.disable(req, res));
  router.delete('/plugins/:pluginId', (req, res) => pluginController.unregister(req, res));
  router.patch('/plugins/:pluginId/config', (req, res) => pluginController.updateConfig(req, res));

  // ============================================================
  // MARKETPLACE
  // ============================================================

  router.get('/marketplace/templates', (req, res) => marketplaceController.getTemplates(req, res));
  router.get('/marketplace/templates/:templateId', (req, res) => marketplaceController.getTemplate(req, res));
  router.post('/marketplace/templates', (req, res) => marketplaceController.uploadTemplate(req, res));
  router.post('/marketplace/templates/:templateId/download', (req, res) => marketplaceController.downloadTemplate(req, res));
  router.post('/marketplace/templates/:templateId/reviews', (req, res) => marketplaceController.addReview(req, res));
  router.get('/marketplace/top', (req, res) => marketplaceController.getTopTemplates(req, res));
  router.get('/marketplace/popular', (req, res) => marketplaceController.getPopularTemplates(req, res));
  router.delete('/marketplace/templates/:templateId', (req, res) => marketplaceController.deleteTemplate(req, res));

  // ============================================================
  // 404 FALLBACK
  // ============================================================

  router.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'AI route not found',
      message: `Route ${req.method} ${req.path} does not exist`,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

export default createAIRouter;
