/**
 * VYENFITA Marketplace Controller
 * 
 * Handles marketplace operations
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { MarketplaceManager } from '../core/marketplace/marketplace-manager';

const marketplaceManager = new MarketplaceManager();

export class MarketplaceController {
  /**
   * Get all templates
   * GET /api/v1/marketplace/templates
   */
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { category, search } = req.query;
      let templates: any[] = [];

      if (search) {
        templates = marketplaceManager.searchTemplates(search as string);
      } else if (category) {
        templates = marketplaceManager.getTemplatesByCategory(category as string);
      } else {
        templates = marketplaceManager.getTemplates();
      }

      res.json({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get a specific template
   * GET /api/v1/marketplace/templates/:templateId
   */
  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const template = marketplaceManager.getTemplate(templateId);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Upload a template
   * POST /api/v1/marketplace/templates
   */
  async uploadTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateData = req.body;

      if (!templateData.name || !templateData.spec) {
        res.status(400).json({
          success: false,
          error: 'name and spec are required',
        });
        return;
      }

      const template = marketplaceManager.uploadTemplate(templateData);

      res.json({
        success: true,
        data: template,
        message: `Template ${template.name} uploaded successfully`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Download a template
   * POST /api/v1/marketplace/templates/:templateId/download
   */
  async downloadTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const template = marketplaceManager.downloadTemplate(templateId);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      res.json({
        success: true,
        data: template,
        message: `Template ${template.name} downloaded successfully`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Add review to a template
   * POST /api/v1/marketplace/templates/:templateId/reviews
   */
  async addReview(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const { userId, rating, comment } = req.body;

      if (!userId || !rating || !comment) {
        res.status(400).json({
          success: false,
          error: 'userId, rating, and comment are required',
        });
        return;
      }

      if (rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          error: 'rating must be between 1 and 5',
        });
        return;
      }

      const review = marketplaceManager.addReview(templateId, userId, rating, comment);

      if (!review) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      res.json({
        success: true,
        data: review,
        message: 'Review added successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get top templates
   * GET /api/v1/marketplace/top
   */
  async getTopTemplates(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const templates = marketplaceManager.getTopTemplates(limit);

      res.json({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get popular templates
   * GET /api/v1/marketplace/popular
   */
  async getPopularTemplates(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const templates = marketplaceManager.getPopularTemplates(limit);

      res.json({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete a template
   * DELETE /api/v1/marketplace/templates/:templateId
   */
  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const success = marketplaceManager.deleteTemplate(templateId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  }
