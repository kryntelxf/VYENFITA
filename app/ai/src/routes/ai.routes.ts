/**
 * VYENFITA AI Routes (Minimal)
 *
 * Chat and application generation endpoints.
 * Uses OpenAI if OPENAI_API_KEY is set; otherwise returns a safe
 * mock response so the endpoint doesn't 500 during development.
 *
 * @version 1.0.0
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../lib/auth/middleware';

export function createAIRouter(): Router {
  const router = Router();

  // ============================================================
  // AI HEALTH (public — no auth)
  // ============================================================

  router.get('/health', (_req: Request, res: Response) => {
    const configured = !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY;
    return res.json({
      success: true,
      data: {
        configured,
        providers: {
          openai: !!process.env.OPENAI_API_KEY,
          anthropic: !!process.env.ANTHROPIC_API_KEY,
        },
        mode: configured ? 'live' : 'mock',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ============================================================
  // CHAT COMPLETION (authenticated)
  // ============================================================

  router.post('/chat', authenticate, async (req: Request, res: Response) => {
    try {
      const { messages } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'messages[] is required and must not be empty',
        });
      }

      const hasOpenAI = !!process.env.OPENAI_API_KEY;

      if (!hasOpenAI) {
        // Mock response when no API key configured
        return res.json({
          success: true,
          data: {
            message: {
              role: 'assistant',
              content: '[MOCK] AI service is not configured. Set OPENAI_API_KEY to enable live responses.',
            },
            usage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
            mock: true,
          },
        });
      }

      // Live OpenAI call
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(502).json({
          success: false,
          error: `AI provider error: ${response.status}`,
          details: errorText.substring(0, 500),
        });
      }

      const data: any = await response.json();

      return res.json({
        success: true,
        data: {
          message: data.choices?.[0]?.message || {
            role: 'assistant',
            content: '',
          },
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
          model: data.model,
          mock: false,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Chat failed',
      });
    }
  });

  // ============================================================
  // GENERATE APPLICATION (authenticated)
  // ============================================================

  router.post(
    '/generate-application',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const { description } = req.body;

        if (!description || typeof description !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'description is required (string)',
          });
        }
        if (description.length < 10) {
          return res.status(400).json({
            success: false,
            error: 'description must be at least 10 characters',
          });
        }

        const hasOpenAI = !!process.env.OPENAI_API_KEY;

        if (!hasOpenAI) {
          // Mock minimal app spec
          return res.json({
            success: true,
            data: {
              metadata: {
                name: 'Generated App',
                description,
                version: '1.0.0',
              },
              entities: [],
              pages: [
                {
                  name: 'Home',
                  path: '/',
                  type: 'dashboard',
                  widgets: [],
                },
              ],
              roles: [
                {
                  name: 'Admin',
                  permissions: [{ resource: '*', action: 'all' }],
                },
              ],
              mock: true,
            },
          });
        }

        // Live generation via OpenAI (JSON mode)
        const systemPrompt = `You are VYENFITA. Generate a valid JSON application spec based on the user description.
Output ONLY valid JSON with this shape:
{
  "metadata": {"name": "string", "description": "string", "version": "1.0.0"},
  "entities": [{"name": "string", "fields": [{"name": "string", "type": "string|number|boolean|date"}]}],
  "pages": [{"name": "string", "path": "/path", "type": "dashboard|form|table", "widgets": []}],
  "roles": [{"name": "string", "permissions": [{"resource": "string", "action": "string"}]}]
}
No markdown. Just JSON.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: description },
            ],
            temperature: 0.3,
            max_tokens: 2048,
            response_format: { type: 'json_object' },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return res.status(502).json({
            success: false,
            error: `AI provider error: ${response.status}`,
            details: errorText.substring(0, 500),
          });
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || '{}';

        let spec: any;
        try {
          spec = JSON.parse(content);
        } catch {
          return res.status(502).json({
            success: false,
            error: 'AI returned invalid JSON',
            raw: content.substring(0, 500),
          });
        }

        return res.json({
          success: true,
          data: {
            ...spec,
            mock: false,
            tokensUsed: data.usage?.total_tokens || 0,
          },
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Application generation failed',
        });
      }
    }
  );

  return router;
            }
