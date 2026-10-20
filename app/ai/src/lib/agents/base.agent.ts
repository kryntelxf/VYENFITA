import { AgentResult } from './agent.interface';

export abstract class BaseAgent {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly capabilities: any[];

  /**
   * Default validation — subclasses override for custom validation.
   * Uses `any` to allow subclass-specific input types.
   */
  validate(input: any): { valid: boolean; errors: string[] } {
    if (input === undefined || input === null) {
      return { valid: false, errors: ['Input is required'] };
    }
    return { valid: true, errors: [] };
  }

  /**
   * Subclasses implement this.
   * Uses `any` to allow subclass-specific task/input types.
   */
  protected abstract run(
    task: any,
    requestId: string
  ): Promise<Omit<AgentResult<any>, 'agent' | 'durationMs'>>;

  async execute(task: any): Promise<AgentResult<any>> {
    const startTime = Date.now();
    const validation = this.validate(task.input);

    if (!validation.valid) {
      return {
        agent: this.name,
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        durationMs: Date.now() - startTime,
      } as any;
    }

    try {
      const result = await this.run(task, task.context?.requestId || 'unknown');
      return {
        agent: this.name,
        ...result,
        durationMs: Date.now() - startTime,
      } as any;
    } catch (error) {
      return {
        agent: this.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      } as any;
    }
  }
}
