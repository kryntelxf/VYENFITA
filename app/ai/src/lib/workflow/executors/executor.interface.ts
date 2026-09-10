/**
 * VYENFITA Step Executor Interface
 * 
 * @version 1.0.0
 */

export interface StepContext {
  executionId: string;
  workflowId: string;
  tenantId: string;
  userId?: string;
  variables: Record<string, any>;
  input: Record<string, any>;
  stepOutputs: Record<string, any>;
}

export interface StepResult {
  success: boolean;
  output?: any;
  error?: string;
  shouldStop?: boolean;
  nextStepId?: string;
  durationMs: number;
}

export interface StepExecutor {
  readonly type: string;

  /**
   * Execute a step
   */
  execute(step: any, context: StepContext): Promise<StepResult>;

  /**
   * Validate step definition
   */
  validate(step: any): { valid: boolean; errors: string[] };
}

/**
 * Variable interpolation helper: {{variable.path}}
 */
export function interpolate(template: string, variables: Record<string, any>): string {
  if (typeof template !== 'string') return template;

  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmed = path.trim();
    const value = getNestedValue(variables, trimmed);
    return value !== undefined ? String(value) : match;
  });
}

export function interpolateObject(obj: any, variables: Record<string, any>): any {
  if (typeof obj === 'string') {
    return interpolate(obj, variables);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, variables));
  }

  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, variables);
    }
    return result;
  }

  return obj;
}

export function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
    }
