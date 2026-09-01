/**
 * VYENFITA Agent Controller
 * 
 * Handles AI Agents operations
 * - Requirement Agent
 * - Architecture Agent
 * - Testing Agent
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { AIService } from '../core/services/ai.service';
import { RequirementAgent } from '../core/agents/requirement-agent';
import { ArchitectureAgent } from '../core/agents/architecture-agent';
import { TestingAgent } from '../core/agents/testing-agent';

export class AgentController {
  private requirementAgent: RequirementAgent;
  private architectureAgent: ArchitectureAgent;
  private testingAgent: TestingAgent;

  constructor() {
    const aiService = new AIService();
    this.requirementAgent = new RequirementAgent(aiService);
    this.architectureAgent = new ArchitectureAgent(aiService);
    this.testingAgent = new TestingAgent(aiService);
  }

  // ============================================================
  // REQUIREMENT AGENT
  // ============================================================

  /**
   * Analyze requirements
   * POST /api/v1/agents/analyze-requirements
   */
  async analyzeRequirements(req: Request, res: Response): Promise<void> {
    try {
      const { description, context } = req.body;

      if (!description || typeof description !== 'string') {
        res.status(400).json({
          success: false,
          error: 'description is required and must be a string',
        });
        return;
      }

      const result = await this.requirementAgent.analyze(description, context);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Refine requirements
   * POST /api/v1/agents/refine-requirements
   */
  async refineRequirements(req: Request, res: Response): Promise<void> {
    try {
      const { analysis, feedback } = req.body;

      if (!analysis) {
        res.status(400).json({
          success: false,
          error: 'analysis is required',
        });
        return;
      }

      if (!feedback || typeof feedback !== 'string') {
        res.status(400).json({
          success: false,
          error: 'feedback is required and must be a string',
        });
        return;
      }

      const result = await this.requirementAgent.refine(analysis, feedback);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Generate clarifying questions
   * POST /api/v1/agents/generate-questions
   */
  async generateQuestions(req: Request, res: Response): Promise<void> {
    try {
      const { description } = req.body;

      if (!description || typeof description !== 'string') {
        res.status(400).json({
          success: false,
          error: 'description is required and must be a string',
        });
        return;
      }

      const questions = await this.requirementAgent.generateQuestions(description);

      res.json({
        success: true,
        data: questions,
        count: questions.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ============================================================
  // ARCHITECTURE AGENT
  // ============================================================

  /**
   * Design architecture
   * POST /api/v1/agents/design-architecture
   */
  async designArchitecture(req: Request, res: Response): Promise<void> {
    try {
      const { requirements, context } = req.body;

      if (!requirements) {
        res.status(400).json({
          success: false,
          error: 'requirements is required',
        });
        return;
      }

      const result = await this.architectureAgent.design(requirements, context);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Evaluate architecture
   * POST /api/v1/agents/evaluate-architecture
   */
  async evaluateArchitecture(req: Request, res: Response): Promise<void> {
    try {
      const { design } = req.body;

      if (!design) {
        res.status(400).json({
          success: false,
          error: 'design is required',
        });
        return;
      }

      const result = await this.architectureAgent.evaluate(design);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ============================================================
  // TESTING AGENT
  // ============================================================

  /**
   * Generate tests
   * POST /api/v1/agents/generate-tests
   */
  async generateTests(req: Request, res: Response): Promise<void> {
    try {
      const { spec, context } = req.body;

      if (!spec) {
        res.status(400).json({
          success: false,
          error: 'spec is required',
        });
        return;
      }

      const result = await this.testingAgent.generateTests(spec, context);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Execute tests
   * POST /api/v1/agents/execute-tests
   */
  async executeTests(req: Request, res: Response): Promise<void> {
    try {
      const { testSuite } = req.body;

      if (!testSuite) {
        res.status(400).json({
          success: false,
          error: 'testSuite is required',
        });
        return;
      }

      const results = await this.testingAgent.executeTests(testSuite);

      res.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Analyze test results
   * POST /api/v1/agents/analyze-test-results
   */
  async analyzeTestResults(req: Request, res: Response): Promise<void> {
    try {
      const { results } = req.body;

      if (!results || !Array.isArray(results)) {
        res.status(400).json({
          success: false,
          error: 'results is required and must be an array',
        });
        return;
      }

      const analysis = await this.testingAgent.analyzeResults(results);

      res.json({
        success: true,
        data: analysis,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
