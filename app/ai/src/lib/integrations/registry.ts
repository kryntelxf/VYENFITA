/**
 * VYENFITA Integration Registry
 * 
 * @version 1.0.0
 */

import { IntegrationAdapter, IntegrationProvider, IntegrationType } from './integration.interface';
import { SalesforceAdapter } from './providers/salesforce.provider';
import { HubSpotAdapter } from './providers/hubspot.provider';
import { SlackAdapter } from './providers/slack.provider';
import { JiraAdapter } from './providers/jira.provider';
import { logger } from '../observability/logger';

export class IntegrationRegistry {
  private adapters: Map<IntegrationType, IntegrationAdapter> = new Map();

  constructor() {
    // Register all providers
    this.register(new SalesforceAdapter());
    this.register(new HubSpotAdapter());
    this.register(new SlackAdapter());
    this.register(new JiraAdapter());

    logger.info('Integration adapters registered', { count: this.adapters.size });
  }

  register(adapter: IntegrationAdapter): void {
    this.adapters.set(adapter.provider.type, adapter);
  }

  get(type: IntegrationType): IntegrationAdapter | undefined {
    return this.adapters.get(type);
  }

  has(type: IntegrationType): boolean {
    return this.adapters.has(type);
  }

  listProviders(): IntegrationProvider[] {
    return Array.from(this.adapters.values()).map((a) => a.provider);
  }

  listProvidersByCategory(category: string): IntegrationProvider[] {
    return this.listProviders().filter((p) => p.category === category);
  }
}

let instance: IntegrationRegistry | undefined;

export function getIntegrationRegistry(): IntegrationRegistry {
  if (!instance) {
    instance = new IntegrationRegistry();
  }
  return instance;
}

export default IntegrationRegistry;
