/**
 * VYENFITA Marketplace Manager
 * 
 * Manages template marketplace for VYENFITA platform
 * - Upload templates
 * - Download templates
 * - Rate templates
 * - Search templates
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { ApplicationSpec } from '../schemas/application-spec.schema';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'crm' | 'erp' | 'cms' | 'ecommerce' | 'support' | 'analytics' | 'hr' | 'finance' | 'operations' | 'custom';
  icon: string;
  version: string;
  author: string;
  authorEmail: string;
  spec: ApplicationSpec;
  rating: number;
  reviews: Review[];
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  price: 'free' | 'paid';
  priceAmount?: number;
  license: 'mit' | 'apache' | 'gpl' | 'commercial';
  demoUrl?: string;
  repositoryUrl?: string;
}

export interface Review {
  id: string;
  templateId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  helpful: number;
}

export class MarketplaceManager {
  private templates: Map<string, Template>;

  constructor() {
    this.templates = new Map();
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default templates
   */
  private initializeDefaultTemplates(): void {
    // CRM Template
    this.uploadTemplate({
      id: 'template-crm',
      name: 'Customer Relationship Management',
      description: 'Complete CRM for managing customers, leads, and sales pipeline.',
      category: 'crm',
      icon: '👥',
      version: '1.0.0',
      author: 'VYENFITA Team',
      authorEmail: 'team@vyenfita.com',
      spec: {
        metadata: {
          name: 'CRM System',
          description: 'Customer Relationship Management',
          version: '1.0.0',
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        requirements: [],
        entities: [],
        pages: [],
        roles: [],
        dataSources: [],
        workflows: [],
        integrations: [],
        tests: { unit: [], integration: [], security: [] },
        deployment: {
          environments: [],
          autoDeploy: false,
          requireApproval: true,
          healthCheck: { path: '/health', timeout: 5000, expectedStatus: 200 },
        },
        audit: { changes: [], logs: [] },
      },
      rating: 4.8,
      reviews: [
        {
          id: 'review-1',
          templateId: 'template-crm',
          userId: 'user-1',
          rating: 5,
          comment: 'Excellent CRM template. Saved us weeks of work!',
          createdAt: new Date(),
          helpful: 10,
        },
      ],
      downloads: 245,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['crm', 'sales', 'customer', 'leads'],
      price: 'free',
      license: 'mit',
      demoUrl: 'https://demo.vyenfita.com/crm',
      repositoryUrl: 'https://github.com/vyenfita/template-crm',
    });

    // Ecommerce Template
    this.uploadTemplate({
      id: 'template-ecommerce',
      name: 'E-Commerce Platform',
      description: 'Complete e-commerce platform with product management, orders, and payments.',
      category: 'ecommerce',
      icon: '🛒',
      version: '1.0.0',
      author: 'VYENFITA Team',
      authorEmail: 'team@vyenfita.com',
      spec: {
        metadata: {
          name: 'E-Commerce Platform',
          description: 'Online store with product management',
          version: '1.0.0',
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        requirements: [],
        entities: [],
        pages: [],
        roles: [],
        dataSources: [],
        workflows: [],
        integrations: [],
        tests: { unit: [], integration: [], security: [] },
        deployment: {
          environments: [],
          autoDeploy: false,
          requireApproval: true,
          healthCheck: { path: '/health', timeout: 5000, expectedStatus: 200 },
        },
        audit: { changes: [], logs: [] },
      },
      rating: 4.7,
      reviews: [
        {
          id: 'review-2',
          templateId: 'template-ecommerce',
          userId: 'user-2',
          rating: 5,
          comment: 'Perfect for our online store!',
          createdAt: new Date(),
          helpful: 8,
        },
      ],
      downloads: 189,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['ecommerce', 'store', 'products', 'payments'],
      price: 'free',
      license: 'mit',
      demoUrl: 'https://demo.vyenfita.com/ecommerce',
    });

    // Support Desk Template
    this.uploadTemplate({
      id: 'template-support',
      name: 'Support Desk',
      description: 'Ticketing system for customer support with SLA tracking.',
      category: 'support',
      icon: '🎫',
      version: '1.0.0',
      author: 'VYENFITA Team',
      authorEmail: 'team@vyenfita.com',
      spec: {
        metadata: {
          name: 'Support Desk',
          description: 'Customer support ticketing system',
          version: '1.0.0',
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        requirements: [],
        entities: [],
        pages: [],
        roles: [],
        dataSources: [],
        workflows: [],
        integrations: [],
        tests: { unit: [], integration: [], security: [] },
        deployment: {
          environments: [],
          autoDeploy: false,
          requireApproval: true,
          healthCheck: { path: '/health', timeout: 5000, expectedStatus: 200 },
        },
        audit: { changes: [], logs: [] },
      },
      rating: 4.9,
      reviews: [
        {
          id: 'review-3',
          templateId: 'template-support',
          userId: 'user-3',
          rating: 5,
          comment: 'Best support desk template out there!',
          createdAt: new Date(),
          helpful: 15,
        },
      ],
      downloads: 312,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['support', 'tickets', 'slA', 'customer-service'],
      price: 'free',
      license: 'mit',
      demoUrl: 'https://demo.vyenfita.com/support',
    });
  }

  /**
   * Upload a template
   */
  uploadTemplate(template: Partial<Template>): Template {
    const id = template.id || uuidv4();
    const newTemplate: Template = {
      id,
      name: template.name || 'Unnamed Template',
      description: template.description || '',
      category: template.category || 'custom',
      icon: template.icon || '📦',
      version: template.version || '1.0.0',
      author: template.author || 'Unknown',
      authorEmail: template.authorEmail || 'unknown@example.com',
      spec: template.spec || { metadata: {} } as ApplicationSpec,
      rating: template.rating || 0,
      reviews: template.reviews || [],
      downloads: template.downloads || 0,
      createdAt: template.createdAt || new Date(),
      updatedAt: new Date(),
      tags: template.tags || [],
      price: template.price || 'free',
      priceAmount: template.priceAmount,
      license: template.license || 'mit',
      demoUrl: template.demoUrl,
      repositoryUrl: template.repositoryUrl,
    };

    this.templates.set(id, newTemplate);
    return newTemplate;
  }

  /**
   * Get all templates
   */
  getTemplates(): Template[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get a specific template
   */
  getTemplate(id: string): Template | undefined {
    return this.templates.get(id);
  }

  /**
   * Search templates
   */
  searchTemplates(query: string): Template[] {
    const results: Template[] = [];
    const q = query.toLowerCase();

    for (const template of this.templates.values()) {
      if (
        template.name.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q) ||
        template.tags.some(tag => tag.toLowerCase().includes(q)) ||
        template.category.includes(q)
      ) {
        results.push(template);
      }
    }

    return results;
  }

  /**
   * Download a template (increment download count)
   */
  downloadTemplate(id: string): Template | undefined {
    const template = this.templates.get(id);
    if (!template) return undefined;
    template.downloads++;
    template.updatedAt = new Date();
    this.templates.set(id, template);
    return template;
  }

  /**
   * Add review to a template
   */
  addReview(templateId: string, userId: string, rating: number, comment: string): Review | undefined {
    const template = this.templates.get(templateId);
    if (!template) return undefined;

    const review: Review = {
      id: uuidv4(),
      templateId,
      userId,
      rating,
      comment,
      createdAt: new Date(),
      helpful: 0,
    };

    template.reviews.push(review);
    template.updatedAt = new Date();

    // Update average rating
    const totalRating = template.reviews.reduce((sum, r) => sum + r.rating, 0);
    template.rating = totalRating / template.reviews.length;

    this.templates.set(templateId, template);
    return review;
  }

  /**
   * Delete a template
   */
  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): Template[] {
    const results: Template[] = [];
    for (const template of this.templates.values()) {
      if (template.category === category) {
        results.push(template);
      }
    }
    return results;
  }

  /**
   * Get top templates by rating
   */
  getTopTemplates(limit: number = 10): Template[] {
    return Array.from(this.templates.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  /**
   * Get popular templates
   */
  getPopularTemplates(limit: number = 10): Template[] {
    return Array.from(this.templates.values())
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
  }
}
