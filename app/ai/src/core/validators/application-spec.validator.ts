/**
 * Application Specification Validator
 * Validates generated application specs against the schema
 */

import Joi from 'joi';
import { ApplicationSpecSchema, ApplicationSpec } from '../schemas/application-spec.schema';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  data?: ApplicationSpec;
}

export interface ValidationError {
  path: string[];
  message: string;
  type: 'required' | 'invalid' | 'unknown';
}

export interface ValidationWarning {
  path: string[];
  message: string;
  type: 'suggestion' | 'deprecation' | 'performance';
}

export class ApplicationSpecValidator {
  /**
   * Validate an application specification against the schema
   */
  static validate(data: any): ValidationResult {
    const result = ApplicationSpecSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (result.error) {
      for (const detail of result.error.details) {
        errors.push({
          path: detail.path.map(String),
          message: detail.message,
          type: detail.type === 'any.required' ? 'required' : 'invalid',
        });
      }
    }

    // Additional business logic validations
    if (result.value) {
      const spec = result.value as ApplicationSpec;
      
      // Check that every datasource referenced in queries exists
      const datasourceIds = new Set(spec.dataSources.map(ds => ds.id));
      for (const query of spec.queries) {
        if (!datasourceIds.has(query.dataSourceId)) {
          errors.push({
            path: ['queries', query.id, 'dataSourceId'],
            message: `Data source "${query.dataSourceId}" not found`,
            type: 'invalid',
          });
        }
      }

      // Check that every entity reference is valid
      const entityNames = new Set(spec.entities.map(e => e.name));
      for (const entity of spec.entities) {
        for (const rel of entity.relationships) {
          if (!entityNames.has(rel.target)) {
            errors.push({
              path: ['entities', entity.name, 'relationships', rel.id, 'target'],
              message: `Target entity "${rel.target}" not found`,
              type: 'invalid',
            });
          }
        }
      }

      // Check that at least one page exists
      if (spec.pages.length === 0) {
        errors.push({
          path: ['pages'],
          message: 'At least one page is required',
          type: 'required',
        });
      }

      // Check that at least one role exists
      if (spec.roles.length === 0) {
        errors.push({
          path: ['roles'],
          message: 'At least one role is required',
          type: 'required',
        });
      }

      // Warning: Check if any page has no widgets
      for (const page of spec.pages) {
        if (page.widgets.length === 0) {
          warnings.push({
            path: ['pages', page.id, 'widgets'],
            message: `Page "${page.name}" has no widgets. Consider adding at least one widget.`,
            type: 'suggestion',
          });
        }
      }

      // Warning: Check if any entity has no fields
      for (const entity of spec.entities) {
        if (entity.fields.length === 0) {
          warnings.push({
            path: ['entities', entity.name, 'fields'],
            message: `Entity "${entity.name}" has no fields. Consider adding at least one field.`,
            type: 'suggestion',
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: result.value as ApplicationSpec | undefined,
    };
  }

  /**
   * Validate and throw if invalid
   */
  static validateOrThrow(data: any): ApplicationSpec {
    const result = this.validate(data);
    if (!result.isValid) {
      const errorMessages = result.errors.map(e => 
        `[${e.path.join('.')}] ${e.message}`
      ).join('\n');
      throw new Error(`Application validation failed:\n${errorMessages}`);
    }
    return result.data!;
  }

  /**
   * Get validation errors as structured data
   */
  static getValidationErrors(data: any): ValidationError[] {
    return this.validate(data).errors;
  }

  /**
   * Check if data is a valid application spec
   */
  static isValid(data: any): boolean {
    return this.validate(data).isValid;
  }
            }
