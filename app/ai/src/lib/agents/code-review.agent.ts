/**
 * VYENFITA Code Review Agent
 * 
 * Reviews generated code for quality, security, and best practices.
 * Non-destructive — only produces review feedback.
 * 
 * @version 1.0.0
 */

import { BaseAgent } from './base.agent';
import { AgentTask, AgentResult, AgentCapability } from './agent.interface';

export interface CodeReviewInput {
  code: string;
  language: string;
  context?: {
    purpose?: string;
    framework?: string;
    constraints?: string[];
  };
}

export interface CodeReviewOutput {
  summary: string;
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: 'security' | 'correctness' | 'performance' | 'maintainability' | 'style';
    line?: number;
    message: string;
    suggestion: string;
  }>;
  strengths: string[];
  recommendations: string[];
  approved: boolean;
}

export class CodeReviewAgent extends BaseAgent {
  readonly name = 'code_review';
  readonly description =
    'Reviews code for security, correctness, performance, and maintainability';

  readonly capabilities: AgentCapability[] = [
    {
      name: 'review_code',
      description: 'Review code and produce structured feedback',
      destructive: false,
      requiresApproval: false,
    },
  ];

  validate(input: CodeReviewInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input || typeof input !== 'object') {
      errors.push('Input must be an object');
      return { valid: false, errors };
    }

    if (!input.code || typeof input.code !== 'string') {
      errors.push('code is required and must be a string');
    } else if (input.code.length < 10) {
      errors.push('code must be at least 10 characters');
    } else if (input.code.length > 50000) {
      errors.push('code must not exceed 50000 characters');
    }

    if (!input.language || typeof input.language !== 'string') {
      errors.push('language is required');
    }

    return { valid: errors.length === 0, errors };
  }

  protected async run(
    task: AgentTask<CodeReviewInput>,
    _requestId: string
  ): Promise<Omit<AgentResult<CodeReviewOutput>, 'agent' | 'durationMs'>> {
    const { input, context } = task;

    const systemPrompt = `You are VYENFITA Code Review Agent, an expert software engineer.

Review the provided code and produce structured feedback.

Output ONLY valid JSON matching this exact schema:

{
  "summary": "Executive summary of the review",
  "score": 85,
  "grade": "A | B | C | D | F",
  "issues": [
    {
      "severity": "critical | high | medium | low | info",
      "category": "security | correctness | performance | maintainability | style",
      "line": 42,
      "message": "What's wrong",
      "suggestion": "How to fix"
    }
  ],
  "strengths": ["Strength 1", "Strength 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "approved": true
}

Rules:
- Focus on security issues first
- Be specific about line numbers where possible
- Score: 90+ = A, 80+ = B, 70+ = C, 60+ = D, <60 = F
- approved = false if any critical or high security issues
- Do NOT include markdown
- Output ONLY the JSON`;

    const userPrompt = `Review this ${input.language} code:\n\n\`\`\`${input.language}\n${input.code}\n\`\`\`\n\nContext: ${input.context ? JSON.stringify(input.context, null, 2) : 'None'}`;

    const { content, tokensUsed, costUsd } = await this.callAI(
      systemPrompt,
      userPrompt,
      context,
      { temperature: 0.2, maxTokens: 4096, responseFormat: 'json' }
    );

    const output = this.extractJSON(content) as CodeReviewOutput;

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
      reasoning: `Found ${output.issues.length} issues, score ${output.score}/${output.grade}`,
      tokensUsed,
      costUsd,
    };
  }

  private validateOutput(output: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!output.summary) errors.push('Missing summary');
    if (typeof output.score !== 'number' || output.score < 0 || output.score > 100) {
      errors.push('score must be 0-100');
    }
    if (!output.grade) errors.push('Missing grade');
    if (!Array.isArray(output.issues)) errors.push('Missing issues array');
    if (typeof output.approved !== 'boolean') errors.push('approved must be boolean');

    return { valid: errors.length === 0, errors };
  }
  }
