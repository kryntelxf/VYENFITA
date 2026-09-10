/**
 * VYENFITA Validation Middleware
 * 
 * Zod-based validation for Express routes
 * 
 * @version 2.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export class ValidationMiddleware {
  /**
   * Validate request body against a Zod schema
   */
  static body<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        });
        return;
      }

      // Replace body with parsed data (includes defaults, coercion, trimming)
      req.body = result.data;
      next();
    };
  }

  /**
   * Validate query parameters
   */
  static query<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: result.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      // Cannot reassign req.query in Express 4+, store validated copy
      (req as any).validatedQuery = result.data;
      next();
    };
  }

  /**
   * Validate URL parameters
   */
  static params<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid URL parameters',
          details: result.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      (req as any).validatedParams = result.data;
      next();
    };
  }
}

// ============================================================
// BACKWARD COMPATIBLE SCHEMA (for existing routes)
// ============================================================

import Joi from 'joi';

export const legacySchemas = {
  chat: Joi.object({
    messages: Joi.array().items(
      Joi.object({
        role: Joi.string().valid('system', 'user', 'assistant').required(),
        content: Joi.string().required(),
      })
    ).min(1).required(),
    temperature: Joi.number().min(0).max(2).optional(),
    maxTokens: Joi.number().positive().optional(),
  }),

  generateApplication: Joi.object({
    description: Joi.string().min(10).max(5000).required(),
    context: Joi.object().optional(),
  }),

  generateWorkflow: Joi.object({
    description: Joi.string().min(10).max(5000).required(),
  }),

  switchProvider: Joi.object({
    provider: Joi.string().required(),
  }),
};

// Keep legacy validate method working
export class LegacyValidationMiddleware {
  static validate(schema: Joi.ObjectSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        res.status(400).json({
          error: 'Validation error',
          details: error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message,
          })),
        });
        return;
      }

      req.body = value;
      next();
    };
  }

  static schemas = legacySchemas;
}

// Re-export for backward compatibility
ValidationMiddleware.validate = LegacyValidationMiddleware.validate;
(ValidationMiddleware as any).schemas = legacySchemas;
