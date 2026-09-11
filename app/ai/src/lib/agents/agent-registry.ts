/**
 * VYENFITA Agent Registry
 * 
 * Central registry for all agents.
 * 
 * @version 1.0.0
 */

import { Agent } from './agent.interface';
import { RequirementAgent } from './requirement.agent';
import { ArchitectureAgent } from './architecture.agent';
import { TestingAgent } from './testing.agent';
import { CodeReviewAgent } from './code-review.agent';

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();

  constructor() {
    this.register(new RequirementAgent());
    this.register(new ArchitectureAgent());
    this.register(new TestingAgent());
    this.register(new CodeReviewAgent());
  }

  register(agent: Agent): void {
    this.agents.set(agent.name, agent);
  }

  get(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  list(): Array<{ name: string; description: string; capabilities: any[] }> {
    return Array.from(this.agents.values()).map((a) => ({
      name: a.name,
      description: a.description,
      capabilities: a.capabilities,
    }));
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }
}

let registryInstance: AgentRegistry | undefined;

export function getAgentRegistry(): AgentRegistry {
  if (!registryInstance) {
    registryInstance = new AgentRegistry();
  }
  return registryInstance;
}
