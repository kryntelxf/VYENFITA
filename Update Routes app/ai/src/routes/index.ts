// Tambahkan import
import { BusinessIntelligenceController } from '../controllers/bi.controller';

// Di dalam createAIRouter(), tambahkan:
const biController = new BusinessIntelligenceController();

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
