/**
 * VYENFITA Starter Templates
 * 
 * Pre-built templates for common use cases.
 * 
 * @version 1.0.0
 */

import { ApplicationState, Widget, WidgetType, generatePageId, generateWidgetId, WIDGET_REGISTRY } from './types';

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'business' | 'personal' | 'data' | 'form';
  state: ApplicationState;
}

// Helper to create widget
function w(type: WidgetType, props: any, x: number, y: number, width: number, height: number): Widget {
  return {
    id: generateWidgetId(),
    type,
    name: `${WIDGET_REGISTRY[type].name}-${generateWidgetId().substring(7, 12)}`,
    props,
    position: { x, y, width, height },
  };
}

// ============================================================
// TEMPLATES
// ============================================================

export const TEMPLATES: Template[] = [
  // ============================================================
  // 1. CRM Dashboard
  // ============================================================
  {
    id: 'crm-dashboard',
    name: 'CRM Dashboard',
    description: 'Customer relationship management with analytics',
    icon: '👥',
    category: 'business',
    state: {
      metadata: {
        name: 'CRM Dashboard',
        description: 'Manage customers, leads, and sales',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      pages: [
        {
          id: generatePageId(),
          name: 'Dashboard',
          path: '/',
          type: 'dashboard',
          layout: 'full',
          widgets: [
            w('heading', { text: 'CRM Dashboard', fontSize: '28px', fontWeight: '700' }, 0, 0, 12, 1),
            w('text', { text: 'Welcome back! Here\'s your business overview.' }, 0, 1, 12, 1),
            w('card', { label: 'Total Customers' }, 0, 2, 3, 3),
            w('card', { label: 'Active Leads' }, 3, 2, 3, 3),
            w('card', { label: 'Revenue' }, 6, 2, 3, 3),
            w('card', { label: 'Conversion Rate' }, 9, 2, 3, 3),
            w('chart', { label: 'Sales Trend', type: 'line' }, 0, 5, 6, 4),
            w('chart', { label: 'Pipeline by Stage', type: 'bar' }, 6, 5, 6, 4),
            w('table', { label: 'Recent Customers' }, 0, 9, 12, 5),
          ],
        },
        {
          id: generatePageId(),
          name: 'Customers',
          path: '/customers',
          type: 'table',
          layout: 'full',
          widgets: [
            w('heading', { text: 'Customers', fontSize: '24px' }, 0, 0, 12, 1),
            w('input', { label: 'Search', placeholder: 'Search customers...' }, 0, 1, 6, 1),
            w('button', { text: '+ New Customer', backgroundColor: '#10b981' }, 10, 1, 2, 1),
            w('table', { label: 'Customer List' }, 0, 2, 12, 8),
          ],
        },
      ],
      currentPageId: null,
      selectedWidgetId: null,
      variables: {},
    },
  },

  // ============================================================
  // 2. Task Manager
  // ============================================================
  {
    id: 'task-manager',
    name: 'Task Manager',
    description: 'Simple task tracking with lists and filters',
    icon: '✅',
    category: 'personal',
    state: {
      metadata: {
        name: 'Task Manager',
        description: 'Track your tasks and projects',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      pages: [
        {
          id: generatePageId(),
          name: 'Tasks',
          path: '/',
          type: 'dashboard',
          layout: 'full',
          widgets: [
            w('heading', { text: 'My Tasks', fontSize: '28px' }, 0, 0, 12, 1),
            w('input', { label: '', placeholder: 'What needs to be done?' }, 0, 1, 10, 1),
            w('button', { text: 'Add Task' }, 10, 1, 2, 1),
            w('card', { label: 'To Do' }, 0, 2, 4, 6),
            w('card', { label: 'In Progress' }, 4, 2, 4, 6),
            w('card', { label: 'Done' }, 8, 2, 4, 6),
          ],
        },
      ],
      currentPageId: null,
      selectedWidgetId: null,
      variables: {},
    },
  },

  // ============================================================
  // 3. Contact Form
  // ============================================================
  {
    id: 'contact-form',
    name: 'Contact Form',
    description: 'Simple contact form with validation',
    icon: '📧',
    category: 'form',
    state: {
      metadata: {
        name: 'Contact Form',
        description: 'Get in touch form',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      pages: [
        {
          id: generatePageId(),
          name: 'Contact',
          path: '/',
          type: 'form',
          layout: 'full',
          widgets: [
            w('heading', { text: 'Get in Touch', fontSize: '28px' }, 3, 1, 6, 1),
            w('text', { text: 'We\'d love to hear from you!' }, 3, 2, 6, 1),
            w('input', { label: 'Name', placeholder: 'Your full name', required: true }, 3, 3, 6, 1),
            w('input', { label: 'Email', placeholder: 'your@email.com', required: true }, 3, 4, 6, 1),
            w('input', { label: 'Subject', placeholder: 'How can we help?' }, 3, 5, 6, 1),
            w('textarea', { label: 'Message', placeholder: 'Your message...', required: true }, 3, 6, 6, 3),
            w('button', { text: 'Send Message', backgroundColor: '#667eea' }, 3, 9, 3, 1),
          ],
        },
      ],
      currentPageId: null,
      selectedWidgetId: null,
      variables: {},
    },
  },

  // ============================================================
  // 4. Analytics Dashboard
  // ============================================================
  {
    id: 'analytics-dashboard',
    name: 'Analytics Dashboard',
    description: 'Business metrics and charts',
    icon: '📊',
    category: 'data',
    state: {
      metadata: {
        name: 'Analytics Dashboard',
        description: 'Business metrics at a glance',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      pages: [
        {
          id: generatePageId(),
          name: 'Analytics',
          path: '/',
          type: 'dashboard',
          layout: 'full',
          widgets: [
            w('heading', { text: 'Analytics', fontSize: '28px' }, 0, 0, 12, 1),
            w('card', { label: 'Page Views' }, 0, 1, 3, 3),
            w('card', { label: 'Unique Visitors' }, 3, 1, 3, 3),
            w('card', { label: 'Bounce Rate' }, 6, 1, 3, 3),
            w('card', { label: 'Avg Session' }, 9, 1, 3, 3),
            w('chart', { label: 'Traffic Over Time', type: 'area' }, 0, 4, 12, 5),
            w('chart', { label: 'Top Pages', type: 'bar' }, 0, 9, 6, 4),
            w('chart', { label: 'Traffic Sources', type: 'pie' }, 6, 9, 6, 4),
          ],
        },
      ],
      currentPageId: null,
      selectedWidgetId: null,
      variables: {},
    },
  },

  // ============================================================
  // 5. Inventory Manager
  // ============================================================
  {
    id: 'inventory',
    name: 'Inventory Manager',
    description: 'Track stock and orders',
    icon: '📦',
    category: 'business',
    state: {
      metadata: {
        name: 'Inventory Manager',
        description: 'Manage your stock and orders',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      pages: [
        {
          id: generatePageId(),
          name: 'Inventory',
          path: '/',
          type: 'table',
          layout: 'full',
          widgets: [
            w('heading', { text: 'Inventory', fontSize: '28px' }, 0, 0, 12, 1),
            w('input', { placeholder: 'Search products...' }, 0, 1, 6, 1),
            w('button', { text: '+ Add Product', backgroundColor: '#10b981' }, 10, 1, 2, 1),
            w('table', { label: 'Product List' }, 0, 2, 12, 8),
          ],
        },
      ],
      currentPageId: null,
      selectedWidgetId: null,
      variables: {},
    },
  },

  // ============================================================
  // 6. Blog Post
  // ============================================================
  {
    id: 'blog-post',
    name: 'Blog Post',
    description: 'Simple blog article layout',
    icon: '📝',
    category: 'personal',
    state: {
      metadata: {
        name: 'Blog Post',
        description: 'A single blog article',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      pages: [
        {
          id: generatePageId(),
          name: 'Article',
          path: '/',
          type: 'custom',
          layout: 'full',
          widgets: [
            w('heading', { text: 'Your Article Title', fontSize: '36px', fontWeight: '700' }, 2, 1, 8, 2),
            w('text', { text: 'By Author · Published on 2026-09-16 · 5 min read' }, 2, 3, 8, 1),
            w('divider', {}, 2, 4, 8, 1),
            w('text', { text: 'Your article content goes here. Write your thoughts, share your story, and engage your readers.', fontSize: '16px' }, 2, 5, 8, 4),
            w('text', { text: 'Continue reading...', fontSize: '16px' }, 2, 9, 8, 3),
          ],
        },
      ],
      currentPageId: null,
      selectedWidgetId: null,
      variables: {},
    },
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
    }
