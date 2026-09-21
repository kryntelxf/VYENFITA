/**
 * VYENFITA Marketplace Types
 * 
 * @version 1.0.0
 */

export type TemplateStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived';
export type TemplateVisibility = 'public' | 'unlisted' | 'private';
export type PriceType = 'free' | 'paid' | 'subscription';
export type PurchaseStatus = 'pending' | 'completed' | 'refunded' | 'failed';
export type InstallStatus = 'pending' | 'installed' | 'failed' | 'uninstalled';
export type ReviewStatus = 'published' | 'pending' | 'hidden' | 'deleted';
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface CreateTemplateInput {
  authorId: string;
  slug: string;
  name: string;
  description?: string;
  longDescription?: string;
  category: string;
  tags?: string[];
  icon?: string;
  screenshots?: string[];
  priceType?: PriceType;
  priceAmount?: number;
  currency?: string;
  license?: string;
  documentation?: string;
  repositoryUrl?: string;
  demoUrl?: string;
  supportUrl?: string;
  minPlatformVersion?: string;
}

export interface PublishVersionInput {
  templateId: string;
  version: string;
  changelog?: string;
  spec: Record<string, any>;
  isBreaking?: boolean;
  minPlatformVersion?: string;
}

export interface SearchTemplatesInput {
  query?: string;
  category?: string;
  tags?: string[];
  priceType?: PriceType;
  minRating?: number;
  sortBy?: 'relevance' | 'popular' | 'newest' | 'rating' | 'trending';
  page?: number;
  limit?: number;
}

export interface PurchaseTemplateInput {
  templateId: string;
  buyerId: string;
  buyerTenantId: string;
  paymentMethod?: string;
}

export interface InstallTemplateInput {
  templateId: string;
  versionId?: string;
  tenantId: string;
  userId: string;
}

export interface CreateReviewInput {
  templateId: string;
  userId: string;
  tenantId: string;
  rating: number;
  title?: string;
  comment?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

export const PLATFORM_FEE_PERCENTAGE = 30; // 30%
export const AUTHOR_EARNINGS_PERCENTAGE = 70; // 70%

export const MARKETPLACE_CATEGORIES = [
  'crm',
  'erp',
  'ecommerce',
  'support',
  'analytics',
  'hr',
  'finance',
  'operations',
  'marketing',
  'productivity',
  'developer-tools',
  'custom',
] as const;

export type MarketplaceCategory = typeof MARKETPLACE_CATEGORIES[number];

// ============================================================
// ERRORS
// ============================================================

export class MarketplaceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'MarketplaceError';
  }
}

export class TemplateNotFoundError extends MarketplaceError {
  constructor(id: string) {
    super(`Template not found: ${id}`, 'TEMPLATE_NOT_FOUND', 404);
  }
}

export class TemplateNotPublishedError extends MarketplaceError {
  constructor(id: string) {
    super(`Template is not published: ${id}`, 'TEMPLATE_NOT_PUBLISHED', 400);
  }
}

export class PurchaseRequiredError extends MarketplaceError {
  constructor(templateId: string) {
    super(
      `Purchase required to install template: ${templateId}`,
      'PURCHASE_REQUIRED',
      402
    );
  }
}
