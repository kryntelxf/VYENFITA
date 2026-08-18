import { Request, Response } from 'express';
import { AIService } from '../core/services/ai.service';
import { ApplicationGeneratorService } from '../core/services/application-generator.service';
import { ChatCompletionParams } from '../core/interfaces/ai-provider.interface';

/**
 * AI Controller
 * HTTP endpoints for AI operations
 */
export class AIController {
  private aiService: AIService;
  private appGenerator: ApplicationGeneratorService;

  constructor() {
    this.aiService = new AIService();
    this.appGenerator = new ApplicationGeneratorService(this.aiService);
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthy = await this.aiService.healthCheck();
      res.json({
        status: 'ok',
        provider: this.aiService.getProvider().name,
        healthy,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Chat completion endpoint
   */
  async chat(req: Request, res: Response): Promise<void> {
    try {
      const params: ChatCompletionParams = req.body;
      
      // Validate required fields
      if (!params.messages || !Array.isArray(params.messages)) {
        res.status(400).json({
          error: 'messages is required and must be an array',
        });
        return;
      }

      const response = await this.aiService.chat(params);
      res.json({
        success: true,
        data: response,
        provider: this.aiService.getProvider().name,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate application endpoint
   */
  async generateApplication(req: Request, res: Response): Promise<void> {
    try {
      const { description, context } = req.body;

      if (!description || typeof description !== 'string') {
        res.status(400).json({
          error: 'description is required and must be a string',
        });
        return;
      }

      const application = await this.appGenerator.generateApplication(description, context);
      res.json({
        success: true,
        data: application,
        provider: this.aiService.getProvider().name,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate workflow endpoint
   */
  async generateWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { description } = req.body;

      if (!description || typeof description !== 'string') {
        res.status(400).json({
          error: 'description is required and must be a string',
        });
        return;
      }

      const workflow = await this.appGenerator.generateWorkflow(description);
      res.json({
        success: true,
        data: workflow,
        provider: this.aiService.getProvider().name,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Switch provider endpoint
   */
  async switchProvider(req: Request, res: Response): Promise<void> {
    try {
      const { provider } = req.body;

      if (!provider || typeof provider !== 'string') {
        res.status(400).json({
          error: 'provider is required and must be a string',
        });
        return;
      }

      this.aiService.switchProvider(provider);
      res.json({
        success: true,
        provider: this.aiService.getProvider().name,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
    }
