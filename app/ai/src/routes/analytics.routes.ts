/**
 * VYENFITA AI Routes (Minimal / Mock)
 * 
 * Placeholder endpoints for AI generation.
 * Real AI integration will be wired in a future session.
 * 
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../lib/auth/middleware';

export function createAIRouter(): Router {
  const router = Router();

  router.use(authenticate);

  // ============================================================
  // GENERATE APPLICATION
  // ============================================================
  router.post('/generate-application', async (req: Request, res: Response) => {
    try {
      const { description } = req.body;

      if (!description || typeof description !== 'string') {
        return res.status(400).json({ success: false, error: 'description is required' });
      }

      // Simulasi delay AI (500ms)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Return mock response
      return res.json({
        success: true,
        data: {
          message: 'Mock AI generation successful',
          spec: {
            metadata: { name: 'Generated App', version: '1.0.0' },
            entities: [],
            pages: [{ name: 'Home', type: 'page' }],
            roles: []
          }
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      });
    }
  });

  // ============================================================
  // CHAT WITH AI
  // ============================================================
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, error: 'messages array is required' });
      }

      // Simulasi delay AI (300ms)
      await new Promise((resolve) => setTimeout(resolve, 300));

      const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();

      return res.json({
        success: true,
        data: {
          message: {
            role: 'assistant',
            content: `[MOCK AI] I received your message: "${lastUserMessage?.content || 'empty'}". Real AI integration is pending.`
          }
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Chat failed',
      });
    }
  });

  return router;
}
