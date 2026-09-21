/**
 * VYENFITA Tool Registry
 * 
 * Central registry for all tools available to agents.
 * 
 * @version 1.0.0
 */

import { AgentTool, ToolContext, ToolResult, RiskLevel } from './agent.types';
import { logger } from '../observability/logger';
import axios from 'axios';
import { SSRFGuard } from '../security/ssrf-guard';

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  constructor() {
    this.registerBuiltInTools();
  }

  /**
   * Register a tool
   */
  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    logger.info('Tool registered', { name: tool.name, category: tool.category });
  }

  /**
   * Get a tool by name
   */
  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all tools
   */
  list(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * List tools filtered by category
   */
  listByCategory(category: string): AgentTool[] {
    return this.list().filter((t) => t.category === category);
  }

  /**
   * List tools available for a given capability set
   */
  listAvailable(capabilities: string[]): AgentTool[] {
    return this.list().filter((tool) => {
      // Tool is available if:
      // 1. It's explicitly in capabilities (e.g. "tool:http_request")
      // 2. Or the tool's category is available (e.g. "category:http")
      return (
        capabilities.includes(`tool:${tool.name}`) ||
        capabilities.includes(`category:${tool.category}`) ||
        capabilities.includes('tool:*')
      );
    });
  }

  /**
   * Execute a tool with context and permission check
   */
  async execute(
    name: string,
    input: any,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool not found: ${name}` };
    }

    // Permission check
    const hasPermission =
      context.capabilities.includes(`tool:${name}`) ||
      context.capabilities.includes(`category:${tool.category}`) ||
      context.capabilities.includes('tool:*');

    if (!hasPermission) {
      return {
        success: false,
        error: `No permission to execute tool: ${name}`,
      };
    }

    const startTime = Date.now();

    try {
      logger.info('Tool execution started', {
        tool: name,
        runId: context.runId,
        agentId: context.agentId,
      });

      const result = await tool.execute(input, context);
      const durationMs = Date.now() - startTime;

      logger.info('Tool execution completed', {
        tool: name,
        runId: context.runId,
        durationMs,
        success: result.success,
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          durationMs,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Tool execution failed', {
        tool: name,
        runId: context.runId,
        error: message,
        durationMs,
      });

      return {
        success: false,
        error: message,
        metadata: { durationMs },
      };
    }
  }

  // ============================================================
  // BUILT-IN TOOLS
  // ============================================================

  private registerBuiltInTools(): void {
    // ----------------------------------------------------------
    // HTTP Request
    // ----------------------------------------------------------
    this.register({
      name: 'http_request',
      description: 'Make an HTTP request to an external API. Protected by SSRF guard.',
      category: 'http',
      riskLevel: 'medium',
      requiresApproval: false,
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Full URL to request' },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            default: 'GET',
          },
          headers: { type: 'object' },
          body: { type: 'object' },
          timeoutMs: { type: 'number', default: 30000 },
        },
        required: ['url'],
      },
      execute: async (input: any, _context: ToolContext): Promise<ToolResult> => {
        // SSRF check
        const ssrf = await SSRFGuard.check(input.url);
        if (!ssrf.safe) {
          return {
            success: false,
            error: `SSRF protection: ${ssrf.reason}`,
          };
        }

        const response = await axios({
          method: input.method || 'GET',
          url: input.url,
          headers: input.headers || {},
          data: input.body,
          timeout: Math.min(input.timeoutMs || 30000, 60000),
          maxContentLength: 5 * 1024 * 1024,
          maxBodyLength: 5 * 1024 * 1024,
        });

        return {
          success: true,
          output: {
            status: response.status,
            headers: response.headers,
            data: response.data,
          },
        };
      },
    });

    // ----------------------------------------------------------
    // Current Time
    // ----------------------------------------------------------
    this.register({
      name: 'get_current_time',
      description: 'Get the current date and time.',
      category: 'utility',
      riskLevel: 'low',
      requiresApproval: false,
      inputSchema: {
        type: 'object',
        properties: {
          timezone: { type: 'string', default: 'UTC' },
        },
      },
      execute: async (input: any): Promise<ToolResult> => {
        const tz = input?.timezone || 'UTC';
        const now = new Date();
        return {
          success: true,
          output: {
            iso: now.toISOString(),
            unix: Math.floor(now.getTime() / 1000),
            timezone: tz,
            formatted: now.toLocaleString('en-US', { timeZone: tz }),
          },
        };
      },
    });

    // ----------------------------------------------------------
    // Math Calculator
    // ----------------------------------------------------------
    this.register({
      name: 'calculate',
      description: 'Perform mathematical calculations.',
      category: 'utility',
      riskLevel: 'low',
      requiresApproval: false,
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Math expression (e.g. "2 + 2 * 3")',
          },
        },
        required: ['expression'],
      },
      execute: async (input: any): Promise<ToolResult> => {
        try {
          const expr = String(input.expression).trim();
          // Safe eval: only allow numbers and basic operators
          if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
            return {
              success: false,
              error: 'Invalid expression: only numbers and + - * / ( ) allowed',
            };
          }

          // Use Function constructor instead of eval
          const result = new Function(`return (${expr})`)();

          return {
            success: true,
            output: { expression: expr, result },
          };
        } catch (error) {
          return {
            success: false,
            error: `Calculation failed: ${error instanceof Error ? error.message : 'Unknown'}`,
          };
        }
      },
    });

    // ----------------------------------------------------------
    // JSON Parser
    // ----------------------------------------------------------
    this.register({
      name: 'parse_json',
      description: 'Parse a JSON string and return the object.',
      category: 'utility',
      riskLevel: 'low',
      requiresApproval: false,
      inputSchema: {
        type: 'object',
        properties: {
          json: { type: 'string' },
          path: {
            type: 'string',
            description: 'Optional dot-path to extract (e.g. "data.items.0")',
          },
        },
        required: ['json'],
      },
      execute: async (input: any): Promise<ToolResult> => {
        try {
          const parsed = JSON.parse(input.json);

          if (input.path) {
            const parts = input.path.split('.');
            let current = parsed;
            for (const part of parts) {
              if (current === null || current === undefined) {
                return { success: false, error: `Path not found: ${input.path}` };
              }
              current = current[part];
            }
            return { success: true, output: current };
          }

          return { success: true, output: parsed };
        } catch (error) {
          return {
            success: false,
            error: `JSON parse failed: ${error instanceof Error ? error.message : 'Unknown'}`,
          };
        }
      },
    });

    // ----------------------------------------------------------
    // String Operations
    // ----------------------------------------------------------
    this.register({
      name: 'string_ops',
      description: 'Perform string operations like uppercase, lowercase, split, replace.',
      category: 'utility',
      riskLevel: 'low',
      requiresApproval: false,
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          operation: {
            type: 'string',
            enum: ['uppercase', 'lowercase', 'trim', 'split', 'replace', 'substring'],
          },
          args: { type: 'array' },
        },
        required: ['text', 'operation'],
      },
      execute: async (input: any): Promise<ToolResult> => {
        const { text, operation, args = [] } = input;

        switch (operation) {
          case 'uppercase':
            return { success: true, output: String(text).toUpperCase() };
          case 'lowercase':
            return { success: true, output: String(text).toLowerCase() };
          case 'trim':
            return { success: true, output: String(text).trim() };
          case 'split':
            return { success: true, output: String(text).split(args[0] || ',') };
          case 'replace':
            return {
              success: true,
              output: String(text).replace(new RegExp(args[0], 'g'), args[1] || ''),
            };
          case 'substring':
            return {
              success: true,
              output: String(text).substring(args[0] || 0, args[1]),
            };
          default:
            return { success: false, error: `Unknown operation: ${operation}` };
        }
      },
    });

    // ----------------------------------------------------------
    // Wait / Sleep
    // ----------------------------------------------------------
    this.register({
      name: 'wait',
      description: 'Wait for a specified number of seconds (max 30).',
      category: 'utility',
      riskLevel: 'low',
      requiresApproval: false,
      inputSchema: {
        type: 'object',
        properties: {
          seconds: { type: 'number', minimum: 0, maximum: 30 },
        },
        required: ['seconds'],
      },
      execute: async (input: any): Promise<ToolResult> => {
        const seconds = Math.min(Math.max(input.seconds || 0, 0), 30);
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        return { success: true, output: { waited: seconds } };
      },
    });

    // ----------------------------------------------------------
    // Query Applications
    // ----------------------------------------------------------
    this.register({
      name: 'query_applications',
      description: 'Query applications in the current tenant. Read-only.',
      category: 'internal',
      riskLevel: 'low',
      requiresApproval: false,
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['draft', 'published', 'archived'] },
          limit: { type: 'number', default: 10 },
        },
      },
      execute: async (input: any, context: ToolContext): Promise<ToolResult> => {
        const { prisma } = await import('../database/client');

        const where: any = { tenantId: context.tenantId, deletedAt: null };
        if (input.status) where.status = input.status;

        const apps = await prisma.application.findMany({
          where,
          take: Math.min(input.limit || 10, 100),
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return {
          success: true,
          output: { applications: apps, count: apps.length },
        };
      },
    });

    // ----------------------------------------------------------
    // Query Workflow Executions
    // ----------------------------------------------------------
    this.register({
      name: 'query_workflow_executions',
      description: 'Query workflow executions. Read-only.',
      category: 'internal',
      riskLevel: 'low',
      requiresApproval: false,
      inputSchema: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          status: { type: 'string' },
          limit: { type: 'number', default: 20 },
        },
      },
      execute: async (input: any, context: ToolContext): Promise<ToolResult> => {
        const { prisma } = await import('../database/client');

        const where: any = { tenantId: context.tenantId };
        if (input.workflowId) where.workflowId = input.workflowId;
        if (input.status) where.status = input.status;

        const executions = await prisma.workflowExecution.findMany({
          where,
          take: Math.min(input.limit || 20, 100),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            workflowId: true,
            status: true,
            startedAt: true,
            completedAt: true,
            duration: true,
            error: true,
          },
        });

        return {
          success: true,
          output: { executions, count: executions.length },
        };
      },
    });

    logger.info('Built-in tools registered', { count: this.tools.size });
  }
}

// ============================================================
// SINGLETON
// ============================================================

let registryInstance: ToolRegistry | undefined;

export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
  }
  return registryInstance;
}

export default ToolRegistry;
