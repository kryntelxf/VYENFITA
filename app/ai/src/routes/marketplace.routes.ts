/**
 * VYENFITA Marketplace Routes
 * 
 * @version 1.0.0
 */

import { Router } from 'express';
import { MarketplaceController } from '../controllers/marketplace.controller';

export function createMarketplaceRouter(): Router {
  const router = Router();
  const controller = new MarketplaceController();

  // ============================================================
  // PUBLIC: Search & browse
  // ============================================================

  router.get('/templates', (req, res) => controller.searchTemplates(req, res));
  router.get('/templates/slug/:slug', (req, res) => controller.getTemplateBySlug(req, res));
  router.get('/templates/:id', (req, res) => controller.getTemplate(req, res));
  router.get('/templates/:id/reviews', (req, res) => controller.listReviews(req, res));
  router.get('/creators/:creatorId', (req, res) => controller.getCreatorProfile(req, res));

  // ============================================================
  // PROTECTED: Requires auth (handled by index.ts middleware)
  // ============================================================

  // Templates (author)
  router.post('/templates', (req, res) => controller.createTemplate(req, res));
  router.put('/templates/:id', (req, res) => controller.updateTemplate(req, res));
  router.delete('/templates/:id', (req, res) => controller.deleteTemplate(req, res));
  router.get('/my/templates', (req, res) => controller.listMyTemplates(req, res));
  router.post('/templates/:id/versions', (req, res) => controller.publishVersion(req, res));
  router.post('/templates/:id/submit', (req, res) => controller.submitForReview(req, res));

  // Creator
  router.post('/creators/profile', (req, res) => controller.createCreatorProfile(req, res));
  router.get('/my/creator', (req, res) => controller.getMyCreatorProfile(req, res));
  router.get('/my/earnings', (req, res) => controller.getMyEarnings(req, res));
  router.post('/my/payouts', (req, res) => controller.requestPayout(req, res));

  // Purchase
  router.post('/templates/:id/purchase', (req, res) => controller.purchaseTemplate(req, res));
  router.get('/my/purchases', (req, res) => controller.listMyPurchases(req, res));

  // Install
  router.post('/templates/:id/install', (req, res) => controller.installTemplate(req, res));
  router.delete('/installs/:installId', (req, res) => controller.uninstallTemplate(req, res));
  router.get('/my/installs', (req, res) => controller.listMyInstalls(req, res));

  // Reviews
  router.post('/templates/:id/reviews', (req, res) => controller.createReview(req, res));

  return router;
}

export default createMarketplaceRouter;
