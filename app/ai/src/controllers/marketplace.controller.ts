/**
 * VYENFITA Marketplace Controller
 * 
 * @version 2.0.0
 */

import { Request, Response } from 'express';
import { TemplateService } from '../lib/marketplace/template.service';
import { CreatorService } from '../lib/marketplace/creator.service';
import { PurchaseService } from '../lib/marketplace/purchase.service';
import { InstallService } from '../lib/marketplace/install.service';
import { ReviewService } from '../lib/marketplace/review.service';
import { MarketplaceError } from '../lib/marketplace/marketplace.types';

export class MarketplaceController {
  // ============================================================
  // TEMPLATES
  // ============================================================

  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const author = await CreatorService.getProfileByUserId(req.user.userId);
      if (!author) {
        res.status(400).json({
          success: false,
          error: 'Creator profile required. Please create one first.',
        });
        return;
      }

      const template = await TemplateService.create({
        ...req.body,
        authorId: author.id,
      });

      res.status(201).json({ success: true, data: template });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const template = await TemplateService.getById(req.params.id, !!req.user);
      res.json({ success: true, data: template });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getTemplateBySlug(req: Request, res: Response): Promise<void> {
    try {
      const template = await TemplateService.getBySlug(req.params.slug);
      res.json({ success: true, data: template });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async searchTemplates(req: Request, res: Response): Promise<void> {
    try {
      const result = await TemplateService.search({
        query: req.query.q as string,
        category: req.query.category as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        priceType: req.query.priceType as any,
        minRating: req.query.minRating ? parseFloat(req.query.minRating as string) : undefined,
        sortBy: (req.query.sortBy as any) || 'relevance',
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      });

      res.json({ success: true, ...result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const author = await CreatorService.getProfileByUserId(req.user.userId);
      if (!author) {
        res.status(403).json({ success: false, error: 'Creator profile required' });
        return;
      }

      const template = await TemplateService.update(req.params.id, author.id, req.body);
      res.json({ success: true, data: template });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const author = await CreatorService.getProfileByUserId(req.user.userId);
      if (!author) {
        res.status(403).json({ success: false, error: 'Creator profile required' });
        return;
      }

      await TemplateService.delete(req.params.id, author.id);
      res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listMyTemplates(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const author = await CreatorService.getProfileByUserId(req.user.userId);
      if (!author) {
        res.json({ success: true, data: [] });
        return;
      }

      const templates = await TemplateService.listByAuthor(author.id);
      res.json({ success: true, data: templates });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ============================================================
  // VERSIONS
  // ============================================================

  async publishVersion(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const author = await CreatorService.getProfileByUserId(req.user.userId);
      if (!author) {
        res.status(403).json({ success: false, error: 'Creator profile required' });
        return;
      }

      const template = await TemplateService.getById(req.params.id, true);
      if (template.authorId !== author.id) {
        res.status(403).json({ success: false, error: 'Not authorized' });
        return;
      }

      const version = await TemplateService.publishVersion({
        templateId: req.params.id,
        ...req.body,
      });

      res.status(201).json({ success: true, data: version });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async submitForReview(req: Request, res: Response): Promise<void> {
    try {
      const template = await TemplateService.submitForReview(req.params.id);
      res.json({ success: true, data: template });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ============================================================
  // CREATOR
  // ============================================================

  async createCreatorProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const profile = await CreatorService.createProfile({
        ...req.body,
        userId: req.user.userId,
      });

      res.status(201).json({ success: true, data: profile });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getMyCreatorProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const profile = await CreatorService.getProfileByUserId(req.user.userId);
      res.json({ success: true, data: profile });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getCreatorProfile(req: Request, res: Response): Promise<void> {
    try {
      const profile = await CreatorService.getProfile(req.params.creatorId);
      res.json({ success: true, data: profile });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getMyEarnings(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const author = await CreatorService.getProfileByUserId(req.user.userId);
      if (!author) {
        res.status(403).json({ success: false, error: 'Creator profile required' });
        return;
      }

      const earnings = await CreatorService.getEarnings(author.id);
      res.json({ success: true, data: earnings });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async requestPayout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const author = await CreatorService.getProfileByUserId(req.user.userId);
      if (!author) {
        res.status(403).json({ success: false, error: 'Creator profile required' });
        return;
      }

      const payout = await CreatorService.requestPayout(author.id, req.body.amount);
      res.status(201).json({ success: true, data: payout });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ============================================================
  // PURCHASE
  // ============================================================

  async purchaseTemplate(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const purchase = await PurchaseService.purchase({
        templateId: req.params.id,
        buyerId: req.user.userId,
        buyerTenantId: req.user.tenantId,
        paymentMethod: req.body.paymentMethod,
      });

      res.status(201).json({ success: true, data: purchase });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listMyPurchases(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const purchases = await PurchaseService.listByTenant(req.user.tenantId);
      res.json({ success: true, data: purchases });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ============================================================
  // INSTALL
  // ============================================================

  async installTemplate(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const result = await InstallService.install({
        templateId: req.params.id,
        versionId: req.body.versionId,
        tenantId: req.user.tenantId,
        userId: req.user.userId,
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async uninstallTemplate(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      await InstallService.uninstall(req.params.installId, req.user.tenantId);
      res.json({ success: true, message: 'Uninstalled' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listMyInstalls(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const installs = await InstallService.listByTenant(req.user.tenantId);
      res.json({ success: true, data: installs });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ============================================================
  // REVIEWS
  // ============================================================

  async createReview(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const review = await ReviewService.create({
        templateId: req.params.id,
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        rating: req.body.rating,
        title: req.body.title,
        comment: req.body.comment,
      });

      res.status(201).json({ success: true, data: review });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listReviews(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await ReviewService.listByTemplate(req.params.id, page, limit);
      res.json({ success: true, ...result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ============================================================
  // ERROR HANDLER
  // ============================================================

  private handleError(error: unknown, res: Response): void {
    if (error instanceof MarketplaceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
  }
