/**
 * VYENFITA Application Specification Schema
 * Strongly validated internal representation of an application
 * 
 * This is the source of truth for all application generation.
 * Every generated application MUST pass this schema validation.
 */

import Joi from 'joi';

/**
 * Application Specification Schema
 * Validates the entire application structure
 */
export const ApplicationSpecSchema = Joi.object({
  // Metadata
  metadata: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().min(1).max(500).required(),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).default('1.0.0'),
    createdAt: Joi.date().iso().default(() => new Date()),
    updatedAt: Joi.date().iso().default(() => new Date()),
    createdBy: Joi.string().optional(),
    tenantId: Joi.string().optional(),
    status: Joi.string().valid('draft', 'validated', 'deployed', 'archived').default('draft'),
  }).required(),

  // Business Requirements
  requirements: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      title: Joi.string().min(1).max(200).required(),
      description: Joi.string().min(1).max(1000).required(),
      priority: Joi.string().valid('critical', 'high', 'medium', 'low').required(),
      category: Joi.string().valid('functional', 'non-functional', 'security', 'compliance').required(),
      acceptanceCriteria: Joi.array().items(Joi.string()).default([]),
    })
  ).default([]),

  // Entities (Data Models)
  entities: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      name: Joi.string().pattern(/^[A-Za-z][A-Za-z0-9_]*$/).required(),
      description: Joi.string().max(200).optional(),
      fields: Joi.array().items(
        Joi.object({
          id: Joi.string().uuid().required(),
          name: Joi.string().pattern(/^[a-z][a-zA-Z0-9_]*$/).required(),
          type: Joi.string().valid(
            'string', 'number', 'boolean', 'date', 'datetime',
            'object', 'array', 'reference', 'email', 'phone',
            'url', 'json', 'file', 'image', 'password'
          ).required(),
          required: Joi.boolean().default(false),
          unique: Joi.boolean().default(false),
          default: Joi.any().optional(),
          description: Joi.string().max(200).optional(),
          validation: Joi.object({
            min: Joi.number().optional(),
            max: Joi.number().optional(),
            pattern: Joi.string().optional(),
            minLength: Joi.number().optional(),
            maxLength: Joi.number().optional(),
          }).optional(),
          reference: Joi.object({
            entity: Joi.string().required(),
            field: Joi.string().default('id'),
          }).optional(),
        })
      ).min(1).required(),
      relationships: Joi.array().items(
        Joi.object({
          id: Joi.string().uuid().required(),
          type: Joi.string().valid('one-to-one', 'one-to-many', 'many-to-many').required(),
          target: Joi.string().required(),
          sourceField: Joi.string().required(),
          targetField: Joi.string().required(),
          cascadeDelete: Joi.boolean().default(false),
        })
      ).default([]),
    })
  ).min(1).required(),

  // Data Sources
  dataSources: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      name: Joi.string().min(1).max(100).required(),
      type: Joi.string().valid('api', 'database', 'file', 'external-service', 'webhook').required(),
      config: Joi.object({
        url: Joi.string().uri().optional(),
        authType: Joi.string().valid('none', 'basic', 'bearer', 'oauth2', 'api-key').default('none'),
        headers: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
        databaseType: Joi.string().valid('postgres', 'mysql', 'mongodb', 'sqlite').optional(),
        connectionString: Joi.string().optional(),
      }).required(),
      isDefault: Joi.boolean().default(false),
    })
  ).default([]),

  // Pages
  pages: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      name: Joi.string().min(1).max(100).required(),
      path: Joi.string().pattern(/^\/[a-z][a-zA-Z0-9/_-]*$/).required(),
      type: Joi.string().valid(
        'dashboard', 'form', 'table', 'custom', 
        'login', 'profile', 'settings', 'reports'
      ).required(),
      layout: Joi.string().valid('full', 'sidebar', 'split').default('full'),
      widgets: Joi.array().items(
        Joi.object({
          id: Joi.string().uuid().required(),
          type: Joi.string().valid(
            'text', 'button', 'table', 'chart', 'form', 
            'input', 'select', 'datepicker', 'filepicker',
            'map', 'image', 'video', 'iframe', 'card',
            'list', 'grid', 'tabs', 'accordion'
          ).required(),
          props: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
          position: Joi.object({
            x: Joi.number().min(0).required(),
            y: Joi.number().min(0).required(),
            width: Joi.number().min(1).max(12).required(),
            height: Joi.number().min(1).required(),
          }).required(),
          actions: Joi.array().items(
            Joi.object({
              id: Joi.string().uuid().required(),
              type: Joi.string().valid(
                'submit', 'reset', 'navigate', 'api-call',
                'database-query', 'file-upload', 'download',
                'open-modal', 'close-modal', 'show-toast'
              ).required(),
              config: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
            })
          ).default([]),
        })
      ).default([]),
    })
  ).min(1).required(),

  // Queries
  queries: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      name: Joi.string().min(1).max(100).required(),
      dataSourceId: Joi.string().uuid().required(),
      query: Joi.string().min(1).required(),
      parameters: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          type: Joi.string().valid('string', 'number', 'boolean', 'date', 'array').required(),
          required: Joi.boolean().default(false),
          default: Joi.any().optional(),
        })
      ).default([]),
      validation: Joi.object({
        timeout: Joi.number().min(100).max(60000).default(10000),
        maxRows: Joi.number().min(1).max(10000).default(1000),
      }).default(),
      isReadOnly: Joi.boolean().default(true),
    })
  ).default([]),

  // Workflows
  workflows: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      name: Joi.string().min(1).max(100).required(),
      description: Joi.string().max(500).optional(),
      triggers: Joi.array().items(
        Joi.object({
          id: Joi.string().uuid().required(),
          type: Joi.string().valid('schedule', 'event', 'webhook', 'manual', 'api').required(),
          config: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
        })
      ).min(1).required(),
      steps: Joi.array().items(
        Joi.object({
          id: Joi.string().uuid().required(),
          name: Joi.string().min(1).max(100).required(),
          type: Joi.string().valid(
            'action', 'condition', 'loop', 'wait', 
            'parallel', 'subflow', 'notification'
          ).required(),
          action: Joi.string().valid(
            'send_email', 'update_database', 'call_api',
            'notify', 'transform', 'filter', 'aggregate',
            'approval', 'webhook'
          ).required(),
          config: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
          conditions: Joi.array().items(
            Joi.object({
              field: Joi.string().required(),
              operator: Joi.string().valid(
                'equals', 'not_equals', 'greater_than',
                'less_than', 'contains', 'starts_with',
                'ends_with', 'is_true', 'is_false', 'is_null'
              ).required(),
              value: Joi.any().required(),
            })
          ).default([]),
          onError: Joi.string().valid('continue', 'stop', 'retry', 'notify').default('stop'),
          retryConfig: Joi.object({
            maxAttempts: Joi.number().min(1).max(10).default(3),
            delayMs: Joi.number().min(100).max(60000).default(5000),
          }).optional(),
        })
      ).min(1).required(),
      errorHandling: Joi.object({
        retryCount: Joi.number().min(0).max(10).default(3),
        retryDelay: Joi.number().min(100).max(60000).default(5000),
        notifyOnError: Joi.boolean().default(true),
        notifyTo: Joi.array().items(Joi.string().email()).default([]),
      }).default(),
    })
  ).default([]),

  // Roles & Permissions
  roles: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      name: Joi.string().min(1).max(50).required(),
      description: Joi.string().max(200).optional(),
      permissions: Joi.array().items(
        Joi.object({
          resource: Joi.string().required(),
          action: Joi.string().valid('create', 'read', 'update', 'delete', 'execute', 'approve').required(),
          condition: Joi.string().optional(),
        })
      ).min(1).required(),
      isDefault: Joi.boolean().default(false),
      isAdmin: Joi.boolean().default(false),
    })
  ).min(1).required(),

  // Integrations
  integrations: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      name: Joi.string().min(1).max(100).required(),
      type: Joi.string().valid(
        'slack', 'email', 'sms', 'webhook', 
        'zapier', 'make', 'salesforce', 'hubspot'
      ).required(),
      config: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
      isEnabled: Joi.boolean().default(true),
    })
  ).default([]),

  // Tests
  tests: Joi.object({
    unit: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        description: Joi.string().optional(),
        assertion: Joi.string().required(),
        expected: Joi.any().required(),
      })
    ).default([]),
    integration: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        description: Joi.string().optional(),
        steps: Joi.array().items(Joi.string()).min(1).required(),
        expected: Joi.object().default({}),
      })
    ).default([]),
    security: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        description: Joi.string().optional(),
        testType: Joi.string().valid('auth', 'rbac', 'tenant-isolation', 'rate-limit', 'input-validation').required(),
        config: Joi.object().default({}),
      })
    ).default([]),
  }).default(),

  // Deployment
  deployment: Joi.object({
    environments: Joi.array().items(
      Joi.object({
        name: Joi.string().valid('development', 'staging', 'production', 'custom').required(),
        url: Joi.string().uri().optional(),
        config: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
        variables: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
      })
    ).default([]),
    autoDeploy: Joi.boolean().default(false),
    requireApproval: Joi.boolean().default(true),
    deployCommand: Joi.string().optional(),
    healthCheck: Joi.object({
      path: Joi.string().default('/health'),
      timeout: Joi.number().min(100).max(30000).default(5000),
      expectedStatus: Joi.number().valid(200, 201, 204).default(200),
    }).default(),
  }).default(),

  // Audit
  audit: Joi.object({
    changes: Joi.array().items(
      Joi.object({
        id: Joi.string().uuid().required(),
        timestamp: Joi.date().iso().required(),
        user: Joi.string().required(),
        action: Joi.string().required(),
        details: Joi.object().default({}),
        version: Joi.string().required(),
      })
    ).default([]),
    logs: Joi.array().items(
      Joi.object({
        timestamp: Joi.date().iso().required(),
        level: Joi.string().valid('info', 'warn', 'error').required(),
        message: Joi.string().required(),
        data: Joi.object().default({}),
      })
    ).default([]),
  }).default(),
});

// ============================================================
// TYPES
// ============================================================

export type ApplicationSpec = {
  metadata: ApplicationMetadata;
  requirements: Requirement[];
  entities: Entity[];
  dataSources: DataSource[];
  pages: Page[];
  queries: Query[];
  workflows: Workflow[];
  roles: Role[];
  integrations: Integration[];
  tests: TestSuite;
  deployment: DeploymentConfig;
  audit: AuditTrail;
};

export interface ApplicationMetadata {
  name: string;
  description: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  tenantId?: string;
  status: 'draft' | 'validated' | 'deployed' | 'archived';
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'functional' | 'non-functional' | 'security' | 'compliance';
  acceptanceCriteria: string[];
}

export interface Entity {
  id: string;
  name: string;
  description?: string;
  fields: Field[];
  relationships: Relationship[];
}

export interface Field {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'object' | 'array' | 'reference' | 'email' | 'phone' | 'url' | 'json' | 'file' | 'image' | 'password';
  required: boolean;
  unique: boolean;
  default?: any;
  description?: string;
  validation?: FieldValidation;
  reference?: FieldReference;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface FieldReference {
  entity: string;
  field: string;
}

export interface Relationship {
  id: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  target: string;
  sourceField: string;
  targetField: string;
  cascadeDelete: boolean;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'api' | 'database' | 'file' | 'external-service' | 'webhook';
  config: DataSourceConfig;
  isDefault: boolean;
}

export interface DataSourceConfig {
  url?: string;
  authType?: 'none' | 'basic' | 'bearer' | 'oauth2' | 'api-key';
  headers?: Record<string, string>;
  databaseType?: 'postgres' | 'mysql' | 'mongodb' | 'sqlite';
  connectionString?: string;
}

export interface Page {
  id: string;
  name: string;
  path: string;
  type: 'dashboard' | 'form' | 'table' | 'custom' | 'login' | 'profile' | 'settings' | 'reports';
  layout: 'full' | 'sidebar' | 'split';
  widgets: Widget[];
}

export interface Widget {
  id: string;
  type: 'text' | 'button' | 'table' | 'chart' | 'form' | 'input' | 'select' | 'datepicker' | 'filepicker' | 'map' | 'image' | 'video' | 'iframe' | 'card' | 'list' | 'grid' | 'tabs' | 'accordion';
  props: Record<string, any>;
  position: WidgetPosition;
  actions: WidgetAction[];
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetAction {
  id: string;
  type: 'submit' | 'reset' | 'navigate' | 'api-call' | 'database-query' | 'file-upload' | 'download' | 'open-modal' | 'close-modal' | 'show-toast';
  config: Record<string, any>;
}

export interface Query {
  id: string;
  name: string;
  dataSourceId: string;
  query: string;
  parameters: QueryParameter[];
  validation: QueryValidation;
  isReadOnly: boolean;
}

export interface QueryParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  required: boolean;
  default?: any;
}

export interface QueryValidation {
  timeout: number;
  maxRows: number;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  errorHandling: WorkflowErrorHandling;
}

export interface WorkflowTrigger {
  id: string;
  type: 'schedule' | 'event' | 'webhook' | 'manual' | 'api';
  config: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'condition' | 'loop' | 'wait' | 'parallel' | 'subflow' | 'notification';
  action: 'send_email' | 'update_database' | 'call_api' | 'notify' | 'transform' | 'filter' | 'aggregate' | 'approval' | 'webhook';
  config: Record<string, any>;
  conditions: WorkflowCondition[];
  onError: 'continue' | 'stop' | 'retry' | 'notify';
  retryConfig?: {
    maxAttempts: number;
    delayMs: number;
  };
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'starts_with' | 'ends_with' | 'is_true' | 'is_false' | 'is_null';
  value: any;
}

export interface WorkflowErrorHandling {
  retryCount: number;
  retryDelay: number;
  notifyOnError: boolean;
  notifyTo: string[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isDefault: boolean;
  isAdmin: boolean;
}

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve';
  condition?: string;
}

export interface Integration {
  id: string;
  name: string;
  type: 'slack' | 'email' | 'sms' | 'webhook' | 'zapier' | 'make' | 'salesforce' | 'hubspot';
  config: Record<string, any>;
  isEnabled: boolean;
}

export interface TestSuite {
  unit: UnitTest[];
  integration: IntegrationTest[];
  security: SecurityTest[];
}

export interface UnitTest {
  name: string;
  description?: string;
  assertion: string;
  expected: any;
}

export interface IntegrationTest {
  name: string;
  description?: string;
  steps: string[];
  expected: Record<string, any>;
}

export interface SecurityTest {
  name: string;
  description?: string;
  testType: 'auth' | 'rbac' | 'tenant-isolation' | 'rate-limit' | 'input-validation';
  config: Record<string, any>;
}

export interface DeploymentConfig {
  environments: Environment[];
  autoDeploy: boolean;
  requireApproval: boolean;
  deployCommand?: string;
  healthCheck: {
    path: string;
    timeout: number;
    expectedStatus: number;
  };
}

export interface Environment {
  name: 'development' | 'staging' | 'production' | 'custom';
  url?: string;
  config: Record<string, any>;
  variables: Record<string, string>;
}

export interface AuditTrail {
  changes: AuditChange[];
  logs: AuditLog[];
}

export interface AuditChange {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  details: Record<string, any>;
  version: string;
}

export interface AuditLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  data: Record<string, any>;
      }
