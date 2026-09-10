/**
 * VYENFITA Condition Step Executor
 * 
 * Evaluates conditions and branches execution
 * 
 * @version 1.0.0
 */

import { StepExecutor, StepContext, StepResult, getNestedValue } from './executor.interface';

export class ConditionExecutor implements StepExecutor {
  readonly type = 'condition';

  async execute(step: any, context: StepContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const conditions = step.config?.conditions || [];
      const evaluateAll = step.config?.evaluateAll ?? true;

      if (conditions.length === 0) {
        return {
          success: false,
          error: 'No conditions defined',
          durationMs: Date.now() - startTime,
        };
      }

      const results = conditions.map((condition: any) => {
        const value = getNestedValue(
          { ...context.input, ...context.variables, steps: context.stepOutputs },
          condition.field
        );
        return this.evaluate(value, condition.operator, condition.value);
      });

      const passed = evaluateAll ? results.every(Boolean) : results.some(Boolean);

      return {
        success: true,
        output: { passed, results },
        nextStepId: passed ? step.config?.onTrue : step.config?.onFalse,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Condition evaluation failed',
        durationMs: Date.now() - startTime,
      };
    }
  }

  validate(step: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(step.config?.conditions) || step.config.conditions.length === 0) {
      errors.push('config.conditions must be a non-empty array');
    } else {
      for (const [index, condition] of step.config.conditions.entries()) {
        if (!condition.field) errors.push(`conditions[${index}].field is required`);
        if (!condition.operator) errors.push(`conditions[${index}].operator is required`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private evaluate(value: any, operator: string, target: any): boolean {
    switch (operator) {
      case 'equals':
        return value === target;
      case 'not_equals':
        return value !== target;
      case 'greater_than':
        return Number(value) > Number(target);
      case 'less_than':
        return Number(value) < Number(target);
      case 'greater_than_or_equal':
        return Number(value) >= Number(target);
      case 'less_than_or_equal':
        return Number(value) <= Number(target);
      case 'contains':
        return String(value).includes(String(target));
      case 'starts_with':
        return String(value).startsWith(String(target));
      case 'ends_with':
        return String(value).endsWith(String(target));
      case 'is_null':
        return value === null || value === undefined;
      case 'is_not_null':
        return value !== null && value !== undefined;
      case 'is_true':
        return value === true;
      case 'is_false':
        return value === false;
      case 'in':
        return Array.isArray(target) && target.includes(value);
      case 'not_in':
        return Array.isArray(target) && !target.includes(value);
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }
  }
