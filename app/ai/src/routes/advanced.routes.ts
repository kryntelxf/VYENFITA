/**
 * VYENFITA Advanced Routes
 * 
 * Routes for advanced features:
 * - Natural Language to SQL
 * - Scheduled Reports
 * - Code Generation
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { NaturalLanguageToSQLController } from '../controllers/nl-to-sql.controller';
import { ScheduledReportController } from '../controllers/scheduled-report.controller';
import { CodeGeneratorController } from '../controllers/code-generator.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';

export function createAdvancedRouter(): Router {
  const router = Router();

  // Initialize controllers
  const nlToSQLController = new NaturalLanguageToSQLController();
  const scheduledReportController = new ScheduledReportController();
  const codeGeneratorController = new CodeGeneratorController();

  // All advanced routes require authentication
  router.use(AuthMiddleware.validate);

  // ============================================================
  // NATURAL LANGUAGE TO SQL ROUTES
  // ============================================================

  /**
   * Convert natural language to SQL
   * POST /api/v1/advanced/nl-to-sql
   */
  router.post(
    '/nl-to-sql',
    (req, res) => nlToSQLController.convertToSQL(req, res)
  );

  /**
   * Validate SQL query
   * POST /api/v1/advanced/nl-to-sql/validate
   */
  router.post(
    '/nl-to-sql/validate',
    (req, res) => nlToSQLController.validateSQL(req, res)
  );

  /**
   * Optimize SQL query
   * POST /api/v1/advanced/nl-to-sql/optimize
   */
  router.post(
    '/nl-to-sql/optimize',
    (req, res) => nlToSQLController.optimizeSQL(req, res)
  );

  // ============================================================
  // SCHEDULED REPORT ROUTES
  // ============================================================

  /**
   * Create scheduled report
   * POST /api/v1/advanced/reports
   */
  router.post(
    '/reports',
    (req, res) => scheduledReportController.createReport(req, res)
  );

  /**
   * Get all scheduled reports
   * GET /api/v1/advanced/reports
   */
  router.get(
    '/reports',
    (req, res) => scheduledReportController.getReports(req, res)
  );

  /**
   * Get a specific report
   * GET /api/v1/advanced/reports/:id
   */
  router.get(
    '/reports/:id',
    (req, res) => scheduledReportController.getReport(req, res)
  );

  /**
   * Update a report
   * PUT /api/v1/advanced/reports/:id
   */
  router.put(
    '/reports/:id',
    (req, res) => scheduledReportController.updateReport(req, res)
  );

  /**
   * Execute a report
   * POST /api/v1/advanced/reports/:id/execute
   */
  router.post(
    '/reports/:id/execute',
    (req, res) => scheduledReportController.executeReport(req, res)
  );

  /**
   * Get report history
   * GET /api/v1/advanced/reports/:id/history
   */
  router.get(
    '/reports/:id/history',
    (req, res) => scheduledReportController.getReportHistory(req, res)
  );

  /**
   * Delete a report
   * DELETE /api/v1/advanced/reports/:id
   */
  router.delete(
    '/reports/:id',
    (req, res) => scheduledReportController.deleteReport(req, res)
  );

  // ============================================================
  // CODE GENERATION ROUTES
  // ============================================================

  /**
   * Generate code from description
   * POST /api/v1/advanced/code
   */
  router.post(
    '/code',
    (req, res) => codeGeneratorController.generateCode(req, res)
  );

  /**
   * Generate API code
   * POST /api/v1/advanced/code/api
   */
  router.post(
    '/code/api',
    (req, res) => codeGeneratorController.generateAPI(req, res)
  );

  return router;
}
