/**
 * VYENFITA Architecture Agent
 * 
 * Designs application architecture based on requirements
 * - Recommends architectural patterns
 - Technology stack recommendations
 - Scalability analysis
 - Deployment strategy
 * 
 * @version 1.0.0
 */

import { AIService } from '../services/ai.service';
import { ChatMessage } from '../interfaces/ai-provider.interface';

export interface ArchitectureDesign {
  summary: string;
  patterns: ArchitecturePattern[];
  layers: Layer[];
  technologyStack: Technology[];
  dataFlow: string;
  scalability: ScalabilityPlan;
  security: SecurityPlan;
  deployment: DeploymentStrategy;
  recommendations: string[];
}

export interface ArchitecturePattern {
  name: string;
  description: string;
  useCase: string;
  pros: string[];
  cons: string[];
}

export interface Layer {
  name: string;
  description: string;
  components: Component[];
  responsibilities: string[];
}

export interface Component {
  name: string;
  description: string;
  technology: string;
  dependencies: string[];
}

export interface Technology {
  category: 'frontend' | 'backend' | 'database' | 'cache' | 'message_queue' | 'monitoring' | 'deployment';
  name: string;
  description: string;
  reason: string;
}

export interface ScalabilityPlan {
  strategy: string;
  estimatedLoad: string;
  horizontalScaling: boolean;
  verticalScaling: boolean;
  autoScaling: boolean;
  bottlenecks: string[];
  recommendations: string[];
}

export interface SecurityPlan {
  authentication: string;
  authorization: string;
  encryption: string;
  dataProtection: string;
  compliance: string[];
  recommendations: string[];
}

export interface DeploymentStrategy {
  environment: 'cloud' | 'on-premise' | 'hybrid';
  providers: string[];
  ci_cd: string;
  containerization: string;
  orchestration: string;
  monitoring: string[];
  recommendations: string[];
}

export class ArchitectureAgent {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Design architecture based on requirements
   */
  async design(requirements: any, context?: Record<string, any>): Promise<ArchitectureDesign> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildUserPrompt(requirements, context);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3,
      maxTokens: 8192,
    });

    return this.parseResponse(response.choices[0].message.content);
  }

  /**
   * Evaluate architecture design
   */
  async evaluate(design: ArchitectureDesign): Promise<ArchitectureEvaluation> {
    const systemPrompt = `You are VYENFITA Architecture Evaluator.
Evaluate the architecture design and provide feedback.

Current design:
${JSON.stringify(design, null, 2)}

Provide evaluation in JSON format:
{
  "score": 0-100,
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "risks": ["Risk 1", "Risk 2"],
  "improvements": ["Improvement 1", "Improvement 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Evaluate the architecture design above.' },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3,
      maxTokens: 4096,
    });

    return this.parseEvaluation(response.choices[0].message.content);
  }

  private getSystemPrompt(): string {
    return `You are VYENFITA Architecture Agent, an expert software architect with deep experience in designing scalable, secure, and maintainable systems.

Your task is to design the application architecture based on the provided requirements.

Output must be a valid JSON with this structure:
{
  "summary": "Brief summary of the architecture",
  "patterns": [
    {
      "name": "Pattern Name",
      "description": "Pattern description",
      "useCase": "When to use this pattern",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"]
    }
  ],
  "layers": [
    {
      "name": "Layer Name",
      "description": "Layer description",
      "components": [
        {
          "name": "Component Name",
          "description": "Component description",
          "technology": "Technology used",
          "dependencies": ["dep1", "dep2"]
        }
      ],
      "responsibilities": ["Responsibility 1", "Responsibility 2"]
    }
  ],
  "technologyStack": [
    {
      "category": "frontend|backend|database|cache|message_queue|monitoring|deployment",
      "name": "Technology Name",
      "description": "Technology description",
      "reason": "Why this technology was chosen"
    }
  ],
  "dataFlow": "Description of how data flows through the system",
  "scalability": {
    "strategy": "Scalability strategy",
    "estimatedLoad": "Estimated load",
    "horizontalScaling": true|false,
    "verticalScaling": true|false,
    "autoScaling": true|false,
    "bottlenecks": ["Bottleneck 1", "Bottleneck 2"],
    "recommendations": ["Recommendation 1", "Recommendation 2"]
  },
  "security": {
    "authentication": "Authentication method",
    "authorization": "Authorization method",
    "encryption": "Encryption method",
    "dataProtection": "Data protection method",
    "compliance": ["GDPR", "SOC2"],
    "recommendations": ["Recommendation 1", "Recommendation 2"]
  },
  "deployment": {
    "environment": "cloud|on-premise|hybrid",
    "providers": ["AWS", "GCP"],
    "ci_cd": "CI/CD tool",
    "containerization": "Containerization tool",
    "orchestration": "Orchestration tool",
    "monitoring": ["Tool 1", "Tool 2"],
    "recommendations": ["Recommendation 1", "Recommendation 2"]
  },
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;
  }

  private buildUserPrompt(requirements: any, context?: Record<string, any>): string {
    let prompt = `Design architecture for the following requirements:\n\n`;

    if (typeof requirements === 'string') {
      prompt += requirements;
    } else {
      prompt += JSON.stringify(requirements, null, 2);
    }

    if (context) {
      prompt += `\n\nContext:\n${JSON.stringify(context, null, 2)}`;
    }

    prompt += '\n\nProvide a comprehensive architecture design.';
    return prompt;
  }

  private parseResponse(content: string): ArchitectureDesign {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse architecture design: ${error}`);
    }
  }

  private parseEvaluation(content: string): ArchitectureEvaluation {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse evaluation: ${error}`);
    }
  }
}

export interface ArchitectureEvaluation {
  score: number;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  improvements: string[];
  recommendations: string[];
               }
