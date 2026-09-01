/**
 * VYENFITA Code Generator Service
 * 
 * Generates code from natural language description
 * - Frontend code (React, Vue, Angular)
 * - Backend code (Node.js, Python, Java)
 * - API code
 * - Database code
 * 
 * @version 1.0.0
 */

import { AIService } from './ai.service';
import { ChatMessage } from '../interfaces/ai-provider.interface';

export interface CodeGenerationResult {
  code: string;
  language: 'typescript' | 'javascript' | 'python' | 'java' | 'csharp' | 'go' | 'rust' | 'cpp';
  framework: string;
  explanation: string;
  files: GeneratedFile[];
  dependencies: string[];
  confidence: number;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'component' | 'service' | 'model' | 'controller' | 'config' | 'test' | 'other';
}

export class CodeGeneratorService {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Generate code from description
   */
  async generateCode(
    description: string,
    language: CodeGenerationResult['language'] = 'typescript',
    framework: string = 'react',
    context?: Record<string, any>
  ): Promise<CodeGenerationResult> {
    const systemPrompt = this.getSystemPrompt(language, framework);
    const userPrompt = this.buildUserPrompt(description, context);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3,
      maxTokens: 8192,
    });

    return this.parseResponse(response.choices[0].message.content, language, framework);
  }

  /**
   * Generate API code
   */
  async generateAPI(
    specification: any,
    language: CodeGenerationResult['language'] = 'typescript'
  ): Promise<CodeGenerationResult> {
    const systemPrompt = `You are VYENFITA API Code Generator.
Generate API code based on the specification.

Output must be a valid JSON with this structure:
{
  "code": "Generated code",
  "files": [
    {
      "path": "file.ts",
      "content": "file content",
      "type": "controller|model|route|test"
    }
  ],
  "dependencies": ["express", "typescript"],
  "explanation": "Explanation of the code",
  "confidence": 0.95
}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(specification, null, 2) },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3,
      maxTokens: 8192,
    });

    return this.parseResponse(response.choices[0].message.content, language, 'express');
  }

  private getSystemPrompt(language: string, framework: string): string {
    return `You are VYENFITA Code Generator Expert.
Generate ${language} code using ${framework} framework based on the description.

Output must be a valid JSON with this structure:
{
  "code": "Main code content",
  "files": [
    {
      "path": "src/components/Component.tsx",
      "content": "file content",
      "type": "component|service|model|controller|config|test|other"
    }
  ],
  "dependencies": ["dependency1", "dependency2"],
  "explanation": "Explanation of the code",
  "confidence": 0.95
}`;
  }

  private buildUserPrompt(description: string, context?: Record<string, any>): string {
    let prompt = `Generate code for: ${description}\n\n`;

    if (context) {
      prompt += `Context:\n${JSON.stringify(context, null, 2)}\n\n`;
    }

    prompt += 'Generate comprehensive, production-ready code.';
    return prompt;
  }

  private parseResponse(
    content: string,
    language: CodeGenerationResult['language'],
    framework: string
  ): CodeGenerationResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        code: parsed.code || '',
        language,
        framework,
        explanation: parsed.explanation || '',
        files: parsed.files || [],
        dependencies: parsed.dependencies || [],
        confidence: parsed.confidence || 0.8,
      };
    } catch (error) {
      throw new Error(`Failed to parse code generation: ${error}`);
    }
  }
  }
