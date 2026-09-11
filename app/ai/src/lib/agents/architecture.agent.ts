/**
 * VYENFITA Architecture Agent
 * 
 * Designs system architecture from requirements.
 * Non-destructive — only produces a design document.
 * 
 * @version 1.0.0
 */

import { BaseAgent } from './base.agent';
import { AgentTask, AgentResult, AgentCapability } from './agent.interface';
import { RequirementOutput } from './requirement.agent';

export interface ArchitectureInput {
  requirements: RequirementOutput;
  context?: Record<string, any>;
}

export interface ArchitectureOutput {
  overview: string;
  pattern: string;
  layers: Array<{
    name: string;
    responsibility: string;
    technologies: string[];
  }>;
  dataModel: {
    entities: Array<{
      name: string;
      fields: Array<{
        name: string;
        type: string;
        required: boolean;
      }>;
      relationships: Array<{
        type: 'one-to-one' | 'one-to-many' | 'many-to-many';
        target: string;
      }>;
    }>;
  };
  apiDesign: {
    endpoints: Array<{
      method: string;
      path: string;
      purpose: string;
      auth: boolean;
    }>;
  };
  infrastructure: {
    deployment: string[];
    scaling: string[];
    monitoring: string[];
  };
  security: {
    authentication: string;
    authorization: string;
    dataProtection: string[];
  };
  tradeoffs: Array<{
    decision: string;
    pros: string[];
    cons: string[];
  }>;
}

export class ArchitectureAgent extends BaseAgent {
  readonly name = 'architecture';
  readonly description =
    'Designs system architecture (layers, data model, API, infrastructure, security) from requirements';

  readonly capabilities: AgentCapability[] = [
    {
      name: 'design_architecture',
      description: 'Design system architecture from requirements',
      destructive: false,
      requiresApproval: false,
    },
  ];

  validate(input: ArchitectureInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input || typeof input !== 'object') {
      errors.push('Input must be an object');
      return { valid: false, errors };
    }

    if (!input.requirements || typeof input.requirements !== 'object') {
      errors.push('requirements object is required');
    } else if (!Array.isArray(input.requirements.features)) {
      errors.push('requirements.features must be an array');
    }

    return { valid: errors.length === 0, errors };
  }

  protected async run(
    task: AgentTask<ArchitectureInput>,
    _requestId: string
  ): Promise<Omit<AgentResult<ArchitectureOutput>, 'agent' | 'durationMs'>> {
    const { input, context } = task;

    const systemPrompt = `You are VYENFITA Architecture Agent, an expert software architect.

Given structured requirements, design a complete system architecture.

Output ONLY valid JSON matching this exact schema:

{
  "overview": "Executive summary of the architecture",
  "pattern": "e.g. Layered Monolith | Microservices | Modular Monolith | Event-Driven",
  "layers": [
    {
      "name": "Layer Name",
      "responsibility": "What this layer does",
      "technologies": ["Tech 1", "Tech 2"]
    }
  ],
  "dataModel": {
    "entities": [
      {
        "name": "EntityName",
        "fields": [
          { "name": "fieldName", "type": "string | number | boolean | date | reference", "required": true }
        ],
        "relationships": [
          { "type": "one-to-many", "target": "OtherEntity" }
        ]
      }
    ]
  },
  "apiDesign": {
    "endpoints": [
      {
        "method": "GET | POST | PUT | DELETE",
        "path": "/api/v1/resource",
        "purpose": "What this endpoint does",
        "auth": true
      }
    ]
  },
  "infrastructure": {
    "deployment": ["Docker", "Kubernetes"],
    "scaling": ["Horizontal pod autoscaling", "Database read replicas"],
    "monitoring": ["Prometheus", "Grafana", "Loki"]
  },
  "security": {
    "authentication": "JWT with refresh tokens",
    "authorization": "RBAC with tenant isolation",
    "dataProtection": ["TLS in transit", "AES-256-GCM at rest", "Secret rotation"]
  },
  "tradeoffs": [
    {
      "decision": "Decision made",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"]
    }
  ]
}

Rules:
- Be specific with technologies
- Data model must have at least 3 entities
- API design must have at least 5 endpoints
- Include at least 2 tradeoffs
- Do NOT include markdown
- Output ONLY the JSON`;

    const userPrompt = `Design architecture for the following requirements:\n\n${JSON.stringify(input.requirements, null, 2)}`;

    const { content, tokensUsed, costUsd } = await this.callAI(
      systemPrompt,
      userPrompt,
      context,
      { temperature: 0.3, maxTokens: 8192, responseFormat: 'json' }
    );

    const output = this.extractJSON(content) as ArchitectureOutput;

    const validation = this.validateOutput(output);
    if (!validation.valid) {
      return {
        success: false,
        error: `Agent output invalid: ${validation.errors.join(', ')}`,
        tokensUsed,
        costUsd,
      };
    }

    return {
      success: true,
      output,
      confidence: 0.8,
      reasoning: `Designed ${output.layers.length} layers, ${output.dataModel.entities.length} entities, ${output.apiDesign.endpoints.length} endpoints`,
      tokensUsed,
      costUsd,
    };
  }

  private validateOutput(output: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!output.overview) errors.push('Missing overview');
    if (!output.pattern) errors.push('Missing pattern');
    if (!Array.isArray(output.layers) || output.layers.length === 0) errors.push('Missing layers');
    if (!output.dataModel || !Array.isArray(output.dataModel.entities)) errors.push('Missing dataModel.entities');
    if (!output.apiDesign || !Array.isArray(output.apiDesign.endpoints)) errors.push('Missing apiDesign.endpoints');
    if (!output.infrastructure) errors.push('Missing infrastructure');
    if (!output.security) errors.push('Missing security');

    return { valid: errors.length === 0, errors };
  }
        }
