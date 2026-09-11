/**
 * VYENFITA Testing Agent
 * 
 * Generates test plans and test cases for applications.
 * Non-destructive — only produces test specifications.
 * 
 * @version 1.0.0
 */

import { BaseAgent } from './base.agent';
import { AgentTask, AgentResult, AgentCapability } from './agent.interface';

export interface TestingInput {
  applicationSpec: {
    metadata: { name: string; description: string };
    entities?: any[];
    pages?: any[];
    workflows?: any[];
  };
  testTypes?: Array<'unit' | 'integration' | 'e2e' | 'security'>;
}

export interface TestingOutput {
  summary: string;
  coverage: {
    entities: number;
    endpoints: number;
    userFlows: number;
    securityChecks: number;
  };
  testSuites: Array<{
    name: string;
    type: 'unit' | 'integration' | 'e2e' | 'security';
    description: string;
    tests: Array<{
      name: string;
      description: string;
      given: string;
      when: string;
      then: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    }>;
  }>;
  securityChecks: Array<{
    name: string;
    description: string;
    category: 'auth' | 'authorization' | 'injection' | 'tenant-isolation' | 'data-protection';
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
  recommendations: string[];
}

export class TestingAgent extends BaseAgent {
  readonly name = 'testing';
  readonly description =
    'Generates comprehensive test plans (unit, integration, E2E, security) for applications';

  readonly capabilities: AgentCapability[] = [
    {
      name: 'generate_tests',
      description: 'Generate test plan from application spec',
      destructive: false,
      requiresApproval: false,
    },
  ];

  validate(input: TestingInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input || typeof input !== 'object') {
      errors.push('Input must be an object');
      return { valid: false, errors };
    }

    if (!input.applicationSpec || typeof input.applicationSpec !== 'object') {
      errors.push('applicationSpec is required');
    } else if (!input.applicationSpec.metadata) {
      errors.push('applicationSpec.metadata is required');
    }

    return { valid: errors.length === 0, errors };
  }

  protected async run(
    task: AgentTask<TestingInput>,
    _requestId: string
  ): Promise<Omit<AgentResult<TestingOutput>, 'agent' | 'durationMs'>> {
    const { input, context } = task;

    const systemPrompt = `You are VYENFITA Testing Agent, an expert QA engineer.

Given an application specification, produce a comprehensive test plan.

Output ONLY valid JSON matching this exact schema:

{
  "summary": "Executive summary of test coverage",
  "coverage": {
    "entities": 5,
    "endpoints": 8,
    "userFlows": 3,
    "securityChecks": 4
  },
  "testSuites": [
    {
      "name": "Entity CRUD Tests",
      "type": "unit",
      "description": "Test create, read, update, delete for all entities",
      "tests": [
        {
          "name": "Create User",
          "description": "Test user creation",
          "given": "Valid user data",
          "when": "POST /api/v1/users is called",
          "then": "User is created and returned with 201",
          "priority": "critical"
        }
      ]
    }
  ],
  "securityChecks": [
    {
      "name": "Tenant Isolation",
      "description": "Verify tenant A cannot access tenant B data",
      "category": "tenant-isolation",
      "severity": "critical"
    }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Rules:
- Include at least 3 test suites
- Include at least 3 security checks
- Each test must have Given/When/Then
- Prioritize security and tenant isolation
- Do NOT include markdown
- Output ONLY the JSON`;

    const userPrompt = `Generate a test plan for:\n\n${JSON.stringify(input.applicationSpec, null, 2)}\n\nTest types: ${input.testTypes?.join(', ') || 'all'}`;

    const { content, tokensUsed, costUsd } = await this.callAI(
      systemPrompt,
      userPrompt,
      context,
      { temperature: 0.4, maxTokens: 8192, responseFormat: 'json' }
    );

    const output = this.extractJSON(content) as TestingOutput;

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
      reasoning: `Generated ${output.testSuites.length} test suites with ${output.testSuites.reduce((sum, s) => sum + s.tests.length, 0)} tests and ${output.securityChecks.length} security checks`,
      tokensUsed,
      costUsd,
    };
  }

  private validateOutput(output: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!output.summary) errors.push('Missing summary');
    if (!output.coverage) errors.push('Missing coverage');
    if (!Array.isArray(output.testSuites) || output.testSuites.length === 0) {
      errors.push('Missing testSuites');
    }
    if (!Array.isArray(output.securityChecks) || output.securityChecks.length === 0) {
      errors.push('Missing securityChecks');
    }

    return { valid: errors.length === 0, errors };
  }
  }
