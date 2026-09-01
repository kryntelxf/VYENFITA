/**
 * VYENFITA Advanced Routes
 * 
 * Routes for advanced features:
 * - User Management
 * - Team Collaboration
 * - Deployment Manager
 * - Security Scanner
 * - Natural Language to SQL
 * - Scheduled Reports
 * - Code Generation
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { AdvancedController } from '../controllers/advanced/advanced.controller';
import { NaturalLanguageToSQLController } from '../controllers/nl-to-sql.controller';
import { ScheduledReportController } from '../controllers/scheduled-report.controller';
import { CodeGeneratorController } from '../controllers/code-generator.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';

export function createAdvancedRouter(): Router {
  const router = Router();

  // Initialize controllers
  const advancedController = new AdvancedController();
  const nlToSQLController = new NaturalLanguageToSQLController();
  const scheduledReportController = new ScheduledReportController();
  const codeGeneratorController = new CodeGeneratorController();

  // All advanced routes require authentication
  router.use(AuthMiddleware.validate);

  // ============================================================
  // USER MANAGEMENT ROUTES
  // ============================================================

  /**
   * Create user
   * POST /api/v1/advanced/users
   */
  router.post(
    '/users',
    (req, res) => advancedController.createUser(req, res)
  );

  /**
   * Authenticate user
   * POST /api/v1/advanced/auth
   */
  router.post(
    '/auth',
    (req, res) => advancedController.authenticate(req, res)
  );

  /**
   * Get users
   * GET /api/v1/advanced/users
   */
  router.get(
    '/users',
    (req, res) => advancedController.getUsers(req, res)
  );

  /**
   * Get user by ID
   * GET /api/v1/advanced/users/:id
   */
  router.get(
    '/users/:id',
    (req, res) => advancedController.getUser(req, res)
  );

  /**
   * Get roles
   * GET /api/v1/advanced/roles
   */
  router.get(
    '/roles',
    (req, res) => advancedController.getRoles(req, res)
  );

  // ============================================================
  // WORKSPACE MANAGEMENT ROUTES
  // ============================================================

  /**
   * Create workspace
   * POST /api/v1/advanced/workspaces
   */
  router.post(
    '/workspaces',
    (req, res) => advancedController.createWorkspace(req, res)
  );

  /**
   * Get workspaces
   * GET /api/v1/advanced/workspaces
   */
  router.get(
    '/workspaces',
    (req, res) => advancedController.getWorkspaces(req, res)
  );

  /**
   * Invite user to workspace
   * POST /api/v1/advanced/workspaces/:workspaceId/invite
   */
  router.post(
    '/workspaces/:workspaceId/invite',
    (req, res) => advancedController.inviteUser(req, res)
  );

  /**
   * Accept invitation
   * POST /api/v1/advanced/invitations/:invitationId/accept
   */
  router.post(
    '/invitations/:invitationId/accept',
    (req, res) => advancedController.acceptInvitation(req, res)
  );

  // ============================================================
  // DEPLOYMENT MANAGEMENT ROUTES
  // ============================================================

  /**
   * Deploy application
   * POST /api/v1/advanced/deploy
   */
  router.post(
    '/deploy',
    (req, res) => advancedController.deployApplication(req, res)
  );

  /**
   * Get deployments
   * GET /api/v1/advanced/deployments
   */
  router.get(
    '/deployments',
    (req, res) => advancedController.getDeployments(req, res)
  );

  /**
   * Rollback deployment
   * POST /api/v1/advanced/deployments/:deploymentId/rollback
   */
  router.post(
    '/deployments/:deploymentId/rollback',
    (req, res) => advancedController.rollbackDeployment(req, res)
  );

  /**
   * Get deployment stats
   * GET /api/v1/advanced/deployments/stats
   */
  router.get(
    '/deployments/stats',
    (req, res) => advancedController.getDeploymentStats(req, res)
  );

  // ============================================================
  // SECURITY SCANNER ROUTES
  // ============================================================

  /**
   * Run security scan
   * POST /api/v1/advanced/security/scan
   */
  router.post(
    '/security/scan',
    (req, res) => advancedController.runSecurityScan(req, res)
  );

  /**
   * Get security scans
   * GET /api/v1/advanced/security/scans
   */
  router.get(
    '/security/scans',
    (req, res) => advancedController.getSecurityScans(req, res)
  );

  /**
   * Get latest security scan
   * GET /api/v1/advanced/security/latest
   */
  router.get(
    '/security/latest',
    (req, res) => advancedController.getLatestSecurityScan(req, res)
  );

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
