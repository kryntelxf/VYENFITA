/**
 * VYENFITA Requirement Agent
 * 
 * Analyzes business requirements and produces structured output.
 * Non-destructive — only reads and produces a spec.
 * 
 * @version 1.0.0
 */

import { BaseAgent } from './base.agent';
import { AgentTask, AgentResult, AgentCapability } from './agent.interface';

export interface RequirementInput {
  description: string;
  context?: Record<string, any>;
}

export interface RequirementOutput {
  summary: string;
  purpose: string;
  users: Array<{
    name: string;
    role: string;
    goals: string[];
    painPoints: string[];
  }>;
  features: Array<{
    name: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    acceptanceCriteria: string[];
  }>;
  constraints: string[];
  assumptions: string[];
  risks: string[];
  successCriteria: string[];
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  estimatedEffort: string;
  recommendedApproach: string;
}

export class RequirementAgent extends BaseAgent {
  readonly name = 'requirement';
  readonly description =
    'Analyzes business requirements and produces a structured requirements document';

  readonly capabilities: AgentCapability[] = [
    {
      name: 'analyze_requirements',
      description: 'Analyze natural language description into structured requirements',
      destructive: false,
      requiresApproval: false,
    },
  ];

  validate(input: RequirementInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input || typeof input !== 'object') {
      errors.push('Input must be an object');
      return { valid: false, errors };
    }

    if (!input.description || typeof input.description !== 'string') {
      errors.push('description is required and must be a string');
    } else if (input.description.length < 10) {
      errors.push('description must be at least 10 characters');
    } else if (input.description.length > 5000) {
      errors.push('description must not exceed 5000 characters');
    }

    return { valid: errors.length === 0, errors };
  }

  protected async run(
    task: AgentTask<RequirementInput>,
    _requestId: string
  ): Promise<Omit<AgentResult<RequirementOutput>, 'agent' | 'durationMs'>> {
    const { input, context } = task;

    const systemPrompt = `You are VYENFITA Requirement Agent, an expert business analyst.

Analyze the user's business description and produce a structured requirements document.

Output ONLY valid JSON matching this exact schema:

{
  "summary": "One-paragraph executive summary",
  "purpose": "The problem this solves and why it matters",
  "users": [
    {
      "name": "User Type",
      "role": "Role title",
      "goals": ["Goal 1", "Goal 2"],
      "painPoints": ["Pain point 1", "Pain point 2"]
    }
  ],
  "features": [
    {
      "name": "Feature Name",
      "description": "Detailed description",
      "priority": "critical | high | medium | low",
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"]
    }
  ],
  "constraints": ["Constraint 1", "Constraint 2"],
  "assumptions": ["Assumption 1", "Assumption 2"],
  "risks": ["Risk 1", "Risk 2"],
  "successCriteria": ["Measurable criterion 1", "Measurable criterion 2"],
  "complexity": "simple | moderate | complex | enterprise",
  "estimatedEffort": "e.g. '2-3 weeks'",
  "recommendedApproach": "Recommended implementation approach"
}

Rules:
- Be specific and actionable
- At least 2 users, 3 features
- Acceptance criteria must be measurable
- Do NOT include markdown
- Output ONLY the JSON`;

    const userPrompt = input.context
      ? `${input.description}\n\nAdditional context:\n${JSON.stringify(input.context, null, 2)}`
      : input.description;

    const { content, tokensUsed, costUsd } = await this.callAI(
      systemPrompt,
      userPrompt,
      context,
      { temperature: 0.4, maxTokens: 6000, responseFormat: 'json' }
    );

    const output = this.extractJSON(content) as RequirementOutput;

    // Validate output structure
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
      confidence: 0.85,
      reasoning: `Analyzed ${output.features.length} features for ${output.users.length} user types`,
      tokensUsed,
      costUsd,
    };
  }

  private validateOutput(output: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!output.summary) errors.push('Missing summary');
    if (!output.purpose) errors.push('Missing purpose');
    if (!Array.isArray(output.users) || output.users.length === 0) {
      errors.push('Missing users array');
    }
    if (!Array.isArray(output.features) || output.features.length === 0) {
      errors.push('Missing features array');
    }
    if (!output.complexity) errors.push('Missing complexity');
    if (!output.recommendedApproach) errors.push('Missing recommendedApproach');

    return { valid: errors.length === 0, errors };
  }
    }
