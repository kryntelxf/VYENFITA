import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';

const PROVIDERS: Record<string, { authUrl: string; scope: string; envClientId: string }> = {
  google: { authUrl: 'https://accounts.google.com/o/oauth2/v2/auth', scope: 'openid email profile', envClientId: 'GOOGLE_CLIENT_ID' },
  github: { authUrl: 'https://github.com/login/oauth/authorize', scope: 'user:email', envClientId: 'GITHUB_CLIENT_ID' },
};

export function createAuthOAuthRouter(): Router {
  const router = Router();

  router.get('/providers', (_req: Request, res: Response) => {
    return res.json({ success: true, data: Object.entries(PROVIDERS).map(([name, cfg]) => ({ name, configured: !!process.env[cfg.envClientId] })) });
  });

  router.post('/:provider/authorize', (req: Request, res: Response) => {
    try {
      const { redirectUri } = req.body;
      if (!redirectUri) return res.status(400).json({ success: false, error: 'redirectUri required' });

      const cfg = PROVIDERS[req.params.provider];
      if (!cfg) return res.status(404).json({ success: false, error: 'Unknown provider' });

      const clientId = process.env[cfg.envClientId];
      if (!clientId) return res.status(400).json({ success: false, error: `OAuth not configured for ${req.params.provider}` });

      const state = randomBytes(16).toString('hex');
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: cfg.scope, state });
      return res.json({ success: true, data: { url: `${cfg.authUrl}?${params.toString()}`, state } });
    } catch (error) { return res.status(500).json({ success: false, error: 'Failed' }); }
  });

  router.post('/:provider/callback', async (req: Request, res: Response) => {
    return res.status(501).json({ success: false, error: 'OAuth callback not yet implemented' });
  });

  return router;
}
