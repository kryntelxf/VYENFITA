/**
 * VYENFITA Set Variable Step Executor
 * 
 * Sets variables in the workflow context
 * 
 * @version 1.0.0
 */

import { StepExecutor, StepContext, StepResult, interpolateObject } from './executor.interface';

export class SetVariableExecutor implements StepExecutor {
  readonly type = 'set_variable';

  async execute(step: any, context: StepContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const config = step.config || {};
      const variables = interpolateObject(config.variables || {}, {
        ...context.variables,
        input: context.input,
        steps: context.stepOutputs,
      });

      // Return variables to be merged into context
      return {
        success: true,
        output: { variables },
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Set variable failed',
        durationMs: Date.now() - startTime,
      };
    }
  }

  validate(step: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!step.config?.variables || typeof step.config.variables !== 'object') {
      errors.push('config.variables must be an object');
    }

    return { valid: errors.length === 0, errors };
  }
}
