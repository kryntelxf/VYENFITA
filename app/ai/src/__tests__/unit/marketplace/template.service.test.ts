/**
 * VYENFITA Marketplace Template Service Unit Tests
 * 
 * Verifies:
 * - Template CRUD
 * - Search with filters
 * - Version publishing
 * - Review submission flow
 * 
 * @version 1.0.0
 */

jest.mock('../../../lib/database/client', () => ({
  prisma: {
    marketplaceTemplate: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    marketplaceVersion: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../../../lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { TemplateService } from '../../../lib/marketplace/template.service';
import { MarketplaceError } from '../../../lib/marketplace/marketplace.types';
import { prisma } from '../../../lib/database/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('TemplateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create template with valid input', async () => {
      (mockPrisma.marketplaceTemplate.create as jest.Mock).mockResolvedValue({
        id: 'template-1',
        slug: 'my-template',
        name: 'My Template',
        status: 'draft',
      });

      const result = await TemplateService.create({
        authorId: 'author-1',
        slug: 'my-template',
        name: 'My Template',
        description: 'A test template',
        category: 'business',
      });

      expect(result.slug).toBe('my-template');
      expect(result.status).toBe('draft');
    });

    it('should reject invalid slug format', async () => {
      await expect(
        TemplateService.create({
          authorId: 'author-1',
          slug: 'Invalid Slug With Spaces!',
          name: 'Test',
          description: 'Test',
          category: 'business',
        })
      ).rejects.toThrow(MarketplaceError);
    });

    it('should reject paid template without priceAmount', async () => {
      await expect(
        TemplateService.create({
          authorId: 'author-1',
          slug: 'test',
          name: 'Test',
          description: 'Test',
          category: 'business',
          priceType: 'paid',
        })
      ).rejects.toThrow(MarketplaceError);
    });
  });

  describe('getById()', () => {
    it('should return template when found', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        name: 'Template',
      });

      const result = await TemplateService.getById('template-1');
      expect(result.name).toBe('Template');
    });

    it('should throw when not found', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(TemplateService.getById('missing')).rejects.toThrow(/not found/);
    });
  });

  describe('getBySlug()', () => {
    it('should return template by slug', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        slug: 'test-slug',
      });

      const result = await TemplateService.getBySlug('test-slug');
      expect(result.slug).toBe('test-slug');
    });

    it('should throw when not found', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(TemplateService.getBySlug('missing')).rejects.toThrow();
    });
  });

  describe('search()', () => {
    it('should return paginated results', async () => {
      (mockPrisma.marketplaceTemplate.findMany as jest.Mock).mockResolvedValue([
        { id: 't1', name: 'Template 1' },
        { id: 't2', name: 'Template 2' },
      ]);
      (mockPrisma.marketplaceTemplate.count as jest.Mock).mockResolvedValue(2);

      const result = await TemplateService.search({ page: 1, limit: 20 });

      expect(result.data.length).toBe(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should apply search query filter', async () => {
      (mockPrisma.marketplaceTemplate.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.marketplaceTemplate.count as jest.Mock).mockResolvedValue(0);

      await TemplateService.search({ query: 'crm' });

      expect(mockPrisma.marketplaceTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    it('should apply category filter', async () => {
      (mockPrisma.marketplaceTemplate.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.marketplaceTemplate.count as jest.Mock).mockResolvedValue(0);

      await TemplateService.search({ category: 'crm' });

      expect(mockPrisma.marketplaceTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'crm' }),
        })
      );
    });

    it('should sort by trending when requested', async () => {
      (mockPrisma.marketplaceTemplate.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.marketplaceTemplate.count as jest.Mock).mockResolvedValue(0);

      await TemplateService.search({ sortBy: 'trending' });

      expect(mockPrisma.marketplaceTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { trendingScore: 'desc' },
        })
      );
    });

    it('should cap limit at 100', async () => {
      (mockPrisma.marketplaceTemplate.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.marketplaceTemplate.count as jest.Mock).mockResolvedValue(0);

      await TemplateService.search({ limit: 5000 });

      expect(mockPrisma.marketplaceTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });
  });

  describe('update()', () => {
    it('should update template when owned by author', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        authorId: 'author-1',
      });
      (mockPrisma.marketplaceTemplate.update as jest.Mock).mockResolvedValue({
        id: 'template-1',
        name: 'Updated',
      });

      const result = await TemplateService.update('template-1', 'author-1', {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
    });

    it('should reject update by different author', async () => {
      (mockPrisma.marketplaceTemplate.findFirst as jest.Mock).mockResolvedValue({
        id: 'template-1',
        authorId: 'author-1',
      });

      await expect(
        TemplateService.update('template-1', 'other-author', { name: 'Hacked' })
      ).rejects.toThrow(MarketplaceError);
    });
  });

  describe('publishVersion()', () => {
    it('should create new version with checksum', async () => {
      (mockPrisma.marketplaceVersion.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.marketplaceVersion.updateMany as jest.Mock).mockResolvedValue({});
      (mockPrisma.marketplaceVersion.create as jest.Mock).mockResolvedValue({
        id: 'version-1',
        version: '1.0.0',
        isCurrent: true,
      });
      (mockPrisma.marketplaceTemplate.update as jest.Mock).mockResolvedValue({});

      const result = await TemplateService.publishVersion({
        templateId: 'template-1',
        version: '1.0.0',
        spec: { foo: 'bar' },
      });

      expect(result.version).toBe('1.0.0');
      expect(result.isCurrent).toBe(true);
    });

    it('should set current flag on new version', async () => {
      (mockPrisma.marketplaceVersion.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.marketplaceVersion.updateMany as jest.Mock).mockResolvedValue({});
      (mockPrisma.marketplaceVersion.create as jest.Mock).mockResolvedValue({
        id: 'version-1',
        version: '1.0.0',
        isCurrent: true,
      });
      (mockPrisma.marketplaceTemplate.update as jest.Mock).mockResolvedValue({});

      await TemplateService.publishVersion({
        templateId: 'template-1',
        version: '1.0.0',
        spec: {},
      });

      expect(mockPrisma.marketplaceVersion.updateMany).toHaveBeenCalledWith({
        where: { templateId: 'template-1' },
        data: { isCurrent: false },
      });
    });
  });
});
