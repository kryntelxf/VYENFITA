/**
 * VYENFITA Requirement Agent
 * 
 * Analyzes user requirements deeply before application generation.
 * This is the first step in the AI Agents system.
 * 
 * @version 1.0.0
 */

import { AIService } from '../services/ai.service';
import { ChatMessage } from '../interfaces/ai-provider.interface';

export interface RequirementAnalysis {
  summary: string;
  purpose: string;
  users: UserProfile[];
  features: Feature[];
  constraints: Constraint[];
  assumptions: string[];
  risks: Risk[];
  dataRequirements: DataRequirement[];
  integrations: IntegrationRequirement[];
  successCriteria: string[];
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  estimatedEffort: string;
  recommendedApproach: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  description: string;
  goals: string[];
  painPoints: string[];
  frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'functional' | 'non-functional' | 'security' | 'compliance';
  dependencies: string[];
  acceptanceCriteria: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface Constraint {
  id: string;
  type: 'technical' | 'business' | 'regulatory' | 'resource';
  description: string;
  impact: 'high' | 'medium' | 'low';
  mitigation?: string;
}

export interface Risk {
  id: string;
  description: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
}

export interface DataRequirement {
  id: string;
  name: string;
  description: string;
  type: 'entity' | 'relationship' | 'attribute';
  fields: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}

export interface IntegrationRequirement {
  id: string;
  name: string;
  type: 'api' | 'database' | 'file' | 'webhook' | 'service';
  description: string;
  dataFlow: 'inbound' | 'outbound' | 'bidirectional';
  security: string;
}

export class RequirementAgent {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Analyze user requirements
   */
  async analyze(description: string, context?: Record<string, any>): Promise<RequirementAnalysis> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildUserPrompt(description, context);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.4,
      maxTokens: 8192,
    });

    return this.parseResponse(response.choices[0].message.content);
  }

  /**
   * Refine requirements based on feedback
   */
  async refine(analysis: RequirementAnalysis, feedback: string): Promise<RequirementAnalysis> {
    const systemPrompt = `You are VYENFITA Requirement Agent. 
Refine the requirement analysis based on user feedback.

Current analysis:
${JSON.stringify(analysis, null, 2)}

User feedback: ${feedback}

Output a refined analysis in the same structure.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Refine the requirements based on the feedback above.' },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3,
      maxTokens: 8192,
    });

    return this.parseResponse(response.choices[0].message.content);
  }

  /**
   * Generate questions to clarify requirements
   */
  async generateQuestions(description: string): Promise<string[]> {
    const systemPrompt = `You are VYENFITA Requirement Agent.
Generate 5-10 clarifying questions to better understand the user's requirements.

The questions should cover:
- Business goals
- Users and roles
- Data requirements
- Integrations
- Constraints
- Security needs
- Success criteria

Output as a JSON array of strings.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Description: ${description}` },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.5,
      maxTokens: 2048,
    });

    try {
      const jsonMatch = response.choices[0].message.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch {
      return [];
    }
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  private getSystemPrompt(): string {
    return `You are VYENFITA Requirement Agent, an expert business analyst with deep experience in software requirements engineering.

Your task is to analyze user requirements and produce a structured, comprehensive requirement analysis.

Output must be a valid JSON with this structure:
{
  "summary": "Brief summary of the application",
  "purpose": "What problem does this solve and why",
  "users": [
    {
      "id": "user-1",
      "name": "User Type Name",
      "role": "Role title",
      "description": "Detailed description of this user type",
      "goals": ["Goal 1", "Goal 2"],
      "painPoints": ["Pain point 1", "Pain point 2"],
      "frequency": "daily|weekly|monthly|occasional"
    }
  ],
  "features": [
    {
      "id": "feat-1",
      "name": "Feature Name",
      "description": "Feature description",
      "priority": "critical|high|medium|low",
      "category": "functional|non-functional|security|compliance",
      "dependencies": ["feat-2"],
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
      "estimatedComplexity": "low|medium|high"
    }
  ],
  "constraints": [
    {
      "id": "const-1",
      "type": "technical|business|regulatory|resource",
      "description": "Constraint description",
      "impact": "high|medium|low",
      "mitigation": "How to address"
    }
  ],
  "assumptions": ["Assumption 1", "Assumption 2"],
  "risks": [
    {
      "id": "risk-1",
      "description": "Risk description",
      "probability": "high|medium|low",
      "impact": "high|medium|low",
      "mitigation": "How to mitigate"
    }
  ],
  "dataRequirements": [
    {
      "id": "data-1",
      "name": "Data Entity Name",
      "description": "Data entity description",
      "type": "entity|relationship|attribute",
      "fields": [
        {
          "name": "fieldName",
          "type": "string|number|boolean|date|reference",
          "required": true|false,
          "description": "Field description"
        }
      ]
    }
  ],
  "integrations": [
    {
      "id": "int-1",
      "name": "Integration Name",
      "type": "api|database|file|webhook|service",
      "description": "Integration description",
      "dataFlow": "inbound|outbound|bidirectional",
      "security": "Authentication method"
    }
  ],
  "successCriteria": ["Criterion 1", "Criterion 2"],
  "complexity": "simple|moderate|complex|enterprise",
  "estimatedEffort": "Estimate",
  "recommendedApproach": "Recommended approach"
}`;
  }

  private buildUserPrompt(description: string, context?: Record<string, any>): string {
    let prompt = `Analyze the following business requirement:\n\n${description}\n\n`;

    if (context) {
      prompt += `Context:\n${JSON.stringify(context, null, 2)}\n\n`;
    }

    prompt += `Provide a comprehensive requirement analysis.`;
    return prompt;
  }

  private parseResponse(content: string): RequirementAnalysis {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse requirement analysis: ${error}`);
    }
  }
  }
