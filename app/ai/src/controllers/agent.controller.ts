/**
 * VYENFITA Agent Controller
 * 
 * Handles AI Agents operations
 * 
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { AIService } from '../core/services/ai.service';
import { RequirementAgent } from '../core/agents/requirement-agent';

export class AgentController {
  private requirementAgent: RequirementAgent;

  constructor() {
    const aiService = new AIService();
    this.requirementAgent = new RequirementAgent(aiService);
  }

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
}
