/**
 * VYENFITA Input Validator
 * 
 * Zod-based input validation:
 * - Schema validation
 * - Type coercion
 * - Sanitization
 * - Size limits
 * 
 * @version 1.0.0
 */

import { z } from 'zod';

// ============================================================
// COMMON SCHEMAS
// ============================================================

export const commonSchemas = {
  uuid: z.string().uuid(),
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(8).max(128),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/).max(100),
  url: z.string().url().max(2048),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  jsonObject: z.record(z.any()),
  jsonArray: z.array(z.any()),
};

// ============================================================
// AUTH SCHEMAS
// ============================================================

export const authSchemas = {
  register: z.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    name: z.string().min(1).max(255).trim(),
    tenantName: z.string().min(1).max(255).trim().optional(),
    tenantSlug: commonSchemas.slug.optional(),
  }),

  login: z.object({
    email: commonSchemas.email,
    password: z.string().min(1).max(128),
    tenantId: commonSchemas.uuid,
  }),

  refresh: z.object({
    refreshToken: z.string().min(20).max(2048),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: commonSchemas.password,
  }),
};

// ============================================================
// APPLICATION SCHEMAS
// ============================================================

export const applicationSchemas = {
  create: z.object({
    name: z.string().min(1).max(255).trim(),
    description: z.string().max(2000).optional(),
    slug: commonSchemas.slug.optional(),
    spec: commonSchemas.jsonObject,
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),

  update: z.object({
    name: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    spec: commonSchemas.jsonObject.optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    changeLog: z.string().max(1000).optional(),
  }),

  generate: z.object({
    description: z.string().min(10).max(5000).trim(),
    context: commonSchemas.jsonObject.optional(),
  }),
};

// ============================================================
// WORKFLOW SCHEMAS
// ============================================================

export const workflowSchemas = {
  create: z.object({
    name: z.string().min(1).max(255).trim(),
    description: z.string().max(2000).optional(),
    slug: commonSchemas.slug.optional(),
    definition: z.object({
      steps: z.array(z.object({
        id: z.string().min(1).max(100),
        name: z.string().max(255).optional(),
        type: z.enum(['http', 'condition', 'set_variable', 'notification']),
        config: z.record(z.any()),
        onError: z.enum(['stop', 'continue', 'retry']).optional(),
        retryCount: z.number().int().min(0).max(10).optional(),
        timeout: z.number().int().min(100).max(300000).optional(),
      })).min(1).max(100),
    }),
    triggers: z.array(z.record(z.any())).optional(),
  }),

  execute: z.object({
    input: z.record(z.any()).optional(),
    variables: z.record(z.any()).optional(),
  }),
};

// ============================================================
// TENANT SCHEMAS
// ============================================================

export const tenantSchemas = {
  update: z.object({
    name: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(2000).optional(),
    settings: z.record(z.any()).optional(),
  }),

  invite: z.object({
    email: commonSchemas.email,
    roleId: commonSchemas.uuid,
  }),

  updateMemberRole: z.object({
    roleId: commonSchemas.uuid,
  }),

  createRole: z.object({
    name: z.string().min(1).max(100).trim(),
    description: z.string().max(500).optional(),
    permissions: z.array(z.string().regex(/^[\w-]+:[\w-]+$/)).min(1).max(100),
  }),
};

// ============================================================
// DEPLOYMENT SCHEMAS
// ============================================================

export const deploymentSchemas = {
  create: z.object({
    environmentId: commonSchemas.uuid,
    versionId: commonSchemas.uuid,
    target: z.object({
      type: z.enum(['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'vercel', 'netlify']),
      name: z.string().min(1).max(100),
      config: z.record(z.any()),
    }),
    config: z.record(z.any()).optional(),
  }),
};

// ============================================================
// VALIDATION HELPER
// ============================================================

export class InputValidator {
  /**
   * Validate and return typed data
   */
  static validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown
  ): { success: true; data: T } | { success: false; errors: string[] } {
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    }

    return {
      success: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }
      }
