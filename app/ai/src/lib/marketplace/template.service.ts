/**
 * VYENFITA Template Service
 * 
 * Handles template CRUD, versioning, and search.
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { prisma } from '../database/client';
import { auditService } from '../audit/audit.service';
import { logger } from '../observability/logger';
import {
  CreateTemplateInput,
  PublishVersionInput,
  SearchTemplatesInput,
  MarketplaceError,
  TemplateNotFoundError,
  TemplateNotPublishedError,
} from './marketplace.types';

export class TemplateService {
  /**
   * Create a new template (draft)
   */
  static async create(input: CreateTemplateInput): Promise<any> {
    // Verify author exists
    const author = await prisma.marketplaceAuthor.findUnique({
      where: { id: input.authorId },
    });

    if (!author) {
      throw new MarketplaceError('Author not found', 'AUTHOR_NOT_FOUND', 404);
    }

    // Check slug uniqueness
    const existing = await prisma.marketplaceTemplate.findUnique({
      where: { slug: input.slug },
    });

    if (existing) {
      throw new MarketplaceError(`Slug already taken: ${input.slug}`, 'SLUG_TAKEN', 409);
    }

    // Create template
    const template = await prisma.marketplaceTemplate.create({
      data: {
        id: uuidv4(),
        authorId: input.authorId,
        slug: input.slug,
        name: input.name,
        description: input.description,
        longDescription: input.longDescription,
        category: input.category,
        tags: input.tags || [],
        icon: input.icon,
        screenshots: input.screenshots || [],
        status: 'draft',
        visibility: 'public',
        priceType: input.priceType || 'free',
        priceAmount: input.priceAmount,
        currency: input.currency || 'USD',
        license: input.license || 'MIT',
        documentation: input.documentation,
        repositoryUrl: input.repositoryUrl,
        demoUrl: input.demoUrl,
        supportUrl: input.supportUrl,
        minPlatformVersion: input.minPlatformVersion,
      },
    });

    // Update author template count
    await prisma.marketplaceAuthor.update({
      where: { id: input.authorId },
      data: { templateCount: { increment: 1 } },
    });

    await auditService.log({
      eventType: 'create',
      action: 'marketplace.template.create',
      resource: 'marketplace_template',
      resourceId: template.id,
      details: { slug: input.slug, name: input.name },
      status: 'success',
    });

    logger.info('Template created', { templateId: template.id, slug: input.slug });

    return template;
  }

  /**
   * Publish a new version
   */
  static async publishVersion(input: PublishVersionInput): Promise<any> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id: input.templateId },
    });

    if (!template) {
      throw new TemplateNotFoundError(input.templateId);
    }

    // Compute checksum
    const specJson = JSON.stringify(input.spec);
    const checksum = createHash('sha256').update(specJson).digest('hex');
    const size = Buffer.byteLength(specJson);

    // Clear current version flag
    await prisma.marketplaceVersion.updateMany({
      where: { templateId: input.templateId },
      data: { isCurrent: false },
    });

    // Create version
    const version = await prisma.marketplaceVersion.create({
      data: {
        id: uuidv4(),
        templateId: input.templateId,
        version: input.version,
        changelog: input.changelog,
        spec: input.spec,
        size,
        checksum,
        isCurrent: true,
        isBreaking: input.isBreaking || false,
        minPlatformVersion: input.minPlatformVersion,
      },
    });

    // Update template current version
    await prisma.marketplaceTemplate.update({
      where: { id: input.templateId },
      data: { currentVersionId: version.id },
    });

    logger.info('Version published', {
      templateId: input.templateId,
      version: input.version,
    });

    return version;
  }

  /**
   * Submit template for review
   */
  static async submitForReview(templateId: string): Promise<any> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    if (template.status !== 'draft' && template.status !== 'rejected') {
      throw new MarketplaceError(
        `Cannot submit template with status: ${template.status}`,
        'INVALID_STATUS'
      );
    }

    if (!template.currentVersionId) {
      throw new MarketplaceError(
        'Template has no published version',
        'NO_VERSION'
      );
    }

    const updated = await prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: { status: 'pending_review' },
    });

    logger.info('Template submitted for review', { templateId });

    return updated;
  }

  /**
   * Approve template (admin only)
   */
  static async approve(
    templateId: string,
    adminUserId: string,
    notes?: string
  ): Promise<any> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    const updated = await prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
        reviewNotes: notes,
      },
    });

    await auditService.log({
      userId: adminUserId,
      eventType: 'modify',
      action: 'marketplace.template.approve',
      resource: 'marketplace_template',
      resourceId: templateId,
      details: { notes },
      status: 'success',
    });

    logger.info('Template approved', { templateId, adminUserId });

    return updated;
  }

  /**
   * Reject template (admin only)
   */
  static async reject(
    templateId: string,
    adminUserId: string,
    reason: string
  ): Promise<any> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    const updated = await prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
        reviewNotes: reason,
      },
    });

    logger.info('Template rejected', { templateId, reason });

    return updated;
  }

  /**
   * Get template by ID
   */
  static async getById(id: string, includeUnpublished: boolean = false): Promise<any> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id },
      include: {
        author: true,
        versions: {
          where: { isCurrent: true },
          take: 1,
        },
      },
    });

    if (!template || template.deletedAt) {
      throw new TemplateNotFoundError(id);
    }

    if (!includeUnpublished && template.status !== 'published') {
      throw new TemplateNotPublishedError(id);
    }

    return template;
  }

  /**
   * Get template by slug
   */
  static async getBySlug(slug: string): Promise<any> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { slug },
      include: {
        author: true,
        versions: {
          where: { isCurrent: true },
          take: 1,
        },
      },
    });

    if (!template || template.deletedAt) {
      throw new TemplateNotFoundError(slug);
    }

    if (template.status !== 'published' || template.visibility !== 'public') {
      throw new TemplateNotPublishedError(slug);
    }

    // Increment view count
    await prisma.marketplaceTemplate.update({
      where: { id: template.id },
      data: { viewCount: { increment: 1 } },
    });

    return template;
  }

  /**
   * Search templates
   */
  static async search(input: SearchTemplatesInput): Promise<any> {
    const {
      query,
      category,
      tags,
      priceType,
      minRating,
      sortBy = 'relevance',
      page = 1,
      limit = 20,
    } = input;

    const where: any = {
      status: 'published',
      visibility: 'public',
      deletedAt: null,
    };

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { longDescription: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (category) where.category = category;
    if (tags && tags.length > 0) where.tags = { hasSome: tags };
    if (priceType) where.priceType = priceType;
    if (minRating) where.rating = { gte: minRating };

    // Determine sort
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'popular') orderBy = { installCount: 'desc' };
    else if (sortBy === 'newest') orderBy = { publishedAt: 'desc' };
    else if (sortBy === 'rating') orderBy = { rating: 'desc' };
    else if (sortBy === 'trending') orderBy = { trendingScore: 'desc' };
    else if (sortBy === 'relevance' && query) {
      // Simplest: prioritize by view count when there's a query
      orderBy = [{ viewCount: 'desc' }, { createdAt: 'desc' }];
    }

    const [templates, total] = await Promise.all([
      prisma.marketplaceTemplate.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              verified: true,
            },
          },
        },
      }),
      prisma.marketplaceTemplate.count({ where }),
    ]);

    return {
      data: templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get templates by author
   */
  static async listByAuthor(authorId: string): Promise<any[]> {
    return prisma.marketplaceTemplate.findMany({
      where: { authorId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update template metadata
   */
  static async update(
    templateId: string,
    authorId: string,
    updates: Partial<CreateTemplateInput>
  ): Promise<any> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    if (template.authorId !== authorId) {
      throw new MarketplaceError('Not authorized', 'UNAUTHORIZED', 403);
    }

    const updated = await prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: {
        name: updates.name,
        description: updates.description,
        longDescription: updates.longDescription,
        category: updates.category,
        tags: updates.tags,
        icon: updates.icon,
        screenshots: updates.screenshots,
        priceType: updates.priceType,
        priceAmount: updates.priceAmount,
        currency: updates.currency,
        license: updates.license,
        documentation: updates.documentation,
        repositoryUrl: updates.repositoryUrl,
        demoUrl: updates.demoUrl,
        supportUrl: updates.supportUrl,
      },
    });

    return updated;
  }

  /**
   * Delete template (soft)
   */
  static async delete(templateId: string, authorId: string): Promise<void> {
    const template = await prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    if (template.authorId !== authorId) {
      throw new MarketplaceError('Not authorized', 'UNAUTHORIZED', 403);
    }

    await prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: { deletedAt: new Date(), status: 'archived' },
    });

    await prisma.marketplaceAuthor.update({
      where: { id: authorId },
      data: { templateCount: { decrement: 1 } },
    });

    logger.info('Template deleted', { templateId, authorId });
  }
}

export default TemplateService;
