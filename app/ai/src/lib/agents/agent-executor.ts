/**
 * VYENFITA Agent Executor
 * 
 * Executes an agent using ReAct (Reasoning + Acting) pattern.
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../database/client';
import { getAIService } from '../ai/ai.service';
import { auditService } from '../audit/audit.service';
import { getMetrics } from '../observability/metrics.service';
import { logger } from '../observability/logger';
import { getToolRegistry } from './tool-registry';
import {
  AgentDefinition,
  AgentRun,
  AgentStep,
  AgentOutput,
  AgentAction,
  AgentCapabilityError,
  AgentApprovalRequiredError,
  AgentLimitExceededError,
  AgentTimeoutError,
  RISK_LEVEL_ORDER,
  RiskLevel,
} from './agent.types';

export class AgentExecutor {
  /**
   * Execute an agent run
   */
  static async execute(
    agent: AgentDefinition,
    input: { objective: string; context?: any; constraints?: string[] }
  ): Promise<AgentRun> {
    const startTime = Date.now();

    // Create run record
    const run = await prisma.agentRun.create({
      data: {
        id: uuidv4(),
        agentId: agent.id,
        tenantId: agent.tenantId,
        status: 'running',
        input: input as any,
        currentStepIndex: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        toolCalls: 0,
        startedAt: new Date(),
        metadata: {
          model: agent.model,
          objective: input.objective,
        },
      },
    });

    await auditService.log({
      tenantId: agent.tenantId,
      eventType: 'system',
      action: 'agent.run.start',
      resource: 'agent_run',
      resourceId: run.id,
      details: { agentId: agent.id, objective: input.objective },
      status: 'success',
    });

    try {
      const result = await this.runAgentLoop(agent, run, input);

      const durationMs = Date.now() - startTime;

      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          output: result as any,
          completedAt: new Date(),
          durationMs,
        },
      });

      await auditService.log({
        tenantId: agent.tenantId,
        eventType: 'system',
        action: 'agent.run.complete',
        resource: 'agent_run',
        resourceId: run.id,
        details: {
          steps: result.actions.length,
          confidence: result.confidence,
        },
        status: 'success',
        duration: durationMs,
      });

      return {
        ...run,
        status: 'completed',
        output: result,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: message,
          completedAt: new Date(),
          durationMs,
        },
      });

      await auditService.log({
        tenantId: agent.tenantId,
        eventType: 'system',
        action: 'agent.run.error',
        resource: 'agent_run',
        resourceId: run.id,
        details: { error: message },
        status: 'error',
        duration: durationMs,
      });

      throw error;
    }
  }

  // ============================================================
  // MAIN LOOP
  // ============================================================

  private static async runAgentLoop(
    agent: AgentDefinition,
    run: AgentRun,
    input: { objective: string; context?: any; constraints?: string[] }
  ): Promise<AgentOutput> {
    const ai = getAIService();
    const toolRegistry = getToolRegistry();
    const metrics = getMetrics();

    const steps: AgentStep[] = [];
    const actions: AgentAction[] = [];

    // Build available tools description
    const availableTools = toolRegistry.listAvailable(agent.capabilities);
    const toolsDescription = availableTools
      .map(
        (t) =>
          `- ${t.name}: ${t.description} (category: ${t.category}, risk: ${t.riskLevel})`
      )
      .join('\n');

    // Build system prompt
    const systemPrompt = `${agent.systemPrompt}

You are an autonomous agent. Your job is to achieve the user's objective using the available tools.

AVAILABLE TOOLS:
${toolsDescription || 'No tools available'}

IMPORTANT RULES:
1. Think step by step before taking action.
2. Use tools only when needed.
3. If a task requires high-risk action, output "REQUIRES_APPROVAL:" followed by reasoning.
4. Never hallucinate tool outputs. If a tool fails, adapt your plan.
5. When done, output "FINAL:" followed by your final answer.
6. Maximum ${agent.maxSteps} steps allowed.
7. Never exceed the objective scope.

Output format for each step:
THOUGHT: <your reasoning>
ACTION: <tool_name>
INPUT: <json input for the tool>

Or when done:
THOUGHT: <your final reasoning>
FINAL: <your final answer>

Or when approval needed:
THOUGHT: <your reasoning>
REQUIRES_APPROVAL: <reason and proposed action>`;

    // Build conversation
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `OBJECTIVE: ${input.objective}

${input.context ? `CONTEXT: ${JSON.stringify(input.context, null, 2)}\n` : ''}
${input.constraints ? `CONSTRAINTS:\n${input.constraints.map((c) => `- ${c}`).join('\n')}\n` : ''}

Begin working on this objective. Remember to think step by step.`,
      },
    ];

    // ============================================================
    // MAIN LOOP
    // ============================================================

    for (let i = 0; i < agent.maxSteps; i++) {
      // Check timeout
      const elapsed = (Date.now() - run.startedAt.getTime()) / 1000;
      if (elapsed > agent.maxDurationSeconds) {
        throw new AgentTimeoutError(agent.maxDurationSeconds);
      }

      // Check total tokens
      if (run.totalTokens > agent.maxTokensPerRun) {
        throw new AgentLimitExceededError('maxTokensPerRun', run.totalTokens);
      }

      // ============================================================
      // AI CALL
      // ============================================================

      const startStepTime = Date.now();
      const aiResponse = await ai.complete(
        {
          messages,
          temperature: agent.temperature,
          maxTokens: 2000,
        },
        {
          tenantId: agent.tenantId,
          operation: 'agent_think',
        }
      );

      const content = aiResponse.content;
      const tokensUsed = aiResponse.usage.totalTokens;
      run.totalTokens += tokensUsed;

      // Rough cost estimate
      const stepCost =
        (aiResponse.usage.promptTokens / 1_000_000) * 10 +
        (aiResponse.usage.completionTokens / 1_000_000) * 30;
      run.totalCostUsd += stepCost;

      messages.push({ role: 'assistant', content });

      // ============================================================
      // PARSE RESPONSE
      // ============================================================

      const thought = this.extractSection(content, 'THOUGHT');
      const actionName = this.extractSection(content, 'ACTION');
      const actionInput = this.extractSection(content, 'INPUT');
      const finalAnswer = this.extractSection(content, 'FINAL');
      const requiresApproval = this.extractSection(content, 'REQUIRES_APPROVAL');

      // ============================================================
      // CASE 1: FINAL ANSWER
      // ============================================================

      if (finalAnswer) {
        const step: AgentStep = {
          id: uuidv4(),
          runId: run.id,
          stepIndex: i,
          type: 'output',
          thought,
          output: finalAnswer,
          tokensUsed,
          costUsd: stepCost,
          durationMs: Date.now() - startStepTime,
          timestamp: new Date(),
        };

        steps.push(step);
        await this.persistStep(step);

        return {
          result: finalAnswer,
          reasoning: thought || 'Task completed',
          actions,
          confidence: 0.85,
        };
      }

      // ============================================================
      // CASE 2: REQUIRES APPROVAL
      // ============================================================

      if (requiresApproval) {
        const step: AgentStep = {
          id: uuidv4(),
          runId: run.id,
          stepIndex: i,
          type: 'approval',
          thought,
          output: requiresApproval,
          approval: {
            required: true,
            status: 'pending',
          },
          tokensUsed,
          costUsd: stepCost,
          durationMs: Date.now() - startStepTime,
          timestamp: new Date(),
        };

        steps.push(step);
        await this.persistStep(step);

        // Mark run as waiting approval
        await prisma.agentRun.update({
          where: { id: run.id },
          data: { status: 'waiting_approval' },
        });

        throw new AgentApprovalRequiredError(step.id, requiresApproval);
      }

      // ============================================================
      // CASE 3: TOOL CALL
      // ============================================================

      if (actionName && actionInput) {
        // Parse input
        let parsedInput: any = {};
        try {
          const jsonMatch = actionInput.match(/\{[\s\S]*\}/);
          parsedInput = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch {
          parsedInput = {};
        }

        // Execute tool
        const tool = toolRegistry.get(actionName);
        if (!tool) {
          messages.push({
            role: 'user',
            content: `OBSERVATION: Tool "${actionName}" not found. Available: ${availableTools.map((t) => t.name).join(', ')}`,
          });
          continue;
        }

        // Check approval required
        if (tool.requiresApproval || RISK_LEVEL_ORDER[tool.riskLevel] >= RISK_LEVEL_ORDER[agent.approvalThreshold]) {
          const step: AgentStep = {
            id: uuidv4(),
            runId: run.id,
            stepIndex: i,
            type: 'approval',
            thought,
            action: { tool: actionName, input: parsedInput },
            approval: {
              required: true,
              status: 'pending',
            },
            tokensUsed,
            costUsd: stepCost,
            durationMs: Date.now() - startStepTime,
            timestamp: new Date(),
          };

          steps.push(step);
          await this.persistStep(step);

          await prisma.agentRun.update({
            where: { id: run.id },
            data: { status: 'waiting_approval' },
          });

          throw new AgentApprovalRequiredError(
            step.id,
            `Tool "${actionName}" requires approval (risk: ${tool.riskLevel})`
          );
        }

        // Execute
        const result = await toolRegistry.execute(actionName, parsedInput, {
          tenantId: agent.tenantId,
          agentId: agent.id,
          runId: run.id,
          capabilities: agent.capabilities.map((c) => c.name),
        });

        run.toolCalls += 1;

        const action: AgentAction = {
          type: 'tool_call',
          description: `Called ${actionName}`,
          toolName: actionName,
          toolInput: parsedInput,
          toolOutput: result.output,
          riskLevel: tool.riskLevel,
          executedAt: new Date(),
          success: result.success,
        };
        actions.push(action);

        const step: AgentStep = {
          id: uuidv4(),
          runId: run.id,
          stepIndex: i,
          type: 'tool_call',
          thought,
          action: { tool: actionName, input: parsedInput },
          observation: result.success ? result.output : { error: result.error },
          tokensUsed,
          costUsd: stepCost,
          durationMs: Date.now() - startStepTime,
          timestamp: new Date(),
          error: result.success ? undefined : result.error,
        };

        steps.push(step);
        await this.persistStep(step);

        // Feed observation back
        messages.push({
          role: 'user',
          content: `OBSERVATION: ${JSON.stringify(result.output || { error: result.error })}`,
        });

        continue;
      }

      // ============================================================
      // FALLBACK: No valid action detected
      // ============================================================

      messages.push({
        role: 'user',
        content: `OBSERVATION: Could not parse your response. Please use the correct format:
THOUGHT: <reasoning>
ACTION: <tool_name>
INPUT: <json>

Or when done:
FINAL: <answer>`,
      });
    }

    // Max steps reached
    metrics.incrementCounter('vyenfita_agent_max_steps_total', {
      agent: agent.name,
    });

    return {
      result: 'Max steps reached without final answer',
      reasoning: 'Agent exceeded maximum number of steps',
      actions,
      confidence: 0.3,
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private static extractSection(content: string, section: string): string | undefined {
    const regex = new RegExp(`${section}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : undefined;
  }

  private static async persistStep(step: AgentStep): Promise<void> {
    try {
      await prisma.agentStep.create({
        data: {
          id: step.id,
          runId: step.runId,
          stepIndex: step.stepIndex,
          type: step.type,
          thought: step.thought,
          action: step.action as any,
          observation: step.observation as any,
          decision: step.decision as any,
          output: step.output,
          approval: step.approval as any,
          tokensUsed: step.tokensUsed,
          costUsd: step.costUsd,
          durationMs: step.durationMs,
          error: step.error,
        },
      });
    } catch (error) {
      logger.error('Failed to persist agent step', {
        stepId: step.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }
}

export default AgentExecutor;
