/**
 * VYENFITA Workflow Executor Registry
 * 
 * @version 1.0.0
 */

import { StepExecutor } from './executors/executor.interface';
import { HttpExecutor } from './executors/http.executor';
import { ConditionExecutor } from './executors/condition.executor';
import { NotificationExecutor } from './executors/notification.executor';
import { SetVariableExecutor } from './executors/set-variable.executor';

export class ExecutorRegistry {
  private executors: Map<string, StepExecutor> = new Map();

  constructor() {
    // Register built-in executors
    this.register(new HttpExecutor());
    this.register(new ConditionExecutor());
    this.register(new NotificationExecutor());
    this.register(new SetVariableExecutor());
  }

  register(executor: StepExecutor): void {
    this.executors.set(executor.type, executor);
  }

  get(type: string): StepExecutor | undefined {
    return this.executors.get(type);
  }

  has(type: string): boolean {
    return this.executors.has(type);
  }

  list(): string[] {
    return Array.from(this.executors.keys());
  }
}

let registryInstance: ExecutorRegistry | undefined;

export function getExecutorRegistry(): ExecutorRegistry {
  if (!registryInstance) {
    registryInstance = new ExecutorRegistry();
  }
  return registryInstance;
  }
